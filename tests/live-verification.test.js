import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { verifyLive } from '../scripts/verify-live.mjs';

async function fixture(run, { old = false, external = false, moduleRelative = false } = {}) {
  const sha = 'a'.repeat(40), requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url); const path = new URL(request.url, 'http://localhost').pathname;
    if (path.endsWith('version.json')) response.end(JSON.stringify({ commit: old ? 'b'.repeat(40) : sha }));
    else if (path === '/pms/') response.end(`<script src="${external ? 'https://unrelated.invalid/game.js' : './assets/game.js'}"></script><link rel="stylesheet" href="./assets/style.css">`);
    else if (path.endsWith('game.js')) response.end('const build="v0.11.0";' + Array.from({ length: 7 }, (_, i) => moduleRelative ? `const image${i}=new URL("photo-${i}.webp",import.meta.url).href;` : `const image${i}="./assets/photo-${i}.webp";`).join(''));
    else response.end('asset');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run({ baseUrl: `http://127.0.0.1:${server.address().port}/pms/`, commit: sha, buildLabel: 'v0.11.0', attempts: 1, delayMs: 0 }, requests); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('live verification checks the exact deployed version and every bundled art URL', async () => {
  await fixture(async (options, requests) => { const result = await verifyLive(options); assert.equal(result.artAssets, 7); assert.equal(result.commit, options.commit); assert.equal(requests.filter(url => url.includes('photo-')).length, 7); });
});
test('a successful HTTP response containing an old commit does not pass deployment checks', async () => {
  await fixture(async options => { await assert.rejects(verifyLive(options), /previous commit/); }, { old: true });
});
test('Vite import.meta.url assets resolve relative to the JavaScript bundle', async () => {
  await fixture(async (options, requests) => { const result = await verifyLive(options); assert.equal(result.artAssets, 7); assert.ok(requests.filter(url => url.includes('photo-')).every(url => url.startsWith('/pms/assets/'))); }, { moduleRelative: true });
});
test('deployment verification refuses unexpected external asset hosts', async () => {
  await fixture(async options => { await assert.rejects(verifyLive(options), /game origin/); }, { external: true });
});
