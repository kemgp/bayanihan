-- Initial schema only. Apply to a development Supabase project after review.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 120),
  role text not null check (role in ('customer', 'worker')),
  created_at timestamptz not null default now()
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id),
  skills text[] not null default '{}',
  service_area text not null,
  payout_address text,
  paiflow_deployment_id uuid,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id),
  title text not null,
  scope text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  amount_stroops bigint not null default 10000000 check (amount_stroops = 10000000),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, worker_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  worker_id uuid not null references public.workers(id),
  service_id uuid not null,
  scheduled_at timestamptz not null,
  task_description text not null check (char_length(task_description) between 1 and 2000),
  service_address text not null check (char_length(service_address) between 1 and 500),
  amount_stroops bigint not null check (amount_stroops = 10000000),
  job_status text not null default 'requested'
    check (job_status in ('requested', 'accepted', 'work_done', 'completed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'preparing', 'prepared', 'submitted', 'pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (service_id, worker_id) references public.services(id, worker_id),
  unique (worker_id, scheduled_at)
);

create index bookings_customer_idx on public.bookings(customer_id);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  payer_address text not null,
  network text not null default 'testnet' check (network = 'testnet'),
  asset text not null default 'XLM' check (asset = 'XLM'),
  deployment_id uuid not null,
  amount_stroops bigint not null check (amount_stroops = 10000000),
  worker_amount_stroops bigint not null check (worker_amount_stroops = 8500000),
  platform_amount_stroops bigint not null check (platform_amount_stroops = 1500000),
  worker_address text not null,
  platform_address text not null,
  preparation jsonb,
  preparation_history_id uuid,
  original_signed_xdr text,
  original_transaction_hash text unique,
  status text not null default 'preparing'
    check (status in ('preparing', 'prepared', 'submitted', 'pending', 'paid', 'failed')),
  verification_evidence jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (worker_address <> platform_address),
  check (status <> 'paid' or (
    original_transaction_hash is not null and verified_at is not null and verification_evidence is not null
  ))
);

-- Preserve uncertain attempts and prevent another attempt after successful settlement.
create unique index payment_attempts_one_active_per_booking
  on public.payment_attempts(booking_id) where status <> 'failed';

-- Fail closed until explicit access policies and Express business rules are implemented.
-- service_role can access these tables. Browser roles cannot mutate or read payment envelopes.
alter table public.profiles enable row level security;
alter table public.workers enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.payment_attempts enable row level security;

revoke all on public.profiles, public.workers, public.services,
  public.bookings, public.payment_attempts from anon, authenticated;
grant all on public.profiles, public.workers, public.services,
  public.bookings, public.payment_attempts to service_role;

commit;
