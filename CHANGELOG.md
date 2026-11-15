# Changelog

## 3.1.2 — 2026-11-15

- Changed: shared interface kit refreshed — the button inside notifications gets a larger touch target (40 px). No change to the app's own logic or texts.

## 3.1.1 — 2026-11-15

- New: hyper-detailed fractal textures (fff-texturi 1.1.2) — the background and large surfaces (cards, panels, headers, buttons; tabs and dialogs that are hidden at load, once they open) get a locally generated material (WebGL2, no network, no images) that tiles seamlessly; the app keeps its own colours. Turn it off in the "Transparency" dialog or with `?notex=1`.

## 3.1.0 — 2026-11-14

- Interface in 8 languages (ro, en, fr, de, es, it, hu, pt): selector at the bottom of the home screen, language remembered, falls back to the browser language.
- Voice announcements, notifications and dates follow the chosen language.
- New test `tests/i18n.test.mjs` (no Romanian text left in the 7 translated languages); the older suites are pinned to Romanian.

## 3.0.0 — 2026-11-06

- Adopt the fff-kit, `#app-version`, metas, `app.json`.
- Replace `unsafe-inline` in `script-src` with SHA-256 hashes.
- Add kit test suite and axe-core verification (0 violations). Interface remains Romanian only.
