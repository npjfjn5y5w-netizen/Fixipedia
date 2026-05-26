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

The public `Submit an Origin` form is the contributor-facing UI. It uses Netlify Forms under the `origin-submission` form name so maintainers can review submissions from the Netlify Forms dashboard without sending contributors to GitHub.

Enable form detection in Netlify, then configure submission notifications in the Netlify project settings if email alerts are desired. The browser submit handler posts the static form payload to Netlify and includes hidden catalog context when the submitted fix can be matched to a loaded NASR record.

The archive snapshot includes a public origin-lead tally powered by the Netlify Function at `/.netlify/functions/submission-count`. Configure these Netlify environment variables for the count to populate:

- `NETLIFY_AUTH_TOKEN`: a Netlify personal access token with access to the site forms.
- `NETLIFY_SITE_ID`: the Netlify site ID. Netlify may also provide `SITE_ID`; `NETLIFY_SITE_ID` is preferred for clarity.
- `NETLIFY_FORM_ID` optional: the exact form ID for `origin-submission` if automatic form lookup ever fails.

Approved name-origin notes should be added to `data/fixipedia-notes.js`, then committed and redeployed.

## Origin Story Publishing Workflow

Use this checklist whenever a new origin story comes in through Netlify Forms.

1. Open the Netlify project dashboard and go to **Forms**.
2. Open the `origin-submission` form.
3. Review the newest verified submission. Check:
   - `fixName`
   - `airport`
   - `procedure`
   - `originStory`
   - `notes`
   - hidden catalog fields such as `catalogIdentifier`, `catalogType`, and `catalogContext`
4. Confirm the submitted identifier exists in Fixipedia search. Use the hidden catalog fields first, then search the public site if needed.
5. Source-check the story before publishing. Use the submission as a lead, not final copy.
6. Rewrite the public note in your own words. Do not paste private details, sensitive details, or long copied text from the submission or another source.
7. Add or update the identifier in `data/fixipedia-notes.js`.
8. Save, commit, and push the change to GitHub.
9. Wait for Netlify to deploy the new commit.
10. Open the public site, search the identifier, and confirm the new origin note appears correctly.

Use this object shape when adding a reviewed note:

```js
IDENTIFIER: {
  namedAfter: "Short, public-facing explanation of who or what the identifier is named after.",
  confidence: "confirmed",
  archiveNote: "One or two sentences with helpful context for the public archive.",
  evidence: [
    "Source-backed fact that supports the origin."
  ],
  sources: [
    "Source name or URL"
  ],
  openQuestions: "Any remaining uncertainty, or 'None known.'"
}
```

Use `confidence: "confirmed"` when the source directly supports the origin. Use `confidence: "likely"` when the evidence is strong but not direct. Leave uncertain or unsupported submissions unpublished until they can be checked.
