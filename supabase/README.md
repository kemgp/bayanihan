# Database scaffold

Apply these migrations in filename order:

1. `migrations/20261025000100_initial_schema.sql` defines the five MVP records, foreign keys, fixed Testnet amounts, unique slots and one active payment attempt per booking.
2. `migrations/20261025000200_auth_profiles.sql` provisions profiles for existing/new Supabase Auth users, always defaulting to `customer` and preserving existing profile roles.
3. `migrations/20261025000300_payment_demo.sql` adds standalone Testnet checkout records with one active payment per customer, unique original hashes, initially fixed amounts/network and server-only access.
4. `migrations/20261025000400_variable_demo_amounts.sql` replaces the fixed demo amount constraints with the 0.00001–10,000-XLM range, exact rounded 85/15 split, and immutable saved amounts. Apply after 003; existing attempts retain their original values.

The agent has not applied these migrations to a hosted project. RLS is enabled and `anon`/`authenticated` table access is revoked. All application data access will pass through authenticated, authorized Express routes. Express now enforces customer role/payment ownership for standalone demo payments. The browser cannot read or write these tables directly. Booking transitions remain deferred.

For an empty **development** Supabase project, review and run the migration in the SQL Editor. If using Supabase CLI, initialize its local config with `supabase init`, link the intended development project and review pending migrations before `supabase db push`. No CLI configuration or remote link is included in this scaffold. [Supabase migration documentation](https://supabase.com/docs/guides/deployment/database-migrations).

Development seed sequence:

1. After applying the first two migrations, create the customer account through the app's Sign up form (or create both accounts in Supabase Auth for a controlled demo). Create the worker account separately and confirm email addresses as required by Auth settings. Their profiles are created with `customer` as the default role.
2. Copy `seeds/demo_profiles.sql` into the development SQL Editor. Replace its two UUID declaration placeholders with the actual Auth user IDs and run that copy. It assigns the customer and worker roles without storing passwords. Use dedicated demo accounts: reruns intentionally restore their demo display names and roles. Do not edit the placeholder guard conditions. The seed remains separate from the migration chain because account IDs are project-specific.
3. Later, insert the separate worker business record with its actual testnet payout address and reviewed Paiflow deployment UUID.
4. Insert the furniture-assembly service at `10000000` stroops. Enable it only when its worker/deployment is ready.
5. Add the application booking and payment logic before exercising writes through Express.

Do not insert into `auth.users` manually or commit passwords/tokens. The root `seed.sql` remains empty so automatic resets do not apply project-specific role assignments. The explicit demo seed rejects placeholder, duplicate and missing account IDs.

Run `npm run test:db` for isolated PostgreSQL checks of profile creation, metadata-based role escalation prevention, browser access restrictions, seed guard failures and repeatability. No hosted credentials are loaded by that test.

See [the authentication guide](../docs/auth-implementation.md) for shared sign-in, server profile lookup, role-based UI, session restoration and sign-out.

For the current payment presentation, migrations 003/004 and the protected profile are sufficient; worker/service seeding is deferred. Express implements atomic standalone-payment reservation/submission and exact receipt evidence verification. See [payment demo guide](../docs/payment-demo.md).

The Express marketplace routes now validate the active Carpenter service, fixed Manila-time slots, trusted service pricing, role/ownership and job transitions. The initial schema's unique worker/start-time constraint is the final race guard; offered slots are fixed and non-overlapping. `updated_at` is maintained by the transition handler. The fresh clone still needs the migrations applied, a real worker/service seed, and account credentials before these handlers can run against Supabase. Booking-linked payment, generated database bindings and duration-overlap constraints beyond the fixed slot list remain future work.
