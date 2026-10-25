# Backend feature boundaries

- `marketplace/`: public eight-category catalogue with Carpenter pilot availability, fixed-slot discovery, trusted-price booking creation, customer/worker-scoped lists and role-checked job transitions.
- `payments/`: atomic reservation, server preparation, original-envelope validation, submission, payout verification and recovery.

The `payments/` module implements standalone authenticated Testnet checkout using `demo_payments`, original-envelope validation, exact transfer verification and recovery. Booking-linked payment routes remain deferred; standalone checkout is not bound to a booking. Payment secrets and signed-envelope recovery records must never reach public responses.
