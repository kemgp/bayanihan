# Payment presentation

The current release focuses on a standalone Testnet checkout. Booking, worker job actions and physical completion are outside this increment. Furniture assembly is a presentation example; the Freighter/Paiflow payment is real Testnet execution when signed by the user.

## Setup

1. Use Node 22.22.2 and run `npm ci` if dependencies are missing.
2. Apply migrations `20261025000100`, `20261025000200`, then `20261025000300_payment_demo.sql` and `20261025000400_variable_demo_amounts.sql` to the development Supabase project. Do not rerun the initial schema over existing tables. The third migration creates `demo_payments`; the fourth permits validated variable amounts and locks saved amounts. Existing accounts, bookings and payment amounts are preserved.
3. Create the two demo Auth accounts and assign profiles using `supabase/seeds/demo_profiles.sql` if not already done. Payment uses the customer account; the worker account cannot initiate checkout.
4. Put the Supabase **server secret**, beginning `sb_secret_`, in `apps/api/.env` as `SUPABASE_SECRET_KEY`. A legacy `service_role` JWT is also accepted. A publishable/anon key cannot read the protected tables. Keep the publishable key in `apps/web/.env`. Find keys under the project's Settings → API Keys. [Supabase key guide](https://supabase.com/docs/guides/getting-started/api-keys).
5. Keep the existing Paiflow base URL, token and deployment UUID in the API environment. No extra recipient environment variables are needed: Express checks the configured deployment and reads the live splitter's native asset, parent and two percentage recipients. It refuses unsupported/more complex flows.
6. Run `npm run dev`. Use `http://localhost:5174` or `http://127.0.0.1:5174` in the desktop browser where Freighter is installed. Local `WEB_ORIGIN` explicitly lists both, separated by a comma; CORS and payment checks use the same list. Restart the API after environment changes. If hosting separately, set `WEB_ORIGIN` to the exact frontend origin (or a comma-separated list of explicitly trusted origins) and `VITE_API_BASE_URL` to the API origin before building. The user reports a Vercel frontend and Render API; the Render API at `https://bayanihan-v9hm.onrender.com` responded to health and Paiflow readiness checks on October 25, 2026. Its marketplace service route returned 501, so the current booking integration still needs the API deployment refreshed. Follow [deployment settings](deployment.md).
7. Select Stellar Testnet in Freighter. Use a funded, ordinary single-key customer G-address distinct from both recipient wallets. No seed phrase or private key is entered into BAYANIHAN.

## Two-minute presentation

1. Open BAYANIHAN. Enter a payment amount, for example 2.5 XLM. Show the live 2.125-XLM worker / 0.375-XLM platform breakdown. The footer must report the Paiflow connection. Expand **Payment recipients & verification** to show the deployed wallets.
2. Sign in with the customer account. Supabase handles the password and session; Express reads the protected profile.
3. Click **Connect Freighter** and approve access. Click **Prepare payment**. This simulates/prepares without moving funds.
4. Click **Sign & pay 2.50 XLM** (the label follows the saved amount). The user reviews the transaction and additional fee in Freighter and approves the signature. The application submits the identical saved envelope through Paiflow.
5. The pending screen checks the original transaction up to six times, five seconds apart. **Check payment status** remains available afterward.
6. Show **Payment verified**, both exact payouts, ledger and timestamp. Open the Testnet explorer link for the original hash.
7. Reload. The same customer sees the saved payment and receipt. **Start another test payment** is available only after verified settlement, chain failure, or expiry established from covered chain history. Each new signed demo spends its selected test-XLM amount plus its fee. The saved amount stays locked until the attempt resolves; use Check payment status and then Start another test payment to choose a different amount. Earlier receipts remain in PostgreSQL; a receipt-history UI is deferred.

No agent has approved a Freighter signature or submitted funds as part of implementation. A successful unsigned preparation and existing public chain reads establish integration compatibility, not completion of the in-app signed journey.

## Payment integrity and recovery

The customer selects 0.00001–10,000 XLM with up to seven decimal places. Send it as a decimal string; the server validates it, converts to integer stroops without floating point, and derives both shares. Worker share rounds down to stroops and platform receives the remainder, matching the verified splitter order (worker first, platform last). Recipients, percentages and receipt status cannot be supplied by the browser. The three amounts are saved before preparation and cannot be changed on that attempt, even by a later request. The recipient mapping comes from the configured Paiflow deployment's live contract state: precisely one native-XLM splitter, two direct account recipients ordered at 8500/1500 basis points, no fixed payouts, cash-out or continuation. The snapshot is saved per attempt.

A unique active-customer index reserves a payment before preparation. The server saves the unsigned body/hash before returning it to the browser. It checks the contract's `deposit` call, payer, amount, single operation, source and finite expiry. A submitted envelope must retain the original Testnet hash and have a valid customer signature. An atomic prepared-to-pending update saves the signed envelope before Paiflow submission. Concurrent submits cannot create another transaction.

Only the server reads/writes `demo_payments`; RLS and grants prevent browser access. Signed envelopes never appear in API responses or application logs. Every protected operation verifies the Supabase token, protected customer role and attempt ownership. The local API limits authenticated demo requests to 40 per minute per user; multiple production instances would need a shared limiter.

Settlement uses the original hash on Stellar Testnet RPC, not a client-provided receipt hash or HTTP success. The included original envelope must match the stored hash/payer. Native-XLM token events must prove payer → trigger → splitter for the saved total and splitter → worker/platform for the two saved shares, with no extra recipient credit/debit or extra customer transfer. Paiflow's indexed percentage payout event alone is insufficient: its recipient `amount` fields can be zero because they represent configured fixed amounts.

- **Wallet refusal:** no success is shown; the prepared attempt remains available.
- **Wrong network/account:** change Freighter to Testnet and the original customer account before signing.
- **Lost response or restart:** sign in again and load the saved attempt. Check the original status. Unknown stays unresolved and blocks replacement.
- **Retry the saved transaction:** explicitly resubmits only the exact envelope already saved on the server. It never prepares another charge; Stellar cannot execute the same envelope twice.
- **Expired preparation:** check the original status. Expiry is terminal only if chain time passed the envelope bound and RPC retention covers the attempt's entire possible lifetime with no included transaction. Local time, a 404 or an upstream rejection alone never authorize a replacement.
- **Crashed preparation:** a reservation that never exposed an envelope can be resolved after two minutes. A late prepare response cannot overwrite a closed reservation or return it for signing.
- **Unverifiable original/split or history too old:** keep the attempt unresolved for manual investigation. Do not clear pending records to make another charge possible.

## API and validation

- `GET /api/payments/config`: public readiness and recipient addresses.
- `GET /api/me`: verified account's protected profile.
- `GET /api/payments/demo`: customer's current attempt, with unsigned XDR only while prepared.
- `POST /api/payments/demo/prepare`: body `{ "payer": "G...", "amountXlm": "2.5" }`. The response serializes `total`, `workerAmount` and `platformAmount` as stroop strings.
- `POST /api/payments/demo/:id/submit`: body `{ "signedXdr": "..." }`.
- `POST /api/payments/demo/:id/check`: reconcile original transaction.
- `POST /api/payments/demo/:id/retry`: explicit identical-envelope recovery.
- `POST /api/payments/demo/:id/new`: close a terminal attempt so the next demo can be prepared.

All endpoints except public configuration require `Authorization: Bearer <Supabase access token>`. Booking-linked endpoints remain unfinished.

Run `npm run check` for strict types, payment/API tests, isolated PostgreSQL checks and both builds. Automated fixtures cover concurrent reservation/submission, altered amount/signer/network, owner/role boundaries, lost responses, original-envelope retries, exact payouts, unrelated hashes and terminal recovery. SQL checks cover amount range/rounding/immutability, migration preservation of old attempts, fixed Testnet network, one active attempt, unique hashes and browser access restrictions. Mocked checks do not prove live signing; rehearse with Freighter before presenting.

References: [Paiflow SDK](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md), [Paiflow payment starter](https://github.com/artisam-paiflow/paiflow-hackathon-starter), [Freighter signing](https://github.com/stellar/freighter-developer-docs/blob/main/extension/signing.md).
