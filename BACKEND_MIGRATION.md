# Gemini Backend Migration — Vercel Serverless

## Architecture

Browser (React/Vite)
→ `POST /api/gemini`
→ Vercel Serverless Function
→ Google Gemini API

The browser no longer receives or transmits `GEMINI_API_KEY`.

## Install automatically

From the extracted migration package:

```powershell
node .\scripts\apply-backend-migration.mjs "D:\Antigravity\smart-investment-ai"
```

Then:

```powershell
cd "D:\Antigravity\smart-investment-ai"
npm install
npm run build
```

## Deploy with Vercel

1. Import the GitHub repository into Vercel.
2. Open **Project Settings → Environment Variables**.
3. Add:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional; recommended `gemini-2.5-flash`)
4. Redeploy.

Do not create `VITE_GEMINI_API_KEY`; variables prefixed with `VITE_` are embedded in the browser bundle.

## Local development

Install Vercel CLI:

```powershell
npm install -g vercel
```

Create `.env.local`:

```env
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.5-flash
```

Run frontend and API together:

```powershell
vercel dev
```

Using only `npm run dev` will start Vite but not the `/api/gemini` serverless endpoint.

## Security behavior

The function:
- accepts POST only,
- limits request body size,
- applies a model allowlist,
- forwards only approved Gemini request fields,
- keeps responses uncached,
- times out long requests,
- and never returns the API key.

## Important production hardening

For a public multi-user deployment, add authentication and rate limiting before launch. A hidden API key alone protects Google credentials, but an unauthenticated proxy can still be abused through your website endpoint.

Recommended next step:
- require user authentication,
- enforce per-user quotas,
- store usage server-side,
- and restrict allowed origins/custom domains.
