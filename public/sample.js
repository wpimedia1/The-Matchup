import { LEAGUES } from './leagues.js';

export const SAMPLE_AVERAGES = {
  'J. Allen': { player_pass_yds: 263.2, player_pass_tds: 1.8, player_rush_yds: 42.7 },
  'P. Mahomes': { player_pass_yds: 268.1, player_pass_tds: 2.1 },
  'J. Cook': { player_rush_yds: 76.4, player_anytime_td: 0.8 },
  'T. Kelce': { player_anytime_td: 0.5 },
  'LeBron James': { player_points: 26.8 }, 'Jayson Tatum': { player_points: 28.1 },
  'Anthony Davis': { player_rebounds: 12.4 },
};
export function sampleEvents(league) {
  const events = LEAGUES[league].sample();
  if (league !== 'nfl') return events;
  const sunday = new Date(); sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7)); sunday.setHours(13, 0, 0, 0);
  const matchups = [
    ['Detroit Lions', 'Chicago Bears', 2.5, 13, 0], ['Baltimore Ravens', 'Miami Dolphins', -4.5, 13, 0],
    ['San Francisco 49ers', 'Arizona Cardinals', -3, 16, 5], ['Dallas Cowboys', 'Los Angeles Rams', -3.5, 16, 25],
  ];
  const rail = matchups.map(([away_team, home_team, point, hour, minute], i) => {
    const date = new Date(sunday); date.setHours(hour, minute, 0, 0);
    return { id: `demo-${i}`, sport_key: LEAGUES.nfl.sport, away_team, home_team, commence_time: date.toISOString(),
      bookmakers: [{ key: 'sample', title: 'SampleBook', markets: [{ key: 'spreads', outcomes: [
        { name: away_team, point, price: -110 }, { name: home_team, point: -point, price: -110 },
      ] }] }] };
  });
  const date = new Date(sunday); date.setHours(16, 25, 0, 0); events[0].commence_time = date.toISOString();
  return [...rail, ...events];
}
export function sampleProps(league, game, markets) {
  const defs = structuredClone(LEAGUES[league].sampleProps);
  if (league === 'nfl') {
    defs.player_pass_tds = [{ d: 'J. Allen', o: [{ n: 'Over', p: 110, pt: 1.5 }, { n: 'Under', p: -130, pt: 1.5 }] }];
    defs.player_rush_yds = [{ d: 'J. Cook', o: [{ n: 'Over', p: -110, pt: 72.5 }, { n: 'Under', p: -110, pt: 72.5 }] }];
  }
  return { bookmakers: game.id === 's1' ? [{ title: 'SampleBook', markets: markets.filter(key => defs[key]).map(key => ({
    key, outcomes: defs[key].flatMap(player => player.o.map(quote => ({ name: quote.n, description: player.d, price: quote.p, point: quote.pt }))),
  })) }] : [] };
}
