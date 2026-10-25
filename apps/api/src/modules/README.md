# Backend feature boundaries

- `services/`: public service/profile queries, returning only safe display data.
- `bookings/`: trusted pricing, fixed-slot validation, ownership/role checks and job transitions.
- `payments/`: atomic reservation, server preparation, original-envelope validation, submission, payout verification and recovery.

The `payments/` module implements standalone authenticated Testnet checkout using `demo_payments`, original-envelope validation, exact transfer verification and recovery. Services/bookings remain reserved boundaries with `501` handlers. Payment secrets and signed-envelope recovery records must never reach public responses.
