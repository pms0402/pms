import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const html = await readFile(resolve(process.env.STANDALONE_FILE || 'standalone/VOIDRUN.html'), 'utf8');
const server = createServer((request, response) => {
  if (request.url === '/game') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  } else if (request.url === '/frame') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body><iframe id="game" sandbox="allow-scripts" style="width:1200px;height:950px"></iframe></body></html>');
  } else {
    // No companion script, stylesheet, font, or image is available to the game.
    response.writeHead(404).end('Not found');
  }
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));

  await page.goto(origin + '/game');
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'menu');
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
  await page.locator('#start-button').click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
  const before = await page.evaluate(() => window.__game.getDebugState().player);
  await page.keyboard.down('d');
  await page.evaluate(() => window.__game.stepForTest(0.3));
  await page.keyboard.up('d');
  const after = await page.evaluate(() => window.__game.getDebugState().player);
  assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > 1, 'keyboard movement must work in the standalone game');
  assert.deepEqual(errors, [], 'standalone game must not throw browser errors');
  assert.deepEqual(requests, [origin + '/game'], 'standalone game must request only its HTML document');
  console.log('PASS standalone HTML: WebGL scene, start, keyboard movement, no companion asset requests');

  await page.goto(origin + '/frame');
  await page.locator('#game').evaluate((element, body) => { element.srcdoc = body; }, html);
  const embedded = page.frameLocator('#game');
  await embedded.locator('#start-button').click();
  assert.equal(await embedded.locator('#game-canvas').evaluate(() => window.__game.state.phase), 'playing');
  assert.equal(await embedded.locator('#canvas-error').isVisible(), false);
  const frameBefore = await embedded.locator('#game-canvas').evaluate(() => window.__game.getDebugState().player);
  await page.keyboard.down('w');
  await embedded.locator('#game-canvas').evaluate(() => window.__game.stepForTest(0.3));
  await page.keyboard.up('w');
  const frameAfter = await embedded.locator('#game-canvas').evaluate(() => window.__game.getDebugState().player);
  assert.ok(Math.hypot(frameAfter[0] - frameBefore[0], frameAfter[2] - frameBefore[2]) > 1, 'keyboard movement must work in the opaque sandbox');
  await embedded.locator('#pause-button').click();
  assert.equal(await embedded.locator('#game-canvas').evaluate(() => window.__game.state.phase), 'paused');
  await embedded.locator('#resume').click();
  assert.equal(await embedded.locator('#game-canvas').evaluate(() => window.__game.state.phase), 'playing');
  assert.deepEqual(errors, [], 'opaque sandbox must not throw browser errors');
  assert.deepEqual(requests, [origin + '/game', origin + '/frame'], 'embedded game must not request companion assets');
  console.log('PASS sandbox srcdoc: WebGL, start, movement, pause/resume with allow-scripts and opaque origin');
} finally {
  await browser?.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
}
