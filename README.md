# Fixipedia

Fixipedia is a static aviation reference prototype for searching FAA NASR airports, waypoints, and navaids, then documenting what each identifier or facility name is named after.

## Canonical Deploy Files

The repository root is the deploy package. Upload or publish this folder directly; there is no separate GitHub upload folder to maintain.

- `index.html`
- `styles.css`
- `app.js`
- `netlify.toml`
- `data/nasr-meta.js`
- `data/nasr-manifest.js`
- `data/fixipedia-notes.js`
- `data/nasr-navaids.js`
- `airport-data/nasr-airports-*.js`
- `waypoint-data/nasr-waypoints-*.js`

These are the only generated NASR browser bundles the site currently loads. The app loads the small metadata, reviewed notes, and navaid files up front, then lazy-loads airport and waypoint chunks when search or filters need them.

## OpenNav-Style Record Pages

Fixipedia supports shareable catalog pages such as:

- `/waypoint/US/MANDD`
- `/airport/KORD`
- `/navaid/US/ORD`

On Netlify, `netlify.toml` rewrites those clean URLs back to `index.html`, and the browser app loads the matching NASR record. If you publish somewhere other than Netlify, add equivalent rewrites for `/airport/*`, `/waypoint/*`, and `/navaid/*` to serve `index.html`.

## Ignored Local Data

The root `data/` folder may contain raw FAA downloads and older generated experiment files while developing locally. These are not part of the GitHub Pages deploy:

- `data/raw/`
- `data/nasr-catalog.js`
- `data/nasr-airports.js`
- `data/nasr-waypoints.js`
- `airport-data/nasr-airports.js`
- `waypoint-data/nasr-waypoints.js`

Those files are ignored by Git. If they appear locally, treat them as disposable importer output, not canonical site files.

## Local NASR Import

The importer script can regenerate the split NASR catalog files from extracted FAA CSV files:

```bash
node scripts/import-nasr.js
```

The importer writes the NASR deploy files listed above and removes known stale generated bundles from older layouts. It does not write `data/fixipedia-notes.js`; reviewed name-origin notes are maintained by hand after source review.

The raw FAA subscription files are ignored because they are large and not needed by the browser.

## Submission Review Queue

The public `Submit an Origin` form is the contributor-facing UI. It opens a structured review item in GitHub Issues so maintainers can moderate submissions without making GitHub the primary website experience. After creating your GitHub repo, update `GITHUB_ISSUE_URL` near the top of `app.js`:

```js
const GITHUB_ISSUE_URL = "https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/issues/new";
```

Approved name-origin notes should be added to `data/fixipedia-notes.js`, then committed and redeployed.
