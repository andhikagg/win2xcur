# AGENTS.md

## What this is

Node.js (ESM) port of the Python tool `quantum5/win2xcur` — converts cursor themes between Windows (`.cur`/`.ani`) and Xcursor. Image processing uses `sharp` (libvips).

- CLI entrypoints: `src/cli/*.js` (win2xcur, x2wincur, win2xcurtheme, x2wincurtheme, inspectcur, start).
- Library: `src/lib/` (parsers, writers, scale, shadow, align, theme, utils, logger).
- `python/` is the original Python source (gitignored) **reference only** — never treat it as the running source of truth.

## Commands

- Run all tests: `npm test` (= `node --test`, auto-discovers `test/*.test.js`).
- Run one test file: `node --test test/parser.test.js`.
- Run a CLI: `npm run win2xcur -- plana/... -o out`, `npm run inspectcur -- file.cur`, etc.
- No lint or typecheck is configured.

## Test gotchas

- Tests read fixtures from `test/plana/` (`.cur`, `.ani`, `install.inf`). Never delete that folder.
- Round-trip tests convert `Person.cur` (42×42, hotspot [10,9]) and `Normal.ani` (16 frames, 0.1s delay) — keep those fixtures stable.

## Toolchain quirks (verify before writing code)

- **sharp `.metadata()` returns INPUT dimensions, not pipeline output.** After any resize/extend/extract you must render to learn real size: `const { info } = await img.toBuffer({ resolveWithObject: true })`. This is already done in `scale.js`/`align.js` — keep it.
- **commander coercers with a default get the default passed as the 2nd arg.** `parseInt('100', 50)` → `NaN`; `parseFloat` is safe (ignores 2nd arg). For int options use `v => parseInt(v, 10)`.
- **Name collisions across modules:** `scale.js`, `shadow.js`, and `align.js` all export `applyToFrames`; re-exporting them via `index.js` silently drops later ones. Import directly from the specific module file instead of relying on the barrel.

## Layout / wiring

- Cursor format mapping lives in `src/lib/theme.js` (`XCURSOR_ALIASES`, `WIN_CURSORS`).
- Parsers: `src/lib/parser/{index,cursor,cur,ani,xcursor,inf,xtheme,base}.js`; `openBlob()` selects parser by magic bytes.
- Writers: `src/lib/writer/{x11,windows,inf}.js` (`toX11`, `toCur/toAni/toSmart`, `exportWindowsTheme`).
- `index.js` (root) is the public package barrel.

## Git / CI

- `.gitignore` intentionally ignores `node_modules/`, `python/`, `temp/`, `build/lib/`. Do NOT rename `src/lib` or the pattern `lib/` back to a global ignore — it must stay `build/lib/` or `src/lib/` won't be committed.
- CI: `.github/workflows/build.yml` runs `npm ci` + `npm test` on Node 18/20/22. The workflow was rewritten for Node (the upstream Python build must not be restored).
- Default branch is `master`.