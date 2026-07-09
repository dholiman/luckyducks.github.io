# PieMinder Pro — Marketing Landing Page

Static HTML/CSS site for PieMinder Pro. Hosts the public marketing page,
Privacy Policy, Support / FAQ, and the Universal Links AASA file. No build
step, no JS framework, no package.json — just three HTML files and a
stylesheet.

Built and maintained by Dakota Holiman.

---

## File map

| File / dir | Purpose |
|---|---|
| `index.html` | Main marketing landing page |
| `privacy.html` | Privacy Policy — public URL required for App Store submission |
| `support.html` | Support page + FAQ — public URL required for App Store submission |
| `styles.css` | Single shared stylesheet for all three pages |
| `app/` | The calculator web app — deploys to `/pieminder/app/` |
| `apple-app-site-association` | Universal Links config — must be served at `/.well-known/apple-app-site-association` on the deployed domain |
| `assets/` | Images, OG card, favicons, fonts |
| `assets/fonts/` | Self-hosted display font drop zone (see `assets/fonts/README.md`) |
| `motion-audits/` | Internal motion / interaction snapshots — **not deployed** |
| `privacy-policy.md`, `support-page.md` | Original markdown drafts kept for source-edit convenience; the `.html` files are what gets shipped |

---

## Local preview

Static site, no build. The `pieminder/` folder is the site root (maps to
`/pieminder/` on the live domain); the calculator lives in `pieminder/app/`
(maps to `/pieminder/app/`).

To reproduce the real `/pieminder/` URL prefix locally, serve the parent
`Web/` directory:

```bash
cd Web
python3 -m http.server 8000
# then open http://localhost:8000/pieminder/
```

Internal links are clean relative paths (`app/index.html` from the landing
pages, `../index.html` back from the app), so they resolve identically in
local preview and on the deployed `/pieminder/` path.

---

## Pre-deploy checklist

Placeholders that **block App Store submission** if not resolved first:

- [x] ~~Replace `idXXXXXXXXX` (3× in `index.html`, 1× in `privacy.html`, 1× in `support.html`) with the real App Store ID~~ — done, App Store ID is `id6777173101`
- [ ] Replace `hello@example.com` (in `privacy.html` and `support.html`) with the real contact email
- [ ] Replace `XXXXXXXXXX` in `apple-app-site-association` with the 10-character Apple Developer Team ID
- [x] ~~Decide on production domain — many absolute URLs (`og:url`, AASA path matchers, web-app link target) depend on it~~ — done, hosted at `https://luckyducks.app/pieminder/`
- [ ] Confirm `assets/fonts/` either has the licensed Gelica files OR the CSS has been reverted to Google Fonts Fraunces (current state: Fraunces via CDN, no self-hosted fonts in use)

---

## Deploy notes

Things that aren't obvious from looking at the files:

### AASA file hosting

- Must live at `https://<your-domain>/.well-known/apple-app-site-association` — not in any subfolder.
- Must be served with `Content-Type: application/json` and **no `.json` extension** on the URL. The file in this folder intentionally has no extension; preserve that on deploy.
- Most static hosts support this:
  - **Netlify**: drop into `public/.well-known/` or set `_redirects`
  - **Vercel**: place under `public/.well-known/`
  - **Cloudflare Pages**: place under `public/.well-known/`
  - **GitHub Pages**: create `.well-known/apple-app-site-association` at the repo root
- Universal Links only activate when AASA is reachable on the **same domain** referenced in the iOS app's `Associated Domains` entitlement. If the production domain isn't decided yet, the entitlement and AASA both stay parked.

### URL pattern

The current AASA `components` rule matches `/pieminder/*`. Shared recipe
links must therefore live under that path on the production domain
(e.g. `https://<your-domain>/pieminder/?qty=4&size=12&...`). If the
landing page is deployed at the domain root and the web app at
`/pieminder/`, this works as designed — no AASA edits needed.

### Privacy & Support URLs

App Store Connect validates both URLs at submission time. They must
return HTTP 200 and resolve publicly (no auth wall) before the build can
be submitted for review.

---

## Dependencies

- **[Fraunces](https://fonts.google.com/specimen/Fraunces)** — display serif, loaded from Google Fonts CDN via `<link>` in each HTML head
- **[Inter](https://fonts.google.com/specimen/Inter)** — body sans, same CDN
- No JS framework, no bundler, no package manager

If you ever switch the display font to a self-hosted family (Gelica was a
previous attempt), drop the files into `assets/fonts/` and update the
`@font-face` block at the top of `styles.css`. See `assets/fonts/README.md`
for the expected filenames.

---

## Editing notes

- The floating nav is duplicated verbatim across `index.html`, `privacy.html`,
  and `support.html`. Keep them in sync — they all reference the same
  `.nav-brand`, `.nav-actions`, `.nav-btn-web`, `.nav-btn-app` classes
  defined once in `styles.css`. If you change one, change all three.
- The footer block (`PieMinder · Made by Dakota Holiman · © 2026` plus
  Privacy / Support links) is also duplicated across all three pages —
  same rule applies.
- `og-image.png` lives in `assets/` and is referenced by both the OG and
  Twitter meta tags in `index.html`. Privacy and Support pages
  intentionally omit OG tags — they're not primary share targets.
- The Hero section's phone-strip image is the visual centerpiece; it
  uses a viewport-bleed pattern (`width: 100vw; margin-left: calc(50% - 50vw)`)
  on mobile and a contained max-width on tablet+. If you swap the image,
  preserve roughly the same aspect ratio (≈4:1) or the bleed math will
  need adjustment.

---

## Relationship to the rest of the repo

```
PieMinder_Global/
├── APP-STORE-METADATA.md     ← submission metadata (single source of truth)
├── iOS/                      ← Xcode project + Privacy Manifest + setup doc
└── Web/
    └── pieminder/            ← site root, deploys to /pieminder/  (YOU ARE HERE)
        └── app/              ← calculator web app, deploys to /pieminder/app/
```

If you change the bundle ID, the App Store URL, or the contact email, do
a repo-wide grep — values appear in multiple files across both web and
iOS directories.
