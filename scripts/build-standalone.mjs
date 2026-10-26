import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputFile = resolve(root, process.argv[2] || 'standalone/VOIDRUN.html');

// Keep the normal deployment build untouched. The portable preview deliberately
// uses system fonts to avoid embedding several megabytes of font subsets.
const result = await build({
  configFile: false,
  root,
  base: './',
  publicDir: false,
  logLevel: 'warn',
  plugins: [{
    name: 'voidrun-portable-system-fonts',
    enforce: 'pre',
    transform(source, id) {
      if (id.split('?')[0] !== resolve(root, 'src/style.css')) return;
      return source.replace(/^@import\s+['"]@fontsource[^;]+;\s*$/gm, '');
    },
  }],
  build: {
    write: false,
    target: 'es2020',
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
});
assert.ok(!Array.isArray(result), 'expected one standalone bundle');
const outputs = result.output;
const htmlAsset = outputs.find(file => file.type === 'asset' && file.fileName.endsWith('.html'));
const scripts = outputs.filter(file => file.type === 'chunk');
const styles = outputs.filter(file => file.type === 'asset' && file.fileName.endsWith('.css'));
assert.ok(htmlAsset, 'Vite must emit HTML');
assert.equal(scripts.length, 1, 'standalone preview requires one self-contained script');
assert.equal(scripts[0].imports.length, 0, 'standalone script must not import other chunks');
assert.equal(scripts[0].dynamicImports.length, 0, 'standalone script must not dynamically import chunks');

const inlineScript = scripts[0].code.replace(/<\/script/gi, '<\\/script');
const inlineStyle = styles.map(file => String(file.source)).join('\n').replace(/<\/style/gi, '<\\/style');
const favicon = Buffer.from(await readFile(resolve(root, 'favicon.svg'))).toString('base64');
let html = String(htmlAsset.source)
  .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, '')
  .replace(/<link\b(?=[^>]*\brel=["'](?:stylesheet|modulepreload)["'])[^>]*>/gi, '')
  .replace(/<link\b(?=[^>]*\brel=["']icon["'])[^>]*>/gi, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${favicon}">`)
  // Replacement callbacks preserve literal $&, $` and $' in minified code.
  // A replacement string would interpret them and silently corrupt the bundle.
  .replace('</head>', () => `<style>${inlineStyle}</style>\n</head>`)
  .replace('</body>', () => `<script>${inlineScript}</script>\n</body>`);

const emittedScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.equal(emittedScript, inlineScript, 'HTML embedding must preserve every byte of the bundled script');
new Script(emittedScript, { filename: 'VOIDRUN.html:script' });

// Vite inlines the SVG favicon. Reject accidental external asset regressions.
assert.ok(!/<(?:script|link)\b[^>]*(?:src|href)=["'](?:\.?\.?\/|https?:)/i.test(html), 'HTML must not request external scripts or styles');
assert.ok(!/@import\b|url\(\s*["']?(?:\.?\.?\/|https?:)/i.test(inlineStyle), 'CSS must not request external assets');
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, html);
console.log(`Standalone game: ${outputFile} (${Buffer.byteLength(html).toLocaleString('en-US')} bytes)`);
