# Database scaffold

Apply these migrations in filename order:

1. `migrations/20261025000100_initial_schema.sql` defines the five MVP records, foreign keys, fixed Testnet amounts, unique slots and one active payment attempt per booking.
2. `migrations/20261025000200_auth_profiles.sql` provisions profiles for existing/new Supabase Auth users, always defaulting to `customer` and preserving existing profile roles.
3. `migrations/20261025000300_payment_demo.sql` adds standalone Testnet checkout records with one active payment per customer, unique original hashes, fixed amounts/network and server-only access.

The agent has not applied these migrations to a hosted project. RLS is enabled and `anon`/`authenticated` table access is revoked. All application data access will pass through authenticated, authorized Express routes. Express now enforces customer role/payment ownership for standalone demo payments. The browser cannot read or write these tables directly. Booking transitions remain deferred.

For an empty **development** Supabase project, review and run the migration in the SQL Editor. If using Supabase CLI, initialize its local config with `supabase init`, link the intended development project and review pending migrations before `supabase db push`. No CLI configuration or remote link is included in this scaffold. [Supabase migration documentation](https://supabase.com/docs/guides/deployment/database-migrations).

Development seed sequence:

1. After applying the first two migrations, create two email/password users in Supabase Auth and confirm them for the demo. Their profiles are created automatically with `customer` as the default role.
2. Copy `seeds/demo_profiles.sql` into the development SQL Editor. Replace its two UUID declaration placeholders with the actual Auth user IDs and run that copy. It assigns the customer and worker roles without storing passwords. Use dedicated demo accounts: reruns intentionally restore their demo display names and roles. Do not edit the placeholder guard conditions. The seed remains separate from the migration chain because account IDs are project-specific.
3. Later, insert the separate worker business record with its actual testnet payout address and reviewed Paiflow deployment UUID.
4. Insert the furniture-assembly service at `10000000` stroops. Enable it only when its worker/deployment is ready.
5. Add the application booking and payment logic before exercising writes through Express.

Do not insert into `auth.users` manually or commit passwords/tokens. The root `seed.sql` remains empty so automatic resets do not apply project-specific role assignments. The explicit demo seed rejects placeholder, duplicate and missing account IDs.

Run `npm run test:db` for isolated PostgreSQL checks of profile creation, metadata-based role escalation prevention, browser access restrictions, seed guard failures and repeatability. No hosted credentials are loaded by that test.

See [the authentication guide](../docs/auth-implementation.md) for shared sign-in, server profile lookup, role-based UI, session restoration and sign-out.

For the current payment presentation, migration 003 and the protected profile are sufficient; worker/service seeding is deferred. Express implements atomic standalone-payment reservation/submission and exact receipt evidence verification. See [payment demo guide](../docs/payment-demo.md).

Still required for the marketplace: generated database bindings, trusted service/slot validation, booking role/ownership checks, job-transition enforcement and booking-linked payment. Database constraints here are a starting point, not a completed payment system. Slot uniqueness currently means identical start timestamps, not arbitrary duration-overlap detection. The MVP must offer fixed, non-overlapping slots. `updated_at` must be maintained by the future mutation handlers or a later trigger migration.
