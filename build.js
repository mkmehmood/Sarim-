import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFileSync, writeFileSync, copyFileSync,
  mkdirSync, unlinkSync, existsSync, cpSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT  = __dirname;
const DIST  = join(ROOT, 'dist');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

function run(args) {
  execFileSync(ESBUILD, args, { stdio: ['ignore', 'inherit', 'inherit'] });
}

function contentHash(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 8);
}

function write(filePath, content) { writeFileSync(filePath, content, 'utf8'); }

function read(filePath) { return readFileSync(filePath, 'utf8'); }

function rm(filePath) { if (existsSync(filePath)) unlinkSync(filePath); }

mkdirSync(DIST, { recursive: true });

const MODULES = join(ROOT, 'modules');
const M = p => join(MODULES, p);

// Load order matters — same order as the <script> tags in index.html.
const CORE_FILES = [
  'core/constants.js', 'core/business.js', 'core/admin-data.js',
  'core/sync.js', 'utilities/utilities-core.js', 'utilities/utilities-sales.js',
  'utilities/utilities-payments.js', 'customers/customers.js',
];

// Fail early with a clear message if any module file is missing.
for (const f of [...CORE_FILES, 'factory/factory.js', 'rep-sales/rep-sales.js', 'ui/app.css',
  'ui/custom-date-picker.js', 'vendor/sqlite/sql-wasm.js', 'vendor/sqlite/sql-wasm.wasm', 'vendor/sqlite/sql.js']) {
  if (!existsSync(M(f))) throw new Error('Missing module file: modules/' + f);
}

const coreTmp    = join(DIST, '_core.js');
const coreMinTmp = join(DIST, '_core_min.js');
write(coreTmp, CORE_FILES.map(f => read(M(f))).join('\n'));
run([coreTmp, '--bundle=false', '--minify', '--platform=browser', '--target=es2018', `--outfile=${coreMinTmp}`]);
const coreHash = contentHash(coreMinTmp);
const coreOut  = `app.${coreHash}.js`;
copyFileSync(coreMinTmp, join(DIST, coreOut));

const factoryMinTmp = join(DIST, '_factory_min.js');
run([M('factory/factory.js'), '--bundle=false', '--minify', '--platform=browser', '--target=es2018', `--outfile=${factoryMinTmp}`]);
const factoryHash = contentHash(factoryMinTmp);
const factoryOut  = `factory.${factoryHash}.js`;
copyFileSync(factoryMinTmp, join(DIST, factoryOut));

const repMinTmp = join(DIST, '_rep_min.js');
run([M('rep-sales/rep-sales.js'), '--bundle=false', '--minify', '--platform=browser', '--target=es2018', `--outfile=${repMinTmp}`]);
const repHash = contentHash(repMinTmp);
const repOut  = `rep-sales.${repHash}.js`;
copyFileSync(repMinTmp, join(DIST, repOut));

const cssMinTmp = join(DIST, '_app_min.css');
run([M('ui/app.css'), '--bundle=false', '--minify', `--outfile=${cssMinTmp}`]);
const cssHash = contentHash(cssMinTmp);
const cssOut  = `app.${cssHash}.css`;
copyFileSync(cssMinTmp, join(DIST, cssOut));

for (const t of [coreTmp, coreMinTmp, factoryMinTmp, repMinTmp, cssMinTmp]) rm(t);

for (const f of ['manifest.json','192.png','512.png']) {
  copyFileSync(join(ROOT, f), join(DIST, f));
}

// Hosting files that must be published alongside the app (GitHub Pages / Android app links).
if (existsSync(join(ROOT, '.nojekyll'))) copyFileSync(join(ROOT, '.nojekyll'), join(DIST, '.nojekyll'));
if (existsSync(join(ROOT, '.well-known'))) cpSync(join(ROOT, '.well-known'), join(DIST, '.well-known'), { recursive: true });

// Files that keep their module path in dist (referenced by runtime code / plain script tags).
const STATIC_MODULE_FILES = [
  'vendor/sqlite/sql-wasm.js', 'vendor/sqlite/sql-wasm.wasm', 'vendor/sqlite/sql.js',
  'ui/custom-date-picker.js',
];
for (const f of STATIC_MODULE_FILES) {
  const dest = join(DIST, 'modules', f);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(M(f), dest);
}

let html = read(join(ROOT, 'index.html'));

html = html.replace(
  '<link rel="preload" href="modules/core/admin-data.js" as="script">',
  `<link rel="preload" href="${coreOut}" as="script">`,
);
html = html.replace(
  '<link rel="stylesheet" href="modules/ui/app.css">',
  `<link rel="stylesheet" href="${cssOut}">`,
);

const lazyStub = `<script src="${coreOut}" defer></script>
<script>
(function(){
  var _fl=false,_rl=false;
  function _load(src,cb){var s=document.createElement('script');s.src=src;s.defer=true;s.onload=cb;s.onerror=cb;document.head.appendChild(s);}
  window._lazyLoadFactory=function(cb){if(_fl){if(cb)cb();return;}_load('${factoryOut}',function(){_fl=true;if(cb)cb();});};
  window._lazyLoadRep=function(cb){if(_rl){if(cb)cb();return;}_load('${repOut}',function(){_rl=true;if(cb)cb();});};
})();
</script>`;

const scriptBlock = [
  'core/constants.js', 'core/business.js', 'core/admin-data.js', 'core/sync.js',
  'utilities/utilities-core.js', 'utilities/utilities-sales.js', 'utilities/utilities-payments.js',
  'factory/factory.js', 'customers/customers.js', 'rep-sales/rep-sales.js',
].map(f => `<script src="modules/${f}" defer></script>`).join('\n');

if (!html.includes(scriptBlock)) {
  throw new Error('build: index.html script block does not match the module list in build.js');
}
html = html.replace(scriptBlock, lazyStub);

write(join(DIST, 'index.html'), html);

const ASSETS_TO_CACHE_BLOCK =
`const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './${cssOut}',
  './${coreOut}',
  './${factoryOut}',
  './${repOut}',
  './manifest.json',
  './192.png',
  './512.png',

  './modules/ui/custom-date-picker.js',
  './modules/vendor/sqlite/sql-wasm.js',
  './modules/vendor/sqlite/sql-wasm.wasm',
  './modules/vendor/sqlite/sql.js'
];`;

let sw = read(join(ROOT, 'sw.js'));
sw = sw.replace(/const BUILD_HASH = '[^']+';/, `const BUILD_HASH = 'sarim-${coreHash}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}';`);
sw = sw.replace(/const ASSETS_TO_CACHE = \[[\s\S]*?\];/, ASSETS_TO_CACHE_BLOCK);
write(join(DIST, 'sw.js'), sw);

const kb = f => (readFileSync(join(DIST, f)).length / 1024).toFixed(1);
console.log('\nBuild complete:\n');
console.log(`  ${coreOut.padEnd(40)} ${kb(coreOut)} KB  (core bundle)`);
console.log(`  ${factoryOut.padEnd(40)} ${kb(factoryOut)} KB  (lazy — factory tab)`);
console.log(`  ${repOut.padEnd(40)} ${kb(repOut)} KB  (lazy — rep tab)`);
console.log(`  ${cssOut.padEnd(40)} ${kb(cssOut)} KB  (styles)`);
console.log(`\n  SW cache key: sarim-${coreHash}`);
console.log(`  Output:       dist/\n`);
