import test from 'node:test';
import assert from 'node:assert/strict';
import { bestQuote, groupProps, price } from '../public/domain.js';
import { calculateAverages, parseCSV, statValue } from '../server/stats.js';
import { LEAGUES } from '../public/leagues.js';

test('prop comparisons keep different lines separate, with matching prices and books', () => {
  const book = (title, point, value) => ({ title, markets: [{ key: 'player_points', outcomes: [{ name: 'Over', description: 'A Player', point, price: value }] }] });
  const rows = groupProps({ bookmakers: [book('Book A', 20.5, -110), book('Book B', 21.5, 120), book('Book C', 20.5, -105)] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].point, 20.5); assert.equal(rows[0].quotes[0].book, 'Book C');
  assert.equal(rows[1].point, 21.5); assert.equal(rows[1].quotes[0].price, 120);
  assert.deepEqual(groupProps({}), []);
});
test('American odds ordering and game lines preserve bookmaker attribution', () => {
  const books = [{ title: 'A', markets: [{ key: 'spreads', outcomes: [{ name: 'Team', point: 2.5, price: -110 }] }] },
    { title: 'B', markets: [{ key: 'spreads', outcomes: [{ name: 'Team', point: 3.5, price: 105 }] }] }];
  const best = bestQuote(books, 'spreads', 'Team');
  assert.equal(best.point, 3.5); assert.equal(best.price, 105); assert.equal(best.book, 'B');
  assert.equal(price(-110), '-110'); assert.equal(price(110), '+110'); assert.equal(price(null), '—');
});
test('CSV parser supports quoted fields, commas, quotes, newlines and empty values', () => {
  assert.deepEqual(parseCSV('\uFEFFname,note,value\r\n"A, Player","A ""quote""\nnext",0\r\nOther,,\r\n'),
    [{ name: 'A, Player', note: 'A "quote"\nnext', value: '0' }, { name: 'Other', note: '', value: '' }]);
});
test('last ten averages deduplicate games, exclude DNP/future entries and retain prior-season games', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ athlete_display_name: 'A Player', athlete_id: '1',
    game_id: `g${i}`, game_date: `2024-12-${String(i + 1).padStart(2, '0')}`, minutes: '30', points: String(i + 1), rebounds: '2', assists: '3' }));
  rows.push({ ...rows[11] }, { ...rows[11], game_id: 'dnp', game_date: '2024-12-13', did_not_play: 'true', points: '100' },
    { ...rows[11], game_id: 'future', game_date: '2099-01-01', points: '100' });
  const result = calculateAverages(LEAGUES.nba, { players: ['A Player'], markets: ['player_points', 'player_points_rebounds_assists'], teams: ['Boston Celtics', 'Los Angeles Lakers'], before: '2025-01-01' }, rows)[0];
  assert.equal(result.values.player_points.games, 10); assert.equal(result.values.player_points.average, 7.5);
  assert.equal(result.values.player_points_rebounds_assists.average, 12.5);
  assert.equal(result.latestGame, '2024-12-12');
});
test('ambiguous initial/surname matches stay blank instead of merging players', () => {
  const rows = ['John', 'James'].map((name, i) => ({ player_display_name: `${name} Smith`, player_id: String(i), team: 'BUF', game_id: `g${i}`, gameday: '2024-12-01', season_type: 'REG', passing_yards: '200' }));
  const result = calculateAverages(LEAGUES.nfl, { players: ['J. Smith'], markets: ['player_pass_yds'], teams: ['Buffalo Bills', 'Kansas City Chiefs'], before: '2025-01-01' }, rows)[0];
  assert.deepEqual(result.values, {}); assert.equal(result.reason, 'Ambiguous player match');
});
test('NFL averages use regular-season completed records and show fewer than ten games honestly', () => {
  const rows = [{ player_id: '1', player_display_name: 'Josh Allen', team: 'BUF', game_id: 'one', gameday: '2024-12-01', season_type: 'REG', passing_yards: '250' },
    { player_id: '1', player_display_name: 'Josh Allen', team: 'BUF', game_id: 'post', gameday: '2024-12-02', season_type: 'POST', passing_yards: '400' }];
  const result = calculateAverages(LEAGUES.nfl, { players: ['J. Allen'], markets: ['player_pass_yds'], teams: ['Buffalo Bills', 'Kansas City Chiefs'], before: '2025-01-01' }, rows)[0];
  assert.equal(result.values.player_pass_yds.average, 250); assert.equal(result.values.player_pass_yds.games, 1);
  assert.equal(statValue({ carries: '0' }, 'rush_attempts', 'nfl'), 0);
  assert.equal(statValue({ points: '', rebounds: '2', assists: '3' }, 'PRA', 'nba'), null);
});
