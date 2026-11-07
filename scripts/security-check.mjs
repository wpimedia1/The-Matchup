import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Inspect the index, not just the working tree: these are the bytes Git commits.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
let secrets = [];
try {
  secrets = Object.entries(parseEnv(readFileSync('.env', 'utf8')))
    .filter(([key, value]) => /key|token|secret|password|odds_api/i.test(key) && value.length >= 8 && !/^(your_|example|placeholder)/i.test(value))
    .map(([, value]) => value);
} catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not safely inspect the local environment file.'); }
const signatures = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{35,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bODDS_API\s*[:=]\s*["']?[a-f0-9]{32}\b/i,
];
for (const file of files) {
  const name = file.split('/').at(-1);
  if ((/^\.env(?:\.|$)/.test(name) && name !== '.env.example') || /^\.dev\.vars(?:\.|$)/.test(name) || /\.(?:key|pem|p12|pfx)$/i.test(name)) {
    findings.push(`${file}: credential file must not be tracked`); continue;
  }
  const content = execFileSync('git', ['show', `:${file}`], { maxBuffer: 32 * 1024 * 1024 });
  if (secrets.some(secret => content.includes(Buffer.from(secret)))) findings.push(`${file}: matches a local secret value`);
  if (signatures.some(pattern => pattern.test(content.toString('utf8')))) findings.push(`${file}: possible credential signature`);
}
if (findings.length) {
  console.error('Security check failed (values intentionally redacted):\n' + findings.join('\n'));
  process.exitCode = 1;
} else console.log(`Security check passed: ${files.length} tracked files; no credential files, recognized tokens, or local secret values found.`);
