import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import './build.mjs';

// Reuse the game itself: the website opens directly into the playable world.
const root = new URL('./', import.meta.url);
const result = await build({
  entryPoints: [new URL('src/main.js', root).pathname],
  bundle: true, write: false, format: 'iife', minify: true,
  target: 'es2022', legalComments: 'inline', charset: 'utf8',
});
const code = result.outputFiles[0].text;
const css = await readFile(new URL('style.css', root), 'utf8');
const emblem = await readFile(new URL('assets/emblem.svg', root), 'utf8');
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
let html = await readFile(new URL('index.html', root), 'utf8');
html = html.replace('./src/main.js', './game.js');
await writeFile(new URL('dist/game.js', root), code);
const digest=createHash('sha256').update(code).digest('hex');
await writeFile(new URL('dist/index.html', root), html.replace('./game.js', './game.js?v='+digest.slice(0,12)).replace('./style.css', './style.css?v='+pkg.version));
const portraits=await readFile(new URL('assets/portraits/characters.png',root));
const portable = html
  .replace('<link rel="preload" as="image" href="./assets/portraits/characters.png">', '')
  .replace('<link rel="stylesheet" href="./style.css">', () => '<style>' + css + '</style>')
  .replaceAll('./assets/portraits/characters.png', 'data:image/png;base64,'+portraits.toString('base64'))
  .replaceAll('./assets/emblem.svg', 'data:image/svg+xml;base64,' + Buffer.from(emblem).toString('base64'))
  .replace('<script type="module" src="./game.js"></script>', () => '<script>' + code.replaceAll('</script', '<\\/script') + '</script>');
await writeFile(new URL('dist/ELDERMERE.html', root), portable);
await writeFile(new URL('dist/version.json', root), JSON.stringify({
  game: 'ELDERMERE', version: pkg.version, commit: process.env.GITHUB_SHA || null,
  entrySha256: createHash('sha256').update(code).digest('hex'),
}, null, 2) + '\n');
console.log('Website ready: dist/index.html; single-file playable edition: dist/ELDERMERE.html');
