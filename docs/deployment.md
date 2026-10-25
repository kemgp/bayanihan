# Deploy to Vercel and Render

Use the same Git repository for both services. Keep the root `package-lock.json`, workspace manifests and `tsconfig.base.json` available by building from the repository root. This guide deploys the payment-first application. Shared sign-in, standalone Freighter/Paiflow checkout, verification and recovery are implemented; booking remains deferred. Apply migration 003 and use a Supabase server secret before the live payment rehearsal.

## Render: Express API

Create a **Web Service** with these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root directory | Leave blank (repository root) |
| Build command | `npm ci --include=dev && npm run build --workspace @bayanihan/api` |
| Start command | `npm start --workspace @bayanihan/api` |
| Health check path | `/api/health` |

Set these environment variables in Render, copying secret values directly from your existing local API configuration without committing them:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `22.22.2` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `WEB_ORIGIN` | Your Vercel production origin, e.g. `https://your-web.vercel.app`, without a trailing slash |
| `SUPABASE_URL` | Existing Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-only `sb_secret_` key (or legacy `service_role`), never publishable/anon |
| `PAIFLOW_BASE_URL` | `https://beta.app.paiflow.xyz` |
| `PAIFLOW_API_TOKEN` | Existing server token |
| `PAIFLOW_DEPLOYMENT_ID` | Existing approved deployment UUID |
| `STELLAR_NETWORK` | `testnet` |

Let Render supply `PORT`; the API already reads it. `HOST=0.0.0.0` is required because the local default is `127.0.0.1`. `--include=dev` retains TypeScript for the build when `NODE_ENV=production` is set.

After deployment, open `https://your-api.onrender.com/api/health`. It checks process health only, not database access or settlement readiness. [Render web service documentation](https://render.com/docs/web-services), [Node version configuration](https://render.com/docs/node-version).

## Vercel: React frontend

Import the same repository with these settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (`.`) |
| Framework preset | Vite |
| Node.js version | `22.x` (must resolve to `>=22.22.2 <23` for the workspace install) |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build --workspace @bayanihan/web` |
| Output directory | `apps/web/dist` |

Set these browser variables before building:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Existing Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing public browser key |
| `VITE_API_BASE_URL` | Render service origin, e.g. `https://your-api.onrender.com` |

Do not append `/api` to `VITE_API_BASE_URL`: the client already supplies `/api/...`. The development Vite proxy does not run on Vercel. All `VITE_*` values are public; keep Supabase server secrets and Paiflow credentials on Render only. Rebuild/redeploy after changing browser variables. [Vercel build documentation](https://vercel.com/docs/builds).

## Connect and verify

1. Set Render's `WEB_ORIGIN` to the actual Vercel production origin and redeploy the API. It accepts one configured browser origin; a distinct preview URL requires its own matching configuration.
2. Set Vercel's `VITE_API_BASE_URL` to the actual Render origin and redeploy the frontend.
3. Configure the Supabase Auth Site URL to the Vercel production URL. Add exact redirect URLs when implementing email confirmation, recovery or other redirect-based Auth flows.
4. Load Vercel and confirm the checkout reports Paiflow connected. Verify `/api/payments/config` returns Testnet readiness without CORS errors, then sign in and confirm the current customer payment can be loaded from Supabase.
5. Follow [the payment presentation script](payment-demo.md) for a user-approved Freighter signature, exact 0.85/0.15-XLM payouts, reload recovery and receipt. Health/readiness alone does not prove settlement. Booking endpoints remain explicitly unfinished.

Run `npm run check` locally before deploying. Record the real hosted URLs and observed checks in `MASTER.md` once available. Never copy local `.env` files into Git.
