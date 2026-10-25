# Frontend feature boundaries

- `auth/`: seeded account login and session handling.
- `services/`: service/profile display and booking form.
- `bookings/`: customer/worker lists and permitted job actions.
- `payments/`: Freighter connection, payment review, original-transaction recovery and receipts.

The payment folder contains the API and Freighter adapters. Shared sign-in, checkout, pending recovery and receipt views currently live in `App.tsx`; marketplace services/bookings remain deferred. Keep Paiflow credentials and server logic in `apps/api`.
