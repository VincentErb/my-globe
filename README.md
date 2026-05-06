![Deploy](https://github.com/VincentErb/my-globe/actions/workflows/deploy.yml/badge.svg)

# 🌍 MyGlobe

An embeddable interactive 3D globe for pinning places. Built with Three.js.


## Features

- **Sessions** — each globe is a separate session with its own URL (`/SESSION_ID`)
- **Right-click** anywhere on the globe to drop a pin (message + date)
- **Click a pin** to view details or delete it
- **Embeddable** as an `<iframe>` with a transparent background
- Edit mode unlocked via URL: `/<SESSION_ID>?key=YOUR_EDIT_KEY`

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | Vite + Three.js |
| Database | Supabase (Postgres + Edge Functions) |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.example .env

# 3. Start dev server
npm run dev
```

Visit `http://localhost:5173/` to create a session, or `http://localhost:5173/SESSION_ID` to open one.

## Database setup

Run `supabase/schema.sql` in the Supabase SQL editor, then deploy the two Edge Functions:

```bash
npx supabase functions deploy session
npx supabase functions deploy pin
```

## Deployment

Pushes to `main` trigger the GitHub Actions workflow which builds and deploys to Vercel.

**Required GitHub secrets:**

| Secret | Where to find it |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `npx vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `npx vercel link` |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | Supabase dashboard → Project Settings → General → Reference ID |
| `VITE_SUPABASE_URL` | `https://YOUR_REF_ID.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `VITE_EDGE_BASE_URL` | `https://YOUR_REF_ID.supabase.co/functions/v1` |

Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_EDGE_BASE_URL`) are set in the Vercel dashboard and pulled automatically at build time.

## Embedding

```html
<iframe
  src="https://your-globe.vercel.app/SESSION_ID"
  style="width:820px; height:820px; border:none; background:transparent;"
  allowtransparency="true">
</iframe>
```
