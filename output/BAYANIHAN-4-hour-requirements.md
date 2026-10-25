# BAYANIHAN: four-hour MVP requirements

Prepared October 25, 2026, Asia/Manila. Deliverable: an implementation specification for a hackathon prototype.

## 1. Product and scope

BAYANIHAN lets a customer book a local skilled worker, confirm completed work, and pay through Freighter and Paiflow. Each payment sends 85% to the worker and 15% to BAYANIHAN.

The supplied pitch deck identifies trust concerns, slow access to help, inconsistent work and low worker visibility. It targets urban dwellers, local businesses and independent skilled workers. Its business model charges 15% per completed job. This MVP preserves that marketplace journey and commission model while limiting the demonstration to one service, one worker and one service area.

**Confirmed staffing and budget:** one human contributor working with AI assistance, with four hours dedicated to BAYANIHAN. The user is building a second, separate project outside this workspace and budget. Start from the existing scaffold, reuse integration examples, and keep the interface minimal. Four hours is a stretch target for implementation, integration and rehearsal. A Supabase project, Paiflow account access, Freighter and funded testnet wallets must be available at the start. The first 30 minutes must establish a working 85/15 payment. Unavailable accounts or a blocked payment baseline require reassessing the target. This plan does not assume concurrent work by three contributors.

**Fixed demo choices:** one furniture-assembly service, one seeded worker, a small list of appointment slots, and a labor-only price of **1 Stellar Testnet XLM**. These are proposed scope decisions, not claims from the deck. Physical work completion is simulated. All money screens identify Testnet and test assets. Do not present XLM amounts as pesos.

## 2. Required stack and branding

| Layer | Requirement |
| --- | --- |
| Frontend | React.js with Vite, ordinary CSS or an existing component library |
| Backend | Express.js on Node.js, ESM modules |
| Database | PostgreSQL hosted by Supabase |
| Authentication | Supabase Auth with pre-created customer and worker accounts |
| Wallet | Freighter browser extension through `@stellar/freighter-api` |
| Payments | `@paiflow/sdk@0.2.0` on the Express server, Stellar SDK for envelope checks |
| Runtime | Node `>=22.22.2 <23`, as required by the checked Paiflow SDK documentation |

Use the provided wide `Bayanihan Logo.png` in the header/login screen and the provided `4.svg` hand symbol for compact branding. Copies are in `assets/branding/`. Preserve artwork proportions and colors, provide descriptive alt text, and use blue accents consistent with the originals. Do not redraw the logos.

The current user-specified stack takes precedence over older project notes and technology images in the deck. Paiflow's Next.js starter is a reference for payment logic. Port that logic into Express and React. [Paiflow SDK](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md), [payment reference](https://github.com/artisam-paiflow/paiflow-hackathon-starter).

## 3. Functional requirements and acceptance criteria

All requirements below are mandatory for the selected MVP.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | Customer and worker login | Each seeded account signs in through Supabase Auth. Express verifies its token and reads its server-controlled role. A customer cannot use worker actions. |
| FR-02 | Service and worker discovery | Customer sees the active service, scope, duration, service area, worker profile and 1-XLM demo price. Show a demo-profile label. Do not claim identity/background verification. |
| FR-03 | Booking request | Customer chooses an available slot and enters a short task description and demo address. Server creates a durable booking with the trusted service price. Missing fields and occupied slots are rejected. |
| FR-04 | Worker job actions | Assigned worker sees incoming bookings, accepts a request, and marks accepted work done. Server rejects actions from other users or out-of-order transitions. |
| FR-05 | Customer completion confirmation | Booking customer confirms work after the worker marks it done. Checkout becomes available. Job completion and payment status remain separately visible. |
| FR-06 | Freighter connection | Customer connects a wallet and sees its shortened address and network. Missing extension, refused connection or wrong network produces an actionable message. Signing uses the same account selected for preparation. |
| FR-07 | Integrated payment review and signing | Inside BAYANIHAN, customer reviews 1 XLM, worker 0.85 XLM, platform 0.15 XLM, and additional network fees. Express prepares the Paiflow transaction. Freighter asks for explicit signing consent. |
| FR-08 | Settlement verification | Server verifies the original transaction and matching payer, deployment, asset, amount and both transfers before marking the booking paid. A success banner or client-provided hash alone cannot mark it paid. |
| FR-09 | Booking history and receipt | Customer sees their bookings. A paid booking shows total, worker payout, commission, network, transaction hash, timestamp and a Testnet explorer link. Receipt survives a page reload. |
| FR-10 | Payment recovery | Repeated clicks, reloads or a lost submission response recover the original payment attempt. Pending/unknown outcomes stay pending and block a replacement charge. Wallet rejection never displays payment success. |

Use four simple views: login, service/profile with booking form, role-specific booking list/detail, and checkout/receipt. Avoid separate pages for every step. Provide loading, empty and error states, readable contrast, labeled fields and a layout that remains usable at 390px and desktop widths. The payment demonstration targets a desktop browser with Freighter installed.

## 4. Booking and payment rules

Job transitions are `requested → accepted → work_done → completed`. The worker controls acceptance and work-done transitions. Only the booking customer confirms completion. Payment is allowed after `completed`. Until settlement succeeds, display “Completed · Unpaid” or “Completed · Payment pending.”

Payment states are `unpaid`, `preparing`, `prepared`, `submitted`, `pending`, `paid`, and `failed`. Preparation/signing problems retain their recovery record. Only confirmed terminal chain failure may resolve an attempted submission as failed. Ambiguous outcomes require reconciliation of the original transaction, including after local expiry.

The 15% fee comes from the total charge. The customer pays 1 XLM plus network fees, the worker receives 0.85 XLM, and BAYANIHAN receives 0.15 XLM. No additional 15% surcharge applies.

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

Use integer amounts: total `10000000`, worker `8500000`, platform `1500000` stroops. Serialize amounts as strings across APIs. Keep customer addresses off-chain. Restrict signed-envelope storage to the server.

Database constraints must prevent duplicate worker/slot bookings, duplicate transaction hashes and multiple active payment attempts for a booking. Use atomic database operations for payment reservation and verified-paid updates. Do not rely only on disabled buttons.

Proposed application endpoints, to be built in Express:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/services` | Public active service/profile data |
| `GET /api/bookings` | Bookings scoped to the authenticated customer or worker |
| `POST /api/bookings` | Create from trusted service and available slot |
| `PATCH /api/bookings/:id/status` | Enforce permitted role and job transition |
| `POST /api/bookings/:id/payment/prepare` | Reserve and prepare, or return the existing attempt |
| `POST /api/bookings/:id/payment/submit` | Validate and submit the original signed envelope |
| `GET /api/bookings/:id/payment` | Reconcile original payment and return safe status/receipt fields |

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

If payment is blocked at the first checkpoint, stop cosmetic work and focus on the integration. If behind schedule, remove extra service cards, filters and decoration. Preserve authorization, trusted pricing, duplicate prevention and truthful payment states. A hosted payment page or recording is a disclosed contingency and does not satisfy the integrated-checkout acceptance criterion.

## 8. Completion checks and deferred scope

The MVP passes when:

- A customer books, the assigned worker accepts and reports completion, and the customer confirms it.
- Freighter signs a real Testnet payment initiated inside the application.
- Server evidence confirms 0.85 XLM to the worker and 0.15 XLM to the platform for that booking.
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
