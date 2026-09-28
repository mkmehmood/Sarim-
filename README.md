# Sarim — Gull & Zubair Naswar Dealers

Offline-first PWA (vanilla JS, SQLite/WASM, Firebase sync).

## Setup
```bash
npm install          # installs esbuild
```

## Commands
| Command | What it does |
|---|---|
| `npm run serve` | Serve the **source** at http://localhost:8080 |
| `npm run build` | Minify + hash into `dist/` |
| `npm run serve:dist` | Serve the production build |
| `npm test` | Run unit tests |
| `npm run verify` | Check all file references in `index.html` / `sw.js` |
| `npm run check` | verify + test + build + verify dist (used by CI) |

## Layout
```
index.html  sw.js  manifest.json  192.png  512.png  .well-known/   ← must stay at root (PWA scope)
modules/
  core/         constants, business, admin-data, sync
  utilities/    utilities-core, utilities-sales, utilities-payments
  customers/    factory/    rep-sales/
  ui/           app.css, custom-date-picker
  vendor/sqlite/  sql-wasm.js, sql-wasm.wasm, sql.js
```

## Adding / moving a module file
Update all of these, then run `npm run check`:
1. `<script>` tag in `index.html` (order matters)
2. `ASSETS_TO_CACHE` in `sw.js`
3. The file lists at the top of `build.js`
