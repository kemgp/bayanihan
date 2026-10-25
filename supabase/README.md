# Database scaffold

`migrations/20261025000100_initial_schema.sql` defines the five MVP records, foreign keys, fixed Testnet amounts, unique slots and one active payment attempt per booking.

This migration has not been applied to a hosted project. RLS is enabled and `anon`/`authenticated` table access is revoked. All application data access will pass through authenticated, authorized Express routes. No browser access policies or business transition functions are implemented yet.

For an empty **development** Supabase project, review and run the migration in the SQL Editor. If using Supabase CLI, initialize its local config with `supabase init`, link the intended development project and review pending migrations before `supabase db push`. No CLI configuration or remote link is included in this scaffold. [Supabase migration documentation](https://supabase.com/docs/guides/deployment/database-migrations).

Development seed sequence:

1. Create customer and worker users in Supabase Auth. Use their actual UUIDs for `profiles` and assign roles server-side.
2. Insert the worker with its actual testnet payout address and reviewed Paiflow deployment UUID.
3. Insert the furniture-assembly service at `10000000` stroops. Enable it only when its worker/deployment is ready.
4. Add the application booking and payment logic before exercising writes through Express.

Do not insert into `auth.users` manually or commit passwords/tokens. The empty `seed.sql` deliberately avoids unverified recipients and credentials.

Still required: typed database bindings, trusted service/slot validation, role and ownership checks, job-transition enforcement, atomic payment reservation and settlement functions, and receipt evidence verification. Database constraints here are a starting point, not a completed payment system. Slot uniqueness currently means identical start timestamps, not arbitrary duration-overlap detection. The MVP must offer fixed, non-overlapping slots. `updated_at` must be maintained by the future mutation handlers or a later trigger migration.
