import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const initial = await read('supabase/migrations/20261025000100_initial_schema.sql');
const profiles = await read('supabase/migrations/20261025000200_auth_profiles.sql');
const paymentDemo = await read('supabase/migrations/20261025000300_payment_demo.sql');
const variableAmounts = await read('supabase/migrations/20261025000400_variable_demo_amounts.sql');
const seedTemplate = await read('supabase/seeds/demo_profiles.sql');
const db = new PGlite();
let passed = 0;
const check = async (name, run) => { await run(); passed += 1; console.log('PASS ' + name); };
const rows = async sql => (await db.query(sql)).rows;
const scalar = async sql => Object.values((await rows(sql))[0])[0];
const customerId = '10000000-0000-4000-8000-000000000010';
const workerId = '10000000-0000-4000-8000-000000000011';
const oldWorkerId = '10000000-0000-4000-8000-000000000012';
const missingId = '10000000-0000-4000-8000-000000000099';
// Replace only declaration literals; the script's placeholder guards remain intact.
const assignedSeed = (customer = customerId, worker = workerId) => seedTemplate
  .replace("customer_user_id uuid := '00000000-0000-0000-0000-000000000001'", `customer_user_id uuid := '${customer}'`)
  .replace("worker_user_id uuid := '00000000-0000-0000-0000-000000000002'", `worker_user_id uuid := '${worker}'`);

try {
  // Minimal Auth fixture only. Real accounts must be created by Supabase Auth.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  `);
  await db.exec(initial);
  await db.exec(`
    insert into auth.users values
      ('${customerId}', 'customer@example.test', '{"display_name":"Customer before migration"}'),
      ('${oldWorkerId}', 'existing-worker@example.test', '{}');
    insert into public.profiles values ('${oldWorkerId}', 'Existing worker', 'worker', now());
  `);

  await check('migration backfills existing Auth accounts', async () => {
    await db.exec(profiles);
    assert.equal(await scalar(`select role from public.profiles where id='${customerId}'`), 'customer');
  });
  await check('backfill preserves an existing worker role and name', async () => {
    assert.deepEqual(await rows(`select display_name, role from public.profiles where id='${oldWorkerId}'`),
      [{ display_name: 'Existing worker', role: 'worker' }]);
  });
  await check('trigger ignores a user-supplied worker role', async () => {
    await db.exec(`insert into auth.users values ('${workerId}', 'worker@example.test', '{"display_name":"  Demo Worker  ","role":"worker"}')`);
    assert.deepEqual(await rows(`select display_name, role from public.profiles where id='${workerId}'`),
      [{ display_name: 'Demo Worker', role: 'customer' }]);
  });
  await check('blank, missing and oversized names cannot break account creation', async () => {
    await db.exec(`insert into auth.users values
      ('10000000-0000-4000-8000-000000000020', 'blank@example.test', '{"display_name":"  "}'),
      ('10000000-0000-4000-8000-000000000021', 'null@example.test', null),
      ('10000000-0000-4000-8000-000000000022', 'long@example.test', jsonb_build_object('display_name',repeat('A',200)));`);
    assert.equal(await scalar("select count(*)::int from public.profiles where display_name='Community member'"), 2);
    assert.equal(await scalar("select char_length(display_name) from public.profiles where id='10000000-0000-4000-8000-000000000022'"), 120);
  });
  await check('metadata updates do not change the protected profile role', async () => {
    await db.exec(`update auth.users set raw_user_meta_data='{"role":"worker"}' where id='${customerId}'`);
    assert.equal(await scalar(`select role from public.profiles where id='${customerId}'`), 'customer');
  });
  await check('browser roles cannot read/write profiles or execute the trigger function', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal(await scalar(`select has_table_privilege('${role}','public.profiles','${privilege}')`), false);
      }
      assert.equal(await scalar(`select has_function_privilege('${role}','public.bayanihan_create_auth_profile()','EXECUTE')`), false);
    }
    assert.equal(await scalar("select relrowsecurity from pg_class where oid='public.profiles'::regclass"), true);
    await db.exec('set role authenticated');
    await assert.rejects(db.exec(`update public.profiles set role='worker' where id='${customerId}'`), /permission denied/);
    await db.exec('reset role');
  });
  await check('unmodified demo seed refuses to assign placeholder IDs', async () => {
    await assert.rejects(db.exec(seedTemplate), /Replace both UUID placeholders/);
    await db.exec('rollback');
  });
  await check('demo seed assigns the two requested roles and is repeatable', async () => {
    await db.exec(assignedSeed());
    await db.exec(assignedSeed());
    assert.deepEqual(await rows(`select id, role from public.profiles where id in ('${customerId}','${workerId}') order by id`),
      [{id:customerId,role:'customer'},{id:workerId,role:'worker'}]);
    assert.equal(await scalar(`select count(*)::int from public.profiles where id in ('${customerId}','${workerId}')`), 2);
  });
  await check('demo seed rejects using one Auth account for both roles', async () => {
    await assert.rejects(db.exec(assignedSeed(customerId, customerId)), /two different Auth users/);
    await db.exec('rollback');
  });
  await check('missing Auth account aborts without partial role changes', async () => {
    await assert.rejects(db.exec(assignedSeed(workerId, missingId)), /Create both email\/password users/);
    await db.exec('rollback');
    assert.equal(await scalar(`select role from public.profiles where id='${workerId}'`), 'worker');
  });
  await check('an existing worker record cannot be reassigned as the customer', async () => {
    await db.exec(`insert into public.workers (profile_id,service_area) values ('${workerId}','Demo area')`);
    await assert.rejects(db.exec(assignedSeed(workerId, customerId)), /already has a worker record/);
    await db.exec('rollback');
  });
  await check('rerunning profile migration preserves demo roles and creates no duplicates', async () => {
    const before = await scalar('select count(*)::int from public.profiles');
    await db.exec(profiles);
    assert.equal(await scalar('select count(*)::int from public.profiles'), before);
    assert.equal(await scalar(`select role from public.profiles where id='${workerId}'`), 'worker');
  });
  await db.exec(paymentDemo);
  const demoId = '20000000-0000-4000-8000-000000000001';
  const demoPayer = 'G' + 'A'.repeat(55);
  await check('demo checkout reserves one active payment per customer', async () => {
    await db.query('insert into public.demo_payments (id,customer_id,payer_address,deployment_id,split) values ($1,$2,$3,$4,$5)', [demoId, customerId, demoPayer, demoId, {}]);
    await assert.rejects(db.query('insert into public.demo_payments (customer_id,payer_address,deployment_id,split) values ($1,$2,$3,$4)', [customerId,demoPayer,demoId,{}]), /unique/);
  });
  await check('payment browser roles have no table access', async () => {
    for (const role of ['anon','authenticated']) for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
      assert.equal(await scalar(`select has_table_privilege('${role}','public.demo_payments','${privilege}')`), false);
    }
    assert.equal(await scalar("select relrowsecurity from pg_class where oid='public.demo_payments'::regclass"), true);
  });
  await check('fixed demo network, asset and amount cannot be changed', async () => {
    for (const change of ["network='mainnet'", "asset='USDC'", 'amount_stroops=1','worker_amount_stroops=1','platform_amount_stroops=1']) {
      await assert.rejects(db.exec(`update public.demo_payments set ${change} where id='${demoId}'`), /check constraint/);
    }
  });
  await check('payment cannot become paid or inactive without durable evidence', async () => {
    await assert.rejects(db.exec(`update public.demo_payments set status='paid' where id='${demoId}'`), /check constraint/);
    await assert.rejects(db.exec(`update public.demo_payments set active=false where id='${demoId}'`), /check constraint/);
    await db.exec(`update public.demo_payments set status='failed',active=false where id='${demoId}'`);
  });
  await check('original transaction hashes are globally unique within demo checkout', async () => {
    const hash = 'a'.repeat(64);
    await db.exec(`update public.demo_payments set transaction_hash='${hash}' where id='${demoId}'`);
    await assert.rejects(db.query('insert into public.demo_payments (customer_id,payer_address,deployment_id,split,transaction_hash) values ($1,$2,$3,$4,$5)', [customerId,demoPayer,demoId,{},hash]), /unique/);
    await db.query('insert into public.demo_payments (customer_id,payer_address,deployment_id,split) values ($1,$2,$3,$4)', [customerId,demoPayer,demoId,{}]);
  });
  await check('variable-amount migration preserves existing payment amounts', async () => {
    const before = await rows('select id,amount_stroops::text,worker_amount_stroops::text,platform_amount_stroops::text from public.demo_payments order by id');
    await db.exec(variableAmounts);
    assert.deepEqual(await rows('select id,amount_stroops::text,worker_amount_stroops::text,platform_amount_stroops::text from public.demo_payments order by id'), before);
  });
  const insertVariable = (total, worker, platform) => db.query(
    "insert into public.demo_payments (customer_id,payer_address,deployment_id,split,amount_stroops,worker_amount_stroops,platform_amount_stroops,status,active) values ($1,$2,$3,$4,$5,$6,$7,'failed',false) returning id",
    [customerId,demoPayer,demoId,{},total,worker,platform]);
  await check('variable amounts support boundaries and exact rounding with no lost stroops', async () => {
    for (const total of [100n,25000000n,123456789n,100000000000n]) {
      const worker = total*85n/100n;
      await insertVariable(total.toString(),worker.toString(),(total-worker).toString());
    }
  });
  await check('variable amount constraints reject invalid ranges and incorrect splits', async () => {
    for (const total of [0n,99n,-100n,100000000001n]) {
      const worker = total*85n/100n;
      await assert.rejects(insertVariable(total.toString(),worker.toString(),(total-worker).toString()), /check constraint/);
    }
    await assert.rejects(insertVariable('25000000','1','24999999'), /check constraint/);
    await assert.rejects(db.query('insert into public.demo_payments (customer_id,payer_address,deployment_id,split) values ($1,$2,$3,$4)', [customerId,demoPayer,demoId,{}]), /not-null/);
  });
  await check('saved amount cannot change even to another mathematically valid split', async () => {
    const id = (await insertVariable('25000000','21250000','3750000')).rows[0].id;
    await assert.rejects(db.query('update public.demo_payments set amount_stroops=30000000,worker_amount_stroops=25500000,platform_amount_stroops=4500000 where id=$1',[id]), /saved payment amount cannot be changed/);
    assert.equal(await scalar(`select amount_stroops::text from public.demo_payments where id='${id}'`),'25000000');
    await db.query('update public.demo_payments set updated_at=now() where id=$1',[id]);
  });
  await check('variable amounts retain server-only table and trigger-function access', async () => {
    for (const role of ['anon','authenticated']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) assert.equal(await scalar(`select has_table_privilege('${role}','public.demo_payments','${privilege}')`),false);
      assert.equal(await scalar(`select has_function_privilege('${role}','public.bayanihan_lock_demo_payment_amount()','EXECUTE')`),false);
    }
  });
  console.log(`\n${passed} local PostgreSQL checks passed. No hosted Supabase project was contacted.`);
} finally {
  await db.close();
}
