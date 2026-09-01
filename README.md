# IV Drip Rate

Nurse-facing mobile web app that watches an IV drip chamber through a phone's
rear camera and displays live drops/min and mL/hr — on-device, no video upload.

**Prototype. Not a medical device.** The persistent disclaimer copy in the
app itself is owned by the IV Clinical Safety agent; the placeholder currently
shipped in the header will be replaced by them in TEST-7.

## Production URL

<https://mayurvirkar.github.io/iv-drip-rate/>

The origin is stable — served from GitHub Pages, deployed by the Actions
workflow in `.github/workflows/deploy.yml` on every push to `main`.

## What ships right now (TEST-1)

- Vite + React + TypeScript scaffold.
- Portrait-primary layout: disclaimer slot → camera area (placeholder box)
  → compact stats bar (`drops/min`, `mL/hr`, `factor` — all dashes).
- Landscape re-flows so the camera still frames the chamber.
- No camera code yet — TEST-1 does not request permission. Camera capture
  lands in TEST-2, the aiming overlay in TEST-3, detection in TEST-4, rate
  math in TEST-5, drop-factor UI in TEST-6, and final safety copy /
  acceptance recipe in TEST-7.

**Why a dash instead of `0`:** a nurse reads `0 drops/min` as "the infusion
has stopped." Every stat therefore fails closed to `—` when there is no
signal.

## Stack choice: Vite + React (TS)

Picked once, will stay put for the whole project. Reasons:

- Pure client-side app — no SSR value, no server-side data, no routes to
  render. Next.js's SSR/RSC surface would be pure overhead.
- Vite's dev server has instant HMR and native `getUserMedia` support over
  HTTPS in production; local dev on `http://localhost:5173` also works
  because browsers permit camera on `localhost`.
- Small build output (~46 kB gzipped for the shell), which matters on a ward
  Wi-Fi.
- Static output deploys anywhere. GitHub Pages is our chosen host because
  the origin is stable across sessions, `gh` auth is already in the runner,
  and no third-party dashboard is needed.

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:5173/iv-drip-rate/
```

Camera capture will require HTTPS on the phone (production URL) or a
`localhost` origin during development.

To build against a different host, override the base path:

```bash
VITE_BASE=/ pnpm build
```

## Deploy

Every push to `main` triggers `.github/workflows/deploy.yml`, which builds
and publishes `dist/` to GitHub Pages. First-time setup on a fresh clone:
in the repo settings, set **Pages → Source: GitHub Actions** (this run does
that via the API).

Deploy hash and URL for each release are posted as the closing comment on
the TEST-1 issue.
