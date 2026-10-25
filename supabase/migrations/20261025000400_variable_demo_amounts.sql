-- Preserve existing 1-XLM attempts while allowing customer-entered demo amounts.
begin;
alter table public.demo_payments
  drop constraint demo_payments_amount_stroops_check,
  drop constraint demo_payments_worker_amount_stroops_check,
  drop constraint demo_payments_platform_amount_stroops_check,
  alter column amount_stroops drop default,
  alter column worker_amount_stroops drop default,
  alter column platform_amount_stroops drop default,
  add constraint demo_payments_amount_range check (amount_stroops between 100 and 100000000000),
  add constraint demo_payments_exact_split check (
    worker_amount_stroops = (amount_stroops * 85) / 100
    and platform_amount_stroops = amount_stroops - worker_amount_stroops
  );

create function public.bayanihan_lock_demo_payment_amount()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.amount_stroops, new.worker_amount_stroops, new.platform_amount_stroops)
    is distinct from (old.amount_stroops, old.worker_amount_stroops, old.platform_amount_stroops) then
    raise exception 'A saved payment amount cannot be changed. Resolve the original attempt before starting another payment.';
  end if;
  return new;
end;
$$;
revoke all on function public.bayanihan_lock_demo_payment_amount() from public, anon, authenticated;
create trigger bayanihan_lock_demo_payment_amount
before update on public.demo_payments
for each row execute function public.bayanihan_lock_demo_payment_amount();
commit;
