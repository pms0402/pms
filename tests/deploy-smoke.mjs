import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const dist = resolve(process.env.DIST_DIR || 'dist');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');
assert.match(html, /(?:src|href)="\.\/assets\//, 'build assets must use relative URLs');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname.startsWith('/pms/') ? pathname.slice(5) : pathname.slice(1);
    const file = resolve(dist, relative || 'index.html');
    if (file !== dist && !file.startsWith(dist + sep)) {
      response.writeHead(403).end(); return;
    }
    if (!(await stat(file)).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolveListening => server.listen(0, '127.0.0.1', resolveListening));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  for (const pathname of ['/', '/pms/']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    const badResponses = [];
    const externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('request', request => { if (!request.url().startsWith(origin + '/')) externalRequests.push(request.url()); });
    await page.goto(origin + pathname);
    await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => window.__game.state.phase), 'menu');
    assert.equal(await page.locator('#canvas-error').isVisible(), false);
    await page.locator('#start-button').click();
    assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
    assert.equal(await page.locator('#live-hud').isVisible(), true);
    assert.deepEqual(errors, [], `no script or request failures at ${pathname}`);
    assert.deepEqual(badResponses, [], `all static assets resolve at ${pathname}`);
    assert.deepEqual(externalRequests, [], 'the deployed app must not require external font/art services');
    console.log(`PASS static deployment ${pathname}: local JS/CSS/fonts, WebGL scene and playable start`);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
}
