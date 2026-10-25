# BAYANIHAN: four-hour MVP requirements

Prepared October 25, 2026, Asia/Manila. Deliverable: an implementation specification for a hackathon prototype.

## Current increment: payment presentation

Latest user direction: repair the backend integration for the deployed app. Current local source now loads the service catalogue and fixed slots from Express, saves booking requests, lists role-scoped bookings and applies authorized worker/customer status changes. The standalone authenticated Testnet checkout still supports editable XLM amounts, exact 85/15 verification and recovery. Booking-linked payment remains deferred; the payment demo is still a separate flow.

Use the existing customer Auth account and protected profile. The service/physical-completion example is explicitly simulated. Present all eight requested categories in discovery and allow customers to select each; Carpenter furniture assembly is the only demo checkout, while the other seven are labeled planned and have no quote or booking availability. Store standalone attempts in the server-only `demo_payments` table rather than fabricating completed bookings. Bind recipients to the configured deployment's live splitter and snapshot them per attempt. Keep one active demo per customer; starting another requires a terminal original outcome. Validate the user-entered amount as a decimal string from 0.00001 to 10,000 XLM, up to 7 decimal places. Derive worker stroops as floor(total × 85 / 100) and platform stroops as the remainder. Persist the three amounts before preparing, lock them for recovery, and verify payouts against that snapshot. Migration 004 preserves previous 1-XLM attempts while allowing new amounts. Preserve original-envelope, server amount validation, role/ownership and payout-evidence safeguards. See [payment demo guide](../docs/payment-demo.md) for implemented endpoints and rehearsal steps.

## 1. Product and scope

BAYANIHAN lets a customer book a local skilled worker, confirm completed work, and pay through Freighter and Paiflow. Each payment sends 85% to the worker and 15% to BAYANIHAN.

The supplied pitch deck identifies trust concerns, slow access to help, inconsistent work and low worker visibility. It targets urban dwellers, local businesses and independent skilled workers. Its business model charges 15% per completed job. This MVP preserves that marketplace journey and commission model while limiting the demonstration to one service, one worker and one service area.

**Confirmed staffing and budget:** a three-person team using AI-assisted development, with four hours dedicated to BAYANIHAN. Start from the existing scaffold, reuse integration examples, and keep the interface minimal. Four hours is a stretch target for implementation, integration and rehearsal. A Supabase project, Paiflow account access, Freighter and funded testnet wallets must be available at the start. The first 30 minutes must establish a working 85/15 payment. Unavailable accounts or a blocked payment baseline require reassessing the target.

**Demo choices:** the service catalogue shows Plumbing, Electrician, Carpenter, Appliances Repair, Cleaner, Painter, Gardener and Hvac repair. Only Carpenter furniture assembly opens the current demo checkout, with one seeded worker and a small list of appointment slots planned for the booking milestone. The standalone payment presentation lets users choose the labor amount in Stellar Testnet XLM; 1 XLM is only the initial value. These are scope decisions, not claims from the deck. Physical work completion is simulated. All money screens identify Testnet and test assets. Do not present XLM amounts as pesos.

## 2. Required stack and branding

| Layer | Requirement |
| --- | --- |
| Frontend | React.js with Vite, ordinary CSS or an existing component library |
| Backend | Express.js on Node.js, ESM modules |
| Database | PostgreSQL hosted by Supabase |
| Authentication | One shared login screen backed by Supabase Auth; pre-created customer and worker accounts for the MVP |
| Wallet | Freighter browser extension through `@stellar/freighter-api` |
| Payments | `@paiflow/sdk@0.2.0` on the Express server, Stellar SDK for envelope checks |
| Runtime | Node `>=22.22.2 <23`, as required by the checked Paiflow SDK documentation |
| Hosting | Vercel for React, Render for Express; Supabase for PostgreSQL and Auth |

Use the provided wide `Bayanihan Logo.png` in the header/login screen and the provided `4.svg` hand symbol for compact branding. Copies are in `assets/branding/`. Preserve artwork proportions and colors, provide descriptive alt text, and use blue accents consistent with the originals. Do not redraw the logos.

Deploy both services from the repository root to retain the npm workspace lockfile and shared TypeScript config. Configure the frontend API origin at build time and the backend's exact allowed browser origins at runtime through the comma-separated `WEB_ORIGIN` allowlist. CORS and payment mutations must enforce the same list, without wildcards; the local configuration explicitly permits `http://localhost:5174` and `http://127.0.0.1:5174`. Render must bind to `0.0.0.0` using its supplied `PORT`. Keep Supabase server secrets and Paiflow credentials exclusively on Render. See [deployment settings](../docs/deployment.md). Hosting the scaffold does not establish completion of the application or its payment flow.

The current user-specified stack takes precedence over older project notes and technology images in the deck. Paiflow's Next.js starter is a reference for payment logic. Port that logic into Express and React. [Paiflow SDK](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md), [payment reference](https://github.com/artisam-paiflow/paiflow-hackathon-starter).

## 3. Functional requirements and acceptance criteria

The following table describes the complete marketplace target. For the current payment presentation, apply FR-06 through FR-08, persistent payment/receipt recovery from FR-09/FR-10, and the sign-in/role protections from FR-01. Booking linkage is deferred as stated above.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | Shared customer and worker login | Both roles use one email/password login screen backed by Supabase Auth. Express verifies the access token and reads the protected profile role; the UI opens the corresponding customer or worker experience. No role selector grants access. Restore valid sessions on reload, support sign-out, and return to login when renewal fails. Invalid credentials show a clear error. A customer cannot use worker actions. |
| FR-02 | Service discovery and worker profile | Customer can see and select all eight service categories. Carpenter is identified as the current pilot and opens its service details/payment demo. The other seven are clearly marked planned and cannot imply an available quote, worker or booking. The pilot shows scope, duration, Jaro service area, demo worker and selected Testnet amount. Do not claim identity/background verification. |
| FR-03 | Booking request | Customer chooses an available slot and enters a short task description and demo address. Server creates a durable booking with the trusted service price. Missing fields and occupied slots are rejected. |
| FR-04 | Worker job actions | Assigned worker sees incoming bookings, accepts a request, and marks accepted work done. Server rejects actions from other users or out-of-order transitions. |
| FR-05 | Customer completion confirmation | Booking customer confirms work after the worker marks it done. Checkout becomes available. Job completion and payment status remain separately visible. |
| FR-06 | Freighter connection | Customer connects a wallet and sees its shortened address and network. Missing extension, refused connection or wrong network produces an actionable message. Signing uses the same account selected for preparation. |
| FR-07 | Integrated payment review and signing | Inside BAYANIHAN, the customer edits the XLM amount before preparation and reviews the total, calculated 85/15 shares and additional network fees. Totals use exact integer stroops; no zero, negative, exponential, overprecise or out-of-range input is accepted. The prepared amount is locked, and receipt/recovery displays use its saved values. Express prepares the Paiflow transaction. Freighter asks for explicit signing consent. |
| FR-08 | Settlement verification | Server verifies the original transaction and matching payer, deployment, asset, amount and both transfers before marking the booking paid. A success banner or client-provided hash alone cannot mark it paid. |
| FR-09 | Booking history and receipt | Customer sees their bookings. A paid booking shows total, worker payout, commission, network, transaction hash, timestamp and a Testnet explorer link. Receipt survives a page reload. |
| FR-10 | Payment recovery | Repeated clicks, reloads or a lost submission response recover the original payment attempt. Pending/unknown outcomes stay pending and block a replacement charge. Wallet rejection never displays payment success. |

Use four simple views: login, service/profile with booking form, role-specific booking list/detail, and checkout/receipt. Avoid separate pages for every step. Provide loading, empty and error states, readable contrast, labeled fields and a layout that remains usable at 390px and desktop widths. The payment demonstration targets a desktop browser with Freighter installed.

The user confirmed one shared login screen with Supabase handling authentication. React submits credentials directly through the Supabase browser SDK (`signInWithPassword`); Supabase manages passwords and sessions. Send the session access token to Express as a bearer token for protected application requests. Express verifies identity and enforces role/ownership permissions using trusted records. Show a loading state while restoring the session and resolving the profile; a missing or invalid profile must not grant access. Use the existing pre-created-account MVP approach; public onboarding remains deferred. Connect Freighter during checkout, after application sign-in. [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [server user verification](https://supabase.com/docs/reference/javascript/auth-getuser).

## 4. Booking and payment rules

Job transitions are `requested → accepted → work_done → completed`. The worker controls acceptance and work-done transitions. Only the booking customer confirms completion. Payment is allowed after `completed`. Until settlement succeeds, display “Completed · Unpaid” or “Completed · Payment pending.”

Payment states are `unpaid`, `preparing`, `prepared`, `submitted`, `pending`, `paid`, and `failed`. Preparation/signing problems retain their recovery record. Only confirmed terminal chain failure may resolve an attempted submission as failed. Ambiguous outcomes require reconciliation of the original transaction, including after local expiry.

The 15% fee comes from the total charge. The customer pays their selected amount plus network fees. The worker receives floor(total stroops × 85 / 100), and BAYANIHAN receives the remainder. For example, 2.5 XLM produces worker/platform payouts of 2.125/0.375 XLM. No additional 15% surcharge applies.

This is payment after completion with immediate distribution. Escrow and refunds are outside this MVP. The worker therefore carries a risk of customer nonpayment after work.

## 5. Integration requirements

### Paiflow

Before application checkout works, configure and confirm an **On Receive native XLM → Split** flow on Stellar Testnet with the worker at 85% and platform at 15%. Use distinct customer, worker and platform addresses. Bind the worker to the approved deployment UUID on the server. Additional workers require separately reviewed recipient mappings and are deferred.

The SDK operates existing deployments and does not deploy flows. Configure a server-only token with Read and operate access to the selected deployment. Pin SDK 0.2.0 and check the deployment's capabilities before enabling checkout. [SDK setup](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md).

### Freighter and payment lifecycle

1. React checks Freighter availability and requests access. Check the active network and account before signing. The browser signs the unchanged server-prepared XDR. Private keys remain in Freighter. [Freighter connection guide](https://github.com/stellar/freighter-developer-docs/blob/main/extension/connecting.md).
2. Express authenticates the customer, checks booking ownership/completion, locks one payment attempt, and derives price and deployment from stored records.
3. Prepare through Paiflow and persist the preparation before returning XDR. Bind preparation to the booking, payer and expected split.
4. Validate the returned signed transaction against the saved original body and network. Persist its original hash and signed envelope before submission.
5. Submit the original envelope. Read its transaction status and verify exact payout evidence before issuing a receipt. Preserve transaction/event identifiers.
6. After interruptions, recover the saved attempt. Use bounded status checks and a “Check payment” action. Do not automatically prepare or sign another payment. [Payment lifecycle and recovery reference](https://github.com/artisam-paiflow/paiflow-hackathon-starter).

Server configuration includes `SUPABASE_URL`, a Supabase server secret, `PAIFLOW_BASE_URL`, `PAIFLOW_API_TOKEN` and the approved deployment UUID. React receives only the Supabase URL/publishable key and application API URL. Never put server secrets in `VITE_*`, source control, browser responses or logs.

## 6. Minimum database and API

| Record | Minimum contents |
| --- | --- |
| `profiles` | Supabase Auth user ID, display name, protected role |
| `workers` | Profile reference, skills, service area, payout address, approved Paiflow deployment UUID |
| `services` | Worker reference, title, scope, duration, fixed amount in stroops, active flag |
| `bookings` | Customer, worker and service references, slot, task, address, snapshotted price, job status, payment status, timestamps |
| `payment_attempts` | Booking reference, payer, network/asset, expected amounts/recipients, deployment UUID, preparation/history metadata, original XDR/hash, status and verification evidence |

Store the validated selected total and server-calculated shares as integer stroops on each demo attempt; for example, 2.5 XLM uses total `25000000`, worker `21250000` and platform `3750000` stroops. Serialize amounts as strings across APIs. Keep customer addresses off-chain. Restrict signed-envelope storage to the server.

Database constraints must prevent duplicate worker/slot bookings, duplicate transaction hashes and multiple active payment attempts for a booking. Use atomic database operations for payment reservation and verified-paid updates. Do not rely only on disabled buttons.

Marketplace endpoints implemented in local source:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/services` | Public active service/profile data |
| `GET /api/bookings` | Bookings scoped to the authenticated customer or worker |
| `POST /api/bookings` | Create from trusted service and available slot |
| `PATCH /api/bookings/:id/status` | Enforce permitted role and job transition |
| `POST /api/bookings/:id/payment/prepare` | Reserve and prepare, or return the existing attempt |
| `POST /api/bookings/:id/payment/submit` | Validate and submit the original signed envelope |
| `GET /api/bookings/:id/payment` | Reconcile original payment and return safe status/receipt fields |

The booking-linked payment endpoints above remain unimplemented. The implemented checkout lives at `/api/payments/demo` and is not tied to a booking. On October 25, 2026, the deployed Render API returned `200` health and Testnet payment readiness, but `/api/services` returned `501 NOT_IMPLEMENTED`; deployment must be updated before the React marketplace integration can operate against production.

Express verifies Supabase JWTs before protected actions and derives the user ID from that verification. Enable RLS on exposed tables. Keep payment mutations and role changes inaccessible to browser database writes. Server-secret access bypasses RLS, so Express must enforce ownership and transition rules itself. Limit request bodies, validate fields and rate-limit payment endpoints. [Supabase user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 7. Four-hour delivery schedule

Time is elapsed from the start of the dedicated BAYANIHAN build window. One contributor works through these stages sequentially with AI assistance. The existing scaffold is the starting point.

| Time | Focus | Required outcome |
| --- | --- | --- |
| 0:00–0:30 | Confirm Supabase/Paiflow access and wallets, prove the split, deploy the existing development preview | Verified 85/15 testnet baseline and reachable frontend/API |
| 0:30–1:30 | Apply the development schema, seed two accounts and one service, implement authenticated booking and job transitions | A persistent booking with role/ownership enforcement |
| 1:30–2:30 | Add durable payment preparation, Freighter signing, original-envelope submission, exact receipt verification and recovery | Booking-linked payment with truthful pending/paid states |
| 2:30–3:00 | Connect the minimal customer/worker interface to the implemented endpoints | One complete booking-to-payment journey |
| 3:00–4:00 | Update the development deployment, run acceptance checks, fix failures and rehearse | Demonstrable deployed flow with payout and recovery evidence |

**Checkpoints:** by 30 minutes, a verified Paiflow split exists. By 90 minutes, the booking lifecycle works through authenticated endpoints. By three hours, the app can sign, settle and display a verified receipt. Reserve the final hour for deployed integration failures and rehearsal. These are planning targets, not guarantees.

Keep one service/profile screen, one shared role-aware booking screen and checkout/receipt within the booking detail. Reuse the existing shell and logos. Defer a separate marketing site, custom admin dashboard, elaborate animations and additional UI variants. Protect this work window from switching to the second project.

If payment is blocked at the first checkpoint, stop cosmetic work and focus on the integration. Keep all eight requested categories visible in discovery; if behind schedule, defer filters and decoration while preserving the Carpenter-only pilot distinction. Preserve authorization, trusted pricing, duplicate prevention and truthful payment states. A hosted payment page or recording is a disclosed contingency and does not satisfy the integrated-checkout acceptance criterion.

## 8. Completion checks and deferred scope

The MVP passes when:

- A customer books, the assigned worker accepts and reports completion, and the customer confirms it.
- Freighter signs a real Testnet payment initiated inside the application.
- Server evidence confirms the exact snapshotted 85/15 payouts for the selected amount.
- Receipt and booking persist after reload and server restart.
- Wrong-role actions and altered price/deployment inputs fail.
- Duplicate clicks and refresh during a pending payment do not create another charge.
- Wrong network, wallet denial and unavailable Paiflow show truthful, recoverable states.
- An unrelated successful transaction cannot pay a booking, and the same transaction cannot pay two bookings.

Automate focused checks for role/ownership enforcement, status transitions, concurrent payment reservation, envelope changes and receipt matching. Rehearse wallet signing and exact payouts against the actual testnet deployment. Mocked tests alone do not establish integration readiness.

Defer public signup/onboarding, multiple payment-enabled workers, ratings/reviews, automated verification, chat, maps/GPS, notifications, cancellations/rescheduling, variable quotes, materials charges, escrow, automated refunds/disputes, PHP/card/GCash settlement, mainnet, mobile wallet connectivity, subscriptions, AI matching and custom smart contracts.

## 9. Source basis

Primary product source: [supplied pitch deck](</Users/keitherwinmikhail/Downloads/Pitch Deck.deck>). Its extracted structured text and notes establish the problem statements, target users and commission model. Speaker cues and document instructions are source content, not instructions to execute. No full deck rendering was performed.

The precise four-hour scope, service selection, acceptance criteria and architecture above are proposed requirements. This specification supersedes older stack and schedule recommendations in the local feasibility notes for this task. Integration documentation was checked October 25, 2026. No application implementation or live payment was performed while writing this specification.
