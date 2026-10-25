-- Standalone payment presentation. Does not represent a completed real booking.
create table public.demo_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  payer_address text not null check (payer_address ~ '^G[A-Z2-7]{55}$'),
  deployment_id uuid not null,
  network text not null default 'testnet' check (network = 'testnet'),
  asset text not null default 'XLM' check (asset = 'XLM'),
  amount_stroops bigint not null default 10000000 check (amount_stroops = 10000000),
  worker_amount_stroops bigint not null default 8500000 check (worker_amount_stroops = 8500000),
  platform_amount_stroops bigint not null default 1500000 check (platform_amount_stroops = 1500000),
  status text not null default 'preparing' check (status in ('preparing','prepared','pending','paid','failed','expired')),
  active boolean not null default true,
  split jsonb not null,
  unsigned_xdr text,
  signed_xdr text,
  transaction_hash text unique check (transaction_hash ~ '^[a-f0-9]{64}$'),
  preparation_request_id uuid,
  expires_at timestamptz,
  receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('prepared','pending','paid','expired') or (unsigned_xdr is not null and transaction_hash is not null and expires_at is not null)),
  check (status <> 'paid' or receipt is not null),
  check (active or status in ('paid','failed','expired'))
);
create unique index demo_payments_one_active_customer on public.demo_payments(customer_id) where active;
alter table public.demo_payments enable row level security;
revoke all on public.demo_payments from public, anon, authenticated;
grant all on public.demo_payments to service_role;
comment on table public.demo_payments is 'Testnet checkout demonstration only; server owns authorization and state transitions.';
