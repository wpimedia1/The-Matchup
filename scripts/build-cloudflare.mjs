import { mkdir, copyFile, readdir, writeFile, rm, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECURITY_HEADERS } from '../server/api.js';
const source = new URL('../public/', import.meta.url), output = new URL('../dist/cloudflare/', import.meta.url);
// Resolve and check the exact generated directory before removing stale build files.
const root = await realpath(new URL('../', import.meta.url));
const target = path.resolve(fileURLToPath(output));
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
if (await realpath(path.dirname(target)) !== path.join(root, 'dist')) throw new Error('Unexpected build directory.');
if (target !== path.join(root, 'dist', 'cloudflare')) throw new Error('Build output is outside the project.');
await rm(target, { recursive: true, force: true });
await mkdir(new URL('assets/', output), { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'domain.js', 'leagues.js', 'identities.js', 'sample.js', 'matchup.js']) {
  await copyFile(new URL(file, source), new URL(file, output));
}
for (const entry of await readdir(new URL('assets/', source), { withFileTypes: true })) {
  if (entry.isFile() && /^[a-z0-9-]+\.(png|jpg|webp|ttf|woff2)$/.test(entry.name)) {
    await copyFile(new URL(`assets/${entry.name}`, source), new URL(`assets/${entry.name}`, output));
  }
}
await writeFile(new URL('_headers', output), '/*\n' + Object.entries({ ...SECURITY_HEADERS,
  'Strict-Transport-Security': 'max-age=31536000' }).map(([key, value]) => `  ${key}: ${value}`).join('\n') + '\n');
console.log('Cloudflare assets built from the public-file allowlist; no environment files copied.');
