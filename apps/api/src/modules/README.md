# Backend feature boundaries

- `services/`: public service/profile queries, returning only safe display data.
- `bookings/`: trusted pricing, fixed-slot validation, ownership/role checks and job transitions.
- `payments/`: atomic reservation, server preparation, original-envelope validation, submission, payout verification and recovery.

These folders reserve implementation boundaries only. The current router returns `501` for business handlers after authentication where required. Do not replace them with successful responses until their required checks and persistence exist. Payment secrets and signed-envelope recovery records must never reach public responses.
