// Static checks that need no server: every app script parses, and the service worker
// precaches exactly the stylesheets/scripts index.html loads (a missing file breaks offline start).
import fs from 'node:fs';
import vm from 'node:vm';

const pub = new URL('../public/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, pub), 'utf8');
const html = read('index.html');
const assets = [
  ...[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]),
].filter((f) => !/^https?:/.test(f));

let failed = 0;
const fail = (msg) => { failed++; console.log('FAIL ' + msg); };

for (const f of assets.filter((f) => f.endsWith('.js') && f.startsWith('js/'))) {
  try { new vm.Script(read(f), { filename: f }); } catch (e) { fail(`${f}: ${e.message}`); }
}
const sw = read('sw.js');
const cached = JSON.parse(sw.match(/const FILES=(\[[^\]]*\]);/)[1].replace(/'/g, '"'));
for (const f of assets) if (!cached.includes(f)) fail(`sw.js FILES is missing ${f}`);
for (const f of cached) if (/^(js|css)\//.test(f) && !assets.includes(f)) fail(`sw.js FILES lists ${f}, which index.html does not load`);
for (const f of cached) if (f !== './' && !fs.existsSync(new URL(f, pub))) fail(`sw.js FILES lists missing file ${f}`);

console.log(failed ? `${failed} problem(s)` : `ok — ${assets.length} assets, all parse and are precached`);
process.exit(failed ? 1 : 0);
