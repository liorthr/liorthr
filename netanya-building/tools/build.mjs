// Construit un fichier HTML autonome (three.js inclus, aucune dépendance réseau).
// Usage : node tools/build.mjs   (nécessite `npm i three@0.170.0 esbuild` dans tools/)
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', write: false,
  nodePaths: [join(root, 'tools/node_modules')],
  loader: { '.json': 'json', '.jpg': 'dataurl' }, legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(join(root, 'src/template.html'), 'utf8').replace('/*__BUNDLE__*/', () => js);
writeFileSync(join(root, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0), 'Ko');
