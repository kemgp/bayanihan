# BAYANIHAN

Payment-first local-services MVP using React, Express, Node.js and Supabase PostgreSQL. The current application demonstrates a standalone 1-XLM Stellar Testnet checkout through Freighter and Paiflow, with an 85/15 split. Read [MASTER.md](MASTER.md) first and [the requirements](output/BAYANIHAN-4-hour-requirements.md) for scope and acceptance criteria.

## Run locally

From the repository root:

```sh
nvm use
npm ci
npm run dev
```

Requires Node 22.22.2 (or a compatible Node 22 version `>=22.22.2 <23`). The Paiflow SDK requires that range. The root `.npmrc` enforces it. Use npm workspaces and the committed `package-lock.json` consistently.

- Web: http://127.0.0.1:5174
- API health: http://127.0.0.1:3002/api/health

Both processes start without credentials, with integration actions unavailable until configured. The frontend presents the branded payment checkout and shared account login. Vite forwards `/api` requests to Express. Stop both with Control+C. `npm run dev:web` and `npm run dev:api` run either process separately.

## Configure integrations

Copy each example once, without overwriting existing local configuration:

```sh
cp -n apps/web/.env.example apps/web/.env
cp -n apps/api/.env.example apps/api/.env
```

Fill the browser's Supabase URL/publishable key and the API's Supabase URL/server secret. Set the Paiflow origin, token and reviewed deployment UUID only in `apps/api/.env`. Restart development processes after changes. Never use a `VITE_*` name for a server secret.

Paiflow is pinned to `@paiflow/sdk@0.2.0`. No payment is prepared, signed or submitted on startup. The checkout implements Freighter signing, Paiflow preparation/submission, exact native-XLM transfer verification and persistent receipts/recovery. Follow [the payment presentation guide](docs/payment-demo.md) for migration 003, the Supabase **server secret** (not the publishable key), required wallet setup and the demo script. An actual user-signed in-app payment must still be rehearsed. [Paiflow SDK](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md).

Follow [database setup](supabase/README.md) before implementing persisted features. No remote resources are created by `npm ci`, `npm run dev` or `npm run build`.

## Structure

```text
.
├── AGENTS.md                  # Load MASTER.md every turn
├── MASTER.md                  # Current project decisions and status
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── features/      # auth, services, bookings, payments
│   │   │   ├── lib/           # API and browser Supabase clients
│   │   │   ├── App.tsx
│   │   │   └── styles.css
│   │   └── .env.example
│   └── api/
│       ├── src/
│       │   ├── config/        # Environment configuration
│       │   ├── lib/           # Server Supabase and Paiflow factories
│       │   ├── middleware/    # Supabase token verification
│       │   ├── modules/       # services, bookings, payments
│       │   ├── routes/        # Health and explicit unfinished routes
│       │   ├── app.ts
│       │   └── index.ts
│       └── .env.example
├── assets/branding/            # Original supplied logo files
├── supabase/
│   ├── migrations/            # Initial SQL schema, not applied remotely
│   └── seed.sql               # Empty until real demo users/wallets are known
└── output/                    # Requirements and earlier planning artifacts
```

TypeScript is used in both applications. The root config enables strict checking. Existing planning artifacts and logos are preserved.

## Payment API and deferred booking

`GET /api/health` returns process health only. It does not establish database or payment connectivity.

`GET /api/services` currently returns `501 NOT_IMPLEMENTED`. The booking/status/payment routes listed in the requirements require a Supabase bearer token and then return `501` until implemented. Missing authentication returns `401`. A token with missing Supabase configuration returns `503`. No unfinished endpoint returns a fabricated booking, receipt or payment success.

The implemented `/api/me` and `/api/payments/demo` endpoints verify the Supabase token, protected customer role and payment ownership. Demo payment mutations are rate limited and server-owned. See [payment API details](docs/payment-demo.md). The booking endpoints are separate placeholders and remain deferred; the standalone checkout does not fabricate a completed booking.

## Checks and production builds

```sh
npm run check
```

Runs strict type checking, API boundary tests, isolated PostgreSQL migration/seed checks and both production builds. Individual commands: `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`.

For demo account setup and the planned shared-login implementation, see [the authentication guide](docs/auth-implementation.md).

After building, `npm start --workspace @bayanihan/api` runs the API and `npm run preview --workspace @bayanihan/web` previews the web build. The selected hosting is Vercel for the frontend and Render for the API, with Supabase for PostgreSQL/Auth. Follow [the deployment guide](docs/deployment.md) for workspace commands, environment settings and smoke checks. Hosting success has not yet been verified.

Next implementation sequence: configure development integrations, implement service/booking handlers and role checks, add the customer/worker UI, then implement the durable prepare/sign/submit/verify/recover payment lifecycle. Use the acceptance criteria in the requirements.
