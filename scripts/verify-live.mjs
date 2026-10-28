import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

/** Check the published commit and its actual local assets, never an unrelated host. */
export async function verifyLive({ baseUrl, commit, buildLabel, attempts = 12, delayMs = 5000 }) {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
  assert.ok(['https:', 'http:'].includes(base.protocol)); assert.match(commit || '', /^[a-f0-9]{40}$/i, 'the expected commit is required');
  const request = async (url, method = 'GET') => {
    assert.equal(url.origin, base.origin, 'published assets must stay on the game origin');
    assert.ok(url.pathname.startsWith(base.pathname), 'published assets must stay under the game path');
    const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' });
    assert.ok(response.ok, `${response.status} ${url.pathname}`); return response;
  };
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const versionUrl = new URL('version.json', base); versionUrl.searchParams.set('verify', `${commit}-${Date.now()}`);
      const version = await (await request(versionUrl)).json(); assert.equal(version.commit, commit, 'Pages still serves a previous commit');
      const indexUrl = new URL(base); indexUrl.searchParams.set('verify', commit);
      const html = await (await request(indexUrl)).text();
      const links = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(match => new URL(match[1], base));
      assert.ok(links.some(url => url.pathname.endsWith('.js')) && links.some(url => url.pathname.endsWith('.css')), 'published HTML must reference the game bundle and styles');
      let scripts = '', checked = 0; const artUrls = new Set();
      for (const url of links) {
        const response = await request(url); checked++;
        if (url.pathname.endsWith('.js')) {
          const code = await response.text(); scripts += code;
          for (const match of code.matchAll(/["']((?:\.\/)?(?:assets\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:webp|hdr))["']/g)) {
            // Vite's relative base emits new URL("file.webp", import.meta.url).
            const assetBase = /^(?:\.\/)?assets\//.test(match[1]) ? base : url;
            artUrls.add(new URL(match[1], assetBase).href);
          }
        }
      }
      if (buildLabel) assert.ok(scripts.includes(buildLabel), 'published JavaScript still contains a previous build');
      assert.ok(artUrls.size >= 7, 'the published bundle must include the local PBR and environment assets');
      for (const url of artUrls) { await request(new URL(url), 'HEAD'); checked++; }
      return { commit, buildLabel, checked, artAssets: artUrls.size, url: base.href };
    } catch (error) { lastError = error; if (attempt + 1 < attempts) await delay(delayMs); }
  }
  throw lastError;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const buildLabel = source.match(/<b>(v[\d.]+)<\/b>/)?.[1];
  const result = await verifyLive({ baseUrl: process.env.GAME_URL || 'https://pms0402.github.io/pms/', commit: process.env.GITHUB_SHA || process.argv[2], buildLabel });
  console.log('PASS published VOIDRUN commit, build and local PBR assets', JSON.stringify(result));
}
