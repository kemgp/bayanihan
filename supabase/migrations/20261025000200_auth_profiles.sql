-- Apply after 20261025000100_initial_schema.sql.
-- Supabase Auth creates accounts/passwords. This migration provisions app profiles.
begin;

alter table public.profiles alter column role set default 'customer';

create or replace function public.bayanihan_create_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Community member'), 120),
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- Trigger execution does not require a browser-callable RPC permission.
revoke all on function public.bayanihan_create_auth_profile() from public, anon, authenticated;

drop trigger if exists bayanihan_auth_user_created on auth.users;
create trigger bayanihan_auth_user_created
after insert on auth.users
for each row execute function public.bayanihan_create_auth_profile();

-- Cover accounts created before the trigger. Preserve existing names and roles.
insert into public.profiles (id, display_name, role)
select
  id,
  left(coalesce(nullif(btrim(raw_user_meta_data ->> 'display_name'), ''), 'Community member'), 120),
  'customer'
from auth.users
on conflict (id) do nothing;

-- Roles are set by trusted administration, never by user-editable Auth metadata.
-- Continue the existing API-only data-access model.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;

commit;
