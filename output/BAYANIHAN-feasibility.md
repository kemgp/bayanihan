# BAYANIHAN: hackathon feasibility and implementation plan

Prepared October 24, 2026, Philippine Time. Planning only: no application, repository scaffold, payment flow, or installation was created or executed.

## Recommendation

Proceed with a narrow prototype: a customer books a local handyman, the worker accepts and reports completion, the customer confirms the work and pays, and Paiflow splits the payment 85% to that worker and 15% to BAYANIHAN. Use Stellar Testnet XLM throughout the demonstration.

This is feasible as a hackathon demonstration if the wallet and Paiflow deployment work before the event's main building sessions. Commercial viability remains a hypothesis: the materials describe a plausible problem and business model, but do not establish customer demand, acquisition costs, worker retention, or profitable operations.

The user confirmed that the hackathon team has three contributors and will use AI. This plan interprets that as AI-assisted development; an AI feature inside the product has not been requested. Scope assumptions: one service area in Iloilo, one payment-enabled worker initially, and a fixed demo service priced at 1 testnet XLM. Other displayed profiles must be clearly labeled demo data and must not lead to payments to the wrong worker.

## What the supplied files establish

The local Figma Slides `.deck` archive contains 11 slides. Its structured text, speaker notes and embedded images were inspected. No full Figma rendering was performed.

| Source | Findings | Implication |
| --- | --- | --- |
| Pitch Deck.deck | Trust concerns, slow access to help, inconsistent work and low visibility; urban dwellers, businesses and independent workers; 15% commission per completed job | Preserve the core marketplace and commission model; select a much narrower first customer segment |
| Embedded deck mockups | Eight categories: plumbing, electrical, carpentry, appliance repair, cleaning, painting, gardening and HVAC; repeated “Choose a Service” steps | Build one complete service journey rather than eight shallow categories; replace the repeated steps with a real booking sequence |
| Deck technology images | React, Node, Express, MongoDB and Vite, alongside other tools | These are proposed technologies, not a constraint. Reusing Paiflow's Next.js starter reduces integration work |
| paiflow-guide.pdf, steps 3-12 | Receive and Split, server SDK, browser wallet consent, original-transaction recovery, exact payout verification | An 85/15 adaptation is supported by the documented configurable split pattern, but must be tested against the team's deployment |
| event-primer.pdf | October 25, 2026; teams of 1-4; building 9:45-12:00 and 13:00-16:00 PHT; three-minute pitch/demo plus two-minute Q&A; testnet only | 5 hours 15 minutes of scheduled building time. Pre-event preparation is explicitly allowed |
| setup-guide.pdf | Windows/Git Bash setup, Node 22.22.2, pnpm 10.4.1, starter, Claude Code and Engr/Kimi | Use the accompanying macOS adaptation; these are instructions for future setup, not permission to execute them now |

The confirmed three-person team fits the event's team-size requirement. The files do not supply a scoring rubric, so this plan does not invent judging weights.

## A viable first product

**Initial customer:** tenants and small property managers in one compact service area who need scheduled minor repairs. **Initial supply:** a small, manually recruited group of workers with known skills and service areas. This is a proposed starting point, not market research already completed.

The useful promise is a clear job scope, confirmed appointment, visible worker identity, agreed labor price, and a receipt showing exactly what the worker and platform received. A payment receipt verifies money movement; it does not prove skill, identity, safe work, or actual completion. Those need an operational process.

Start with a narrow labor-only service, such as furniture assembly or an agreed minor repair. Show scope, exclusions, duration and price before booking. Handle uncertain repair costs through an approved quote before payment. Treat materials as separately agreed costs; the demo should exclude them so the 15% commission basis is unambiguous.

The deck already identifies mykuya and Urban Company. Their official sites confirm existing service-booking models, including matching and household trades. The opportunity is therefore a focused local operation with dependable service and transparent payouts, not a claim that service marketplaces are new. No claim is made about those companies' coverage in Iloilo. [mykuya](https://www.mykuya.com/) · [Urban Company](https://www.urbancompany.com/)

Paiflow's concrete role is automatic allocation of each payment and inspectable payout evidence. It reduces the need for a separate manual commission transfer. It does not solve worker availability, disputes, trust, nonpayment, or getting spendable pesos into a worker's hands.

## Business model and validation

Retain the deck's 15% commission on completed labor. Workers need to understand the net amount before accepting a booking. Make the platform fee visible to both sides.

Illustrative arithmetic only, not researched local prices or forecasts:

| Labor charge | Worker at 85% | Platform gross revenue at 15% |
| ---: | ---: | ---: |
| PHP 500 | PHP 425 | PHP 75 |
| PHP 1,000 | PHP 850 | PHP 150 |
| PHP 2,000 | PHP 1,700 | PHP 300 |

Gross commission is not profit. Contribution per job equals commission less payment/conversion costs, customer support, refunds or rework paid by the platform, incentives and variable acquisition costs. At a hypothetical PHP 1,000 labor charge and PHP 100 variable platform cost, contribution would be PHP 50 before fixed costs. The actual costs are unknown.

Practical pilot after the hackathon: interview about 10 target customers and 5 workers; recruit a few workers; manually coordinate roughly 20 jobs within one area. These are proposed learning targets, not evidence. Track request-to-acceptance rate, completion, punctuality, disputes, repeat bookings, worker take-home pay and contribution per job. Ask whether customers will book again and whether workers will keep paying 15% rather than moving repeat jobs off-platform.

The biggest commercial payment question is whether ordinary customers and workers will accept wallet onboarding and asset conversion. Keep the hackathon on testnet. A real pilot would need a separately validated checkout and settlement plan, including how people pay and receive pesos. USDC would require another asset-specific deployment, exact trustlines and funding; changing a label from XLM to PHP or USDC is not an integration.

## Scope that can be demonstrated

| Build for the event | Defer |
| --- | --- |
| Responsive service catalog with one live demo service | Nationwide coverage and many trades |
| Worker profile, agreed quote, date/time and short job description | Automated identity checks and background-screening integrations |
| Booking request and worker accept/complete controls | Live maps, dispatch optimization and chat |
| Customer confirmation and explicit payment review | Escrow, automatic refunds and dispute arbitration |
| Real Freighter signing and Paiflow 85/15 testnet split | Fiat on/off ramps and mainnet launch |
| Persistent booking/payment state and recovery | Subscriptions, loyalty, AI diagnosis and native mobile apps |
| Verified receipt with original hash and both payouts | Elaborate ratings and public worker onboarding |

Use fictional names and locations in the public demo. Seeded profile badges must say “demo” unless actual checks were performed. Payment credentials and actual wallet signatures should be real testnet operations. Simulated job completion must be described as simulated; an on-chain transaction does not establish that a physical repair happened.

## Payment timing and recipient routing

Recommended business sequence:

1. Customer chooses the service/worker and requests a time.
2. Worker accepts the scope and quote. The app reserves the slot.
3. Worker marks the work complete.
4. Customer confirms completion and reviews the agreed price.
5. Customer signs the testnet payment in Freighter.
6. Paiflow executes the configured split.
7. The server verifies the original transaction and both payouts before displaying “Paid.”

Keep job status separate from payment status. A completed job can remain unpaid or pending verification. Paying after completion preserves the deck's commission model and avoids sending money before the service, but leaves a risk that the customer refuses or cannot pay. This is an explicit MVP tradeoff.

Receive -> Split distributes money when payment executes. This plan uses no escrow, held balance or automatic refund. Paiflow documents more advanced flows, but their capabilities, consent and release rules need separate validation. An app “release” button alone cannot turn an immediate split into escrow.

**Demo flow:** native Testnet XLM, worker 85%, BAYANIHAN 15%. One 1-XLM payment should yield 0.85 XLM to the worker and 0.15 XLM to the platform. Network fees are additional. Use separate customer, worker and platform wallets for clear evidence; the worker or platform wallet can also be the deployer.

**Fixed recipients matter.** The described deployment stores its recipients. The documented execute call accepts payer and amount, not an arbitrary worker recipient. For the smallest MVP, enable payments for one worker. For a second worker, prepare a second confirmed deployment with that worker's address and the same platform address; add its grant to the token and map worker ID to deployment UUID on the server. Reuse each deployment across that worker's bookings. Never create a deployment per customer or accept a browser-supplied recipient/deployment override. The SDK operates existing deployments; flow creation is done in Paiflow.

## Implementation architecture

Use the official Next.js/TypeScript starter, retaining its original-envelope checks and recovery logic. Use one application with server routes rather than adding a separate Express service for this demo. Pin Node >=22.22.2 <23, pnpm 10.4.1 and @paiflow/sdk 0.2.0. [Starter](https://github.com/artisam-paiflow/paiflow-hackathon-starter) · [SDK reference](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md)

| Layer | Responsibility |
| --- | --- |
| React/Next.js browser UI | Service/profile pages, booking forms, worker actions, checkout review and receipt |
| Freighter browser integration | Customer network/account checks and explicit transaction signing |
| Next.js Node server routes | Session/ownership checks, trusted pricing, booking transitions, Paiflow SDK calls and receipt verification |
| Durable database | Users/roles, workers, services, appointments, quotes, payment attempts and transaction evidence |
| Paiflow deployment | Configured 85/15 payment rule on Stellar Testnet |
| Stellar evidence | Original transaction and transfers used to verify settlement |

For a laptop-only hackathon demo, SQLite on the laptop is the smallest durable storage choice. For a publicly hosted app, choose a persistent hosted database such as Postgres and test the selected host with Node 22 and its storage model. Do not assume a local SQLite file survives a serverless deployment. Use existing auth tooling or pre-created authenticated demo accounts; a client-side role dropdown is not authorization.

Conceptual records:

- `users`: ID, role, verified wallet address and wallet-verification state.
- `workers`: user ID, skills, service area, payout address and approved deployment mapping.
- `services`: worker ID, scope, duration and server-owned demo price.
- `bookings`: customer, worker, service, scheduled time, approved quote, job status and version.
- `payments`: booking ID, attempt ID, network, asset, deployment UUID, payer, integer amount, expected recipients/shares, preparation metadata, original transaction hash, signed envelope and verification status.
- `payment_evidence`: transaction result, unique event IDs, transfer evidence and verification time.

Store contact/address information off-chain. Store signed envelopes only in restricted server storage for recovery, never ordinary logs. Use integer stroop strings: 1 XLM is `10000000`; 85% is 8500 basis points and 15% is 1500. Preserve exact amounts and handle rounding deterministically if variable prices are added.

Proposed application routes, not claims about existing Paiflow endpoints:

| Route | Purpose |
| --- | --- |
| `POST /api/bookings` | Create booking from server-owned service/price; enforce slot availability |
| `POST /api/bookings/:id/accept` | Assigned worker accepts |
| `POST /api/bookings/:id/complete` | Assigned worker reports completion |
| `POST /api/bookings/:id/confirm` | Booking customer confirms work |
| `POST /api/bookings/:id/payment/prepare` | Lock booking and persist one original preparation |
| `POST /api/bookings/:id/payment/submit` | Validate and persist the original signed envelope, then submit |
| `GET /api/bookings/:id/payment` | Reconcile the saved hash and display verified or unresolved status |

Enforce transitions server-side. Use a transaction/lock to prevent competing preparations and double bookings; bind each transaction hash to one payment record. A retry is not permission to create another charge.

## Paiflow integration sequence

1. Create and confirm the team's native-XLM Receive -> Split deployment in Paiflow. Prove the expected 85/15 split on the hosted payment page before adapting the UI.
2. Create a Read and operate developer token with an explicit grant to that deployment. Configure the origin, deployment UUID and token only on the server. The UUID is neither the flow ID nor the C-prefixed contract address.
3. On preparation, authenticate the customer, verify wallet ownership, confirm the booking is payable, and derive amount/network/deployment from trusted records. Call `deployment.execute.prepare({ from, amount })`. Save the preparation before returning the unsigned XDR.
4. Show Testnet, the exact amount, recipients, split and fee. Freighter signs the original XDR using the server-provided network passphrase. Keep wallet secrets in Freighter.
5. On submission, recheck ownership and compare the signed transaction body to the saved preparation under that passphrase. Reject changed transactions or fee-bump wrappers. Persist the original signed envelope/hash before sending it.
6. Call `deployment.execute.submit({ signedXdr }, { wait: false, preparationRequestId })` using the saved preparation's history request ID.
7. Read `deployment.transactions.get(originalHash)` and `deployment.events.list({ txHash: originalHash, limit: 100 })`. Follow event pagination and deduplicate events. Require final SUCCESS, the intended deployment/trigger, payer, exact asset/amount and both matching payouts. Inspect chain transfer evidence if indexed events lag.
8. Mark paid only after that verifier passes. PENDING, UNKNOWN, NOT_FOUND, timeout and missing events remain unresolved. HTTP 200 alone is insufficient. Reload/check-payment actions recover the original record; they do not prepare another payment. Retain a confirmed failure and deliberately resolve its cause before another attempt.

The supplied guide explicitly requires durable order storage and receipt verification. The current starter README confirms that its browser recovery example does not provide customer authentication, a persistent order database, fulfilment or independent split verification. Those are application work, not features to assume are already supplied.

## Feasibility, timing and fallback

| Area | Assessment | Condition |
| --- | --- | --- |
| Customer and worker UI | Feasible | One service, one worker and fixed quote |
| Real Paiflow split | Feasible but must be rehearsed | Team access, confirmed deployment, funded wallets and working token |
| Durable booking/payment lifecycle | Feasible with preparation | Reuse starter; add storage and ownership checks early |
| Full open marketplace | Beyond this event's scope | Requires supply operations, real trust checks and dispute handling |
| Commercial launch | Not yet validated | Customer demand, positive contribution and usable local settlement |

Suggested ownership for the confirmed three-person team using AI-assisted development:

- Contributor 1: Paiflow deployment, wallet integration, payout verification and payment recovery.
- Contributor 2: booking database, authentication/ownership checks, scheduling and worker actions.
- Contributor 3: customer UI, pitch deck and demo coordination.

All three rehearse the complete journey and test the boundaries between their work. Contributor 1 owns payment failure cases; Contributor 2 owns booking and authorization checks; Contributor 3 owns the customer walkthrough and presentation timing. Cut extra categories before cutting recovery controls.

### Working with AI

The roles above are ownership areas, not a requirement to write all code manually. Use AI to draft UI components, database migrations, route handlers, realistic demo fixtures, focused tests and pitch copy. Each person reviews and integrates the work in their area. AI assistance can reduce implementation effort, but no specific speed multiplier is assumed.

Agree on booking states, database fields, route inputs/outputs and payment ownership before concurrent coding. Give each coding session the same short specification and current starter documentation. Use separate branches or worktrees with clear file ownership, and integrate small changes frequently. Avoid having multiple sessions independently rewrite the payment module or schema.

Build in this order: prove the unchanged starter payment; add a durable booking; connect that booking to the existing payment lifecycle; verify the split and recovery; then polish the UI. Instruct coding assistants to preserve original-envelope checks, trusted server pricing and unresolved-payment state. Check generated SDK calls against the actual pinned version and its examples.

Humans still need to configure accounts, review recipient addresses, approve wallet transactions, inspect payout evidence and rehearse the demo. AI-generated tests and attractive screens do not establish that a live payment works. Keep credentials out of prompts and committed files.

AI assistance makes a polished customer and worker experience a more reasonable target for this team, provided the integration baseline is working. After one complete booking/payment path passes, consider additional service cards, filters and a booking-history view. Enable another worker's checkout only after its recipient mapping and separate deployment are verified. Keep escrow, fiat settlement and automated worker verification outside the event scope.

Adding an AI chatbot or matching feature is a separate product decision. The hackathon's core demonstration remains booking a service and verifying the Paiflow payout.

**Before October 25:** complete setup, fund three wallets, confirm 85/15 deployment, record a hosted-page test hash, and get the starter payment working. Aim to have durable records and a minimal booking already in place if time permits. The assessment does not claim these steps have been completed.

| October 25, PHT | Work |
| --- | --- |
| 9:45-10:30 | Confirm integration baseline; finish booking records and role checks |
| 10:30-12:00 | Finish customer and worker happy path; connect payment |
| 13:00-14:15 | Verify payouts, duplicate prevention and interrupted-payment recovery |
| 14:15-15:00 | Fix failures; prepare a receipt and a clearly labeled backup recording |
| 15:00-16:00 | Freeze scope, rehearse the three-minute pitch, retain hashes and evidence |

This is a planning estimate, not a promise. If no Paiflow payment works by the end of the first 45 minutes, stop adding UI and seek integration help. A known-working hosted payment page can serve as an explicitly identified reduced-scope checkout fallback, but the app must still reconcile the payment before claiming a booking is paid. If verification is incomplete, show the raw confirmed transaction/payout evidence and describe the limitation honestly. A recorded demonstration is backup evidence, not a claim that a failed live transaction succeeded.

Critical checks: wrong network/account; unauthorized worker/customer actions; altered amount/recipient; repeated clicks; two customers taking the same slot; changed signed envelope; timeout after broadcast; refresh during pending status; delayed events; exact 0.85/0.15 payouts; token access removal; original transaction recovery. Avoid repeatedly testing the same successful path while leaving these failure cases unchecked.

## Pitch changes

The current 11-slide deck devotes space to technology, tools, team and a commercial-video placeholder. For the required three minutes, use four concise slides and the live app. Keep supporting detail in an appendix.

| Time | Content |
| --- | --- |
| 0:00-0:25 | Problem: finding a dependable local worker and agreeing to a clear job/price |
| 0:25-0:50 | Solution: book, accept, complete and pay; identify the initial service area |
| 0:50-1:10 | Stellar impact: customer-authorized payment and inspectable worker/platform transfers; future adoption is a hypothesis |
| 1:10-1:30 | Paiflow integration: the team's Receive -> Split flow, 85% worker / 15% platform |
| 1:30-3:00 | Demo booking and acceptance, simulate completion, sign payment and show both confirmed payouts |

Keep the deck's 15% commission. Replace generic trust claims with the specific checks actually performed. Replace the repeated “Choose a Service” mockup with “Choose service / Request schedule / Confirm completion and pay.” Remove the commercial-video placeholder from the timed presentation. Keep deployment UUID and transaction hashes available for Q&A.

Suggested positioning: **“BAYANIHAN helps customers book local handymen and gives workers a clear, verifiable payout after every completed job. Paiflow automatically sends 85% to the worker and 15% to the platform.”** For the demo, explicitly qualify all payments as testnet and job completion as simulated.

## Source notes

Primary supplied evidence: `/Users/keitherwinmikhail/Downloads/Pitch Deck.deck`; `/Users/keitherwinmikhail/Downloads/paiflow-guide.pdf` (14 actual pages); `/Users/keitherwinmikhail/Downloads/event-primer.pdf` (4 pages); `/Users/keitherwinmikhail/Downloads/setup-guide.pdf` (8 pages). Some PDF text extraction corrupts code punctuation; use the original rendered page or linked source code for executable snippets.

Current technical references checked October 24, 2026: [Paiflow starter](https://github.com/artisam-paiflow/paiflow-hackathon-starter), [SDK README](https://github.com/artisam-paiflow/paiflow/blob/develop/packages/sdk/README.md), [nvm](https://github.com/nvm-sh/nvm), [Claude Code setup](https://code.claude.com/docs/en/setup), [Engr](https://github.com/kimerran/engr). These references inform the plan; no live Paiflow transaction, installation or application test was performed for this assessment.
