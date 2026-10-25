-- DEVELOPMENT ONLY. Apply both migrations first, then create two users in Supabase Auth.
-- Copy this script into SQL Editor and replace the two UUID placeholders there.
-- Do not commit real passwords, credentials or project-specific account IDs.
-- Re-running with the same IDs intentionally restores these two demo names/roles.
begin;

do $seed$
declare
  customer_user_id uuid := '00000000-0000-0000-0000-000000000001'; -- Replace with customer Auth user ID.
  worker_user_id uuid := '00000000-0000-0000-0000-000000000002'; -- Replace with worker Auth user ID.
begin
  if customer_user_id = '00000000-0000-0000-0000-000000000001'::uuid
    or worker_user_id = '00000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'Replace both UUID placeholders with existing Supabase Auth user IDs.';
  end if;

  if customer_user_id = worker_user_id then
    raise exception 'Customer and worker must be two different Auth users.';
  end if;

  if not exists (select 1 from auth.users where id = customer_user_id and email is not null)
    or not exists (select 1 from auth.users where id = worker_user_id and email is not null) then
    raise exception 'Create both email/password users in Supabase Auth before assigning demo roles.';
  end if;

  if exists (select 1 from public.workers where profile_id = customer_user_id) then
    raise exception 'The selected customer already has a worker record. Choose a separate customer account.';
  end if;

  insert into public.profiles (id, display_name, role)
  values
    (customer_user_id, 'Ana Cruz', 'customer'),
    (worker_user_id, 'Miguel Santos', 'worker')
  on conflict (id) do update
    set display_name = excluded.display_name,
        role = excluded.role;
end;
$seed$;

commit;

-- This script creates app profiles only. A worker business record, payout address,
-- deployment mapping and service are separate seed tasks once their values are known.
