const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const { URL } = require('node:url');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
const { AbortSignal } = globalThis;

const databaseUrl = process.env.ADMIN_TOPUP_INTEGRATION_DATABASE_URL;
const fixtureId = (key) => `aff111a7-e000-4000-8000-${String(key).padStart(12, '0')}`;

async function verifyBackfill() {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 8000 });
  await client.connect();
  try {
    // Run the migration SQL on session-local copies of the old tables, leaving public tables intact.
    await client.query(`
      SET lock_timeout = '5s';
      CREATE TEMP TABLE merchant_topups (LIKE public.merchant_topups);
      CREATE TEMP TABLE wallets (LIKE public.wallets);
      CREATE TEMP TABLE money_movements (LIKE public.money_movements);
      CREATE TEMP TABLE idempotency_records (LIKE public.idempotency_records);
      ALTER TABLE pg_temp.merchant_topups DROP COLUMN merchant_new_available_balance_syp;
      SET search_path TO pg_temp;
    `);
    const legacyId = randomUUID();
    for (const [key, amount, currentBalance] of [[2, 100000, 73500], [5, 435000, 0]]) {
      await client.query(`INSERT INTO wallets (id, user_id, role, available_balance_syp, pending_payout_syp)
        VALUES ($1, $2, 'merchant', $3, 0)`, [fixtureId(10 + key), fixtureId(key), currentBalance]);
      await client.query(`INSERT INTO merchant_topups (id, merchant_id, admin_id, amount_syp, payment_method, reference_note, created_at)
        VALUES ($1, $2, $3, $4, 'cash', 'Simulated demo opening credit', now())`, [fixtureId(20 + key), fixtureId(key), fixtureId(1), amount]);
      await client.query(`INSERT INTO money_movements (id, wallet_id, topup_id, kind, amount_syp, created_at)
        VALUES ($1, $2, $3, 'merchant_topup', $4, now())`, [fixtureId(30 + key), fixtureId(10 + key), fixtureId(20 + key), amount]);
    }
    // A lookalike with the same note and amount lacks the exact opening fixture identities.
    await client.query(`INSERT INTO merchant_topups (id, merchant_id, admin_id, amount_syp, payment_method, reference_note, created_at)
      VALUES ($1, $2, $3, 100000, 'cash', 'Simulated demo opening credit', now())`, [legacyId, fixtureId(2), fixtureId(1)]);
    await client.query(`INSERT INTO idempotency_records
      (actor_id, operation, request_key, request_fingerprint, response_status, response_body, created_at)
      VALUES ($1, 'demo.seed.v1', $2, 'demo-seed-v1', 201, '{}', now())`, [fixtureId(1), fixtureId(90)]);
    const migration = readFileSync(require.resolve('../prisma/migrations/0002_merchant_topup_balance_snapshot/migration.sql'), 'utf8');
    await client.query(migration);
    const { rows } = await client.query('SELECT id, merchant_new_available_balance_syp::text AS balance FROM pg_temp.merchant_topups');
    assert.deepEqual(new Map(rows.map(({ id, balance }) => [id, balance])), new Map([
      [fixtureId(22), '100000'], [fixtureId(25), '435000'], [legacyId, null],
    ]));
    for (const invalid of [-1, 99999, '9007199254740992']) {
      await assert.rejects(client.query('UPDATE pg_temp.merchant_topups SET merchant_new_available_balance_syp = $1 WHERE id = $2',
        [invalid, fixtureId(22)]), { code: '23514', constraint: 'merchant_topups_post_credit_balance_check' });
    }
  } finally {
    await client.end();
  }
}

test('Step 11B admin top-ups on isolated PostgreSQL', { skip: !databaseUrl, timeout: 60000 }, async (t) => {
  const url = new URL(databaseUrl);
  assert.ok(['postgresql:', 'postgres:'].includes(url.protocol) && url.hostname === '127.0.0.1' &&
    /^\/affiliate_marketing_admin_topup_test_[a-z0-9_]+$/.test(url.pathname) && !url.search && !url.hash,
  'Expected a fresh loopback admin top-up test database');
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = randomBytes(32).toString('base64url');
  process.env.WEB_BASE_URL = 'https://demo.example.test';
  const { createApp } = require('../dist/main');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const app = await createApp({ logger: false });
  t.after(() => app.close());
  const db = app.get(PrismaService).getClient();
  const [identity] = await db.$queryRaw`SELECT current_database() AS db, host(inet_server_addr()) AS host`;
  assert.equal(identity.db, url.pathname.slice(1));
  assert.equal(identity.host, '127.0.0.1');
  assert.equal(await db.user.count(), 0, 'Expected a fresh database without users');
  assert.equal(await db.merchantTopup.count(), 0, 'Expected a fresh database without top-ups');

  await t.test('migration backfills exact demo fixtures and retains unknowns with a bounded snapshot column', verifyBackfill);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  function request(method, path, { token, key, body } = {}) {
    return fetch(`${base}/api/v1/${path}`, { method, headers: {
      ...(token && { authorization: `Bearer ${token}` }), ...(key && { 'Idempotency-Key': key }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  }
  async function read(response, status) {
    assert.equal(response.status, status);
    return response.json();
  }
  async function fail(response, status, code) {
    assert.equal((await read(response, status)).code, code);
  }

  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);
  const loginAdmin = async (phone) => {
    const admin = await db.user.create({ data: { phone, name: 'Fixture admin', isAdmin: true, passwordHash } });
    const session = await read(await request('POST', 'auth/admin/login', { body: { phone, password } }), 200);
    return { id: admin.id, token: session.accessToken };
  };
  const admin = await loginAdmin('0999190001');
  const secondAdmin = await loginAdmin('0999190005');
  const register = async (suffix, roles) => {
    const body = { phone: `099919000${suffix}`, name: `Fixture ${suffix}`, password, roles,
      ...(roles.includes('merchant') && { shop: { name: `Shop ${suffix}`, details: 'Fixture shop' } }) };
    const session = await read(await request('POST', 'auth/register', { body }), 201);
    return { id: session.user.id, token: session.accessToken };
  };
  const merchant = await register(2, ['merchant', 'marketer', 'customer']);
  const other = await register(3, ['merchant']);
  const unverified = await register(4, ['merchant']);
  const marketer = await register(6, ['marketer']);
  await db.merchantProfile.updateMany({ where: { userId: { in: [merchant.id, other.id] } }, data: { verificationStatus: 'verified' } });

  const input = (amountSyp) => ({ amountSyp, paymentMethod: 'cash', referenceNote: 'Confirmed fixture payment' });
  const create = (amountSyp, { id = merchant.id, key = randomUUID(), token = admin.token, body = input(amountSyp) } = {}) =>
    request('POST', `admin/merchants/${id}/topups`, { token, key, body });
  const history = (search = '', token = admin.token) => request('GET', `admin/topups${search}`, { token });
  const wallet = (role = 'merchant', userId = merchant.id) => db.wallet.findUniqueOrThrow({ where: { userId_role: { userId, role } } });
  const customer = () => db.customerProfile.findUniqueOrThrow({ where: { userId: merchant.id } });
  const launch = () => request('POST', 'merchant/campaigns', { token: merchant.token, key: randomUUID(), body: {
    campaignType: 'product', productName: 'Fixture product', description: 'Fixture product for launch',
    imageUrl: 'https://demo.example.test/product.jpg', originalPriceSyp: 100000, discountPercent: 10,
    commission: { type: 'fixed', amountSyp: 10000 }, maxItems: 3, joinMode: 'open',
    endsAt: new Date(Date.now() + 3600000).toISOString(),
  } });

  await t.test('admin authentication, verified merchant, UUID and body validation', async () => {
    await fail(await history('', null), 401, 'AUTH_REQUIRED');
    await fail(await create(10, { token: null }), 401, 'AUTH_REQUIRED');
    await fail(await history('', merchant.token), 403, 'FORBIDDEN');
    await fail(await create(10, { token: merchant.token }), 403, 'FORBIDDEN');
    await fail(await create(10, { id: randomUUID() }), 404, 'NOT_FOUND');
    await fail(await create(10, { id: marketer.id }), 404, 'NOT_FOUND');
    await fail(await create(10, { id: unverified.id }), 403, 'MERCHANT_NOT_VERIFIED');
    await db.merchantProfile.update({ where: { userId: unverified.id }, data: { verificationStatus: 'rejected' } });
    await fail(await create(10, { id: unverified.id }), 403, 'MERCHANT_NOT_VERIFIED');
    await fail(await create(10, { id: 'invalid' }), 400, 'VALIDATION_ERROR');
    await fail(await create(10, { key: null }), 400, 'VALIDATION_ERROR');
    await fail(await create(10, { key: 'invalid' }), 400, 'VALIDATION_ERROR');
    for (const amount of [0, -1, 1.5, '10', Number.MAX_SAFE_INTEGER + 1]) {
      await fail(await create(amount), 400, 'VALIDATION_ERROR');
    }
    for (const fields of [{ paymentMethod: 'card' }, { referenceNote: ' ' }, { referenceNote: 'x'.repeat(257) }, { adminId: admin.id }]) {
      await fail(await create(10, { body: { ...input(10), ...fields } }), 400, 'VALIDATION_ERROR');
    }
    for (const search of ['?page=0', '?pageSize=101', '?merchantId=invalid']) {
      await fail(await history(search), 400, 'VALIDATION_ERROR');
    }
    assert.equal(await db.merchantTopup.count(), 0);
  });

  let first;
  let campaign;
  await t.test('top-ups credit only the merchant wallet and enable campaign launch without rewriting the snapshot', async () => {
    await fail(await launch(), 409, 'INSUFFICIENT_MERCHANT_BALANCE');
    const marketerBefore = await wallet('marketer');
    const customerBefore = await customer();
    const key = randomUUID();
    first = await read(await create(100000, { key }), 201);
    assert.deepEqual(first, { topupId: first.topupId, merchantId: merchant.id, shopName: 'Shop 2', ...input(100000),
      merchantNewAvailableBalanceSyp: 100000, createdAt: first.createdAt });
    const row = await db.merchantTopup.findUniqueOrThrow({ where: { id: first.topupId }, include: { moneyMovements: true } });
    assert.equal(row.createdAt.toISOString(), first.createdAt);
    assert.equal(row.adminId, admin.id);
    assert.equal(row.amountSyp, 100000n);
    assert.equal(row.merchantNewAvailableBalanceSyp, 100000n);
    const merchantWallet = await wallet();
    assert.equal(merchantWallet.availableBalanceSyp, 100000n);
    assert.deepEqual(row.moneyMovements.map(({ topupId, walletId, amountSyp, kind, campaignId, saleId, customerId }) =>
      ({ topupId, walletId, amountSyp, kind, campaignId, saleId, customerId })), [
      { topupId: first.topupId, walletId: merchantWallet.id, amountSyp: 100000n, kind: 'merchant_topup', campaignId: null, saleId: null, customerId: null },
    ]);
    campaign = await read(await launch(), 201);
    assert.equal(campaign.usage.lockedBudgetSyp, 43500);
    assert.equal((await wallet()).availableBalanceSyp, 56500n);
    assert.equal((await read(await create(5000), 201)).merchantNewAvailableBalanceSyp, 61500);
    assert.equal((await read(await create(1000), 201)).merchantNewAvailableBalanceSyp, 62500);
    const replay = await read(await create(100000, { key }), 201);
    assert.deepEqual(replay, first);
    await fail(await create(100001, { key }), 409, 'IDEMPOTENCY_KEY_REUSED');
    await fail(await create(100000, { key, id: other.id }), 409, 'IDEMPOTENCY_KEY_REUSED');
    await read(await create(10, { key, id: other.id, token: secondAdmin.token }), 201);
    assert.equal((await wallet()).availableBalanceSyp, 62500n);
    assert.equal((await wallet('merchant', other.id)).availableBalanceSyp, 10n);
    assert.deepEqual(await wallet('marketer'), marketerBefore);
    assert.deepEqual(await customer(), customerBefore);
    assert.equal((await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).lockedBudgetSyp, 43500n);
  });

  await t.test('concurrent same-key and distinct-key top-ups each produce one credit per committed key', async () => {
    const before = (await wallet()).availableBalanceSyp;
    const count = await db.merchantTopup.count();
    const key = randomUUID();
    const same = await Promise.all([create(200, { key }), create(200, { key })]);
    const [result, replay] = await Promise.all(same.map((response) => read(response, 201)));
    assert.deepEqual(result, replay);
    assert.equal(result.merchantNewAvailableBalanceSyp, Number(before + 200n));
    const distinct = await Promise.all([create(300), create(400)]);
    const [left, right] = await Promise.all(distinct.map((response) => read(response, 201)));
    const final = Number(before + 900n);
    assert.ok(
      (left.merchantNewAvailableBalanceSyp === final - 400 && right.merchantNewAvailableBalanceSyp === final) ||
      (right.merchantNewAvailableBalanceSyp === final - 300 && left.merchantNewAvailableBalanceSyp === final),
    );
    assert.equal((await wallet()).availableBalanceSyp, before + 900n);
    assert.equal(await db.merchantTopup.count(), count + 3);
    for (const entry of [result, left, right]) {
      const topup = await db.merchantTopup.findUniqueOrThrow({ where: { id: entry.topupId }, include: { moneyMovements: true } });
      assert.equal(topup.merchantNewAvailableBalanceSyp, BigInt(entry.merchantNewAvailableBalanceSyp));
      assert.equal(topup.moneyMovements.length, 1);
      assert.equal(topup.moneyMovements[0].amountSyp, BigInt(entry.amountSyp));
    }
  });

  await t.test('a failed ledger insert rolls back the top-up, credit and idempotency claim', async (subtest) => {
    const before = await wallet();
    const key = randomUUID();
    const topupsBefore = await db.merchantTopup.count();
    const ledgerBefore = await db.moneyMovement.count();
    await db.$executeRaw`ALTER TABLE money_movements ADD CONSTRAINT test_topup_ledger_failure
      CHECK (kind <> 'merchant_topup' OR amount_syp <> 19) NOT VALID`;
    subtest.after(() => db.$executeRaw`ALTER TABLE money_movements DROP CONSTRAINT test_topup_ledger_failure`);
    await fail(await create(19, { key }), 500, 'INTERNAL_ERROR');
    assert.deepEqual(await wallet(), before);
    assert.equal(await db.merchantTopup.count(), topupsBefore);
    assert.equal(await db.moneyMovement.count(), ledgerBefore);
    assert.equal(await db.idempotencyRecord.count({ where: { requestKey: key, actorId: admin.id } }), 0);
  });

  await t.test('the safe integer limit is enforced before any credit is written', async () => {
    const key = randomUUID();
    const before = await wallet('merchant', other.id);
    const topups = await db.merchantTopup.count();
    const movements = await db.moneyMovement.count();
    await fail(await create(Number.MAX_SAFE_INTEGER, { id: other.id, key }), 409, 'AMOUNT_OUT_OF_RANGE');
    assert.deepEqual(await wallet('merchant', other.id), before);
    assert.equal(await db.merchantTopup.count(), topups);
    assert.equal(await db.moneyMovement.count(), movements);
    assert.equal(await db.idempotencyRecord.count({ where: { requestKey: key, actorId: admin.id } }), 0);
  });

  await t.test('history pages, filters and returns stored snapshots or an explicit legacy null', async () => {
    const legacy = await db.merchantTopup.create({ data: { merchantId: other.id, adminId: admin.id, amountSyp: 20n,
      paymentMethod: 'bank_transfer', referenceNote: 'Imported fixture with unknown historical balance' } });
    const sameTime = new Date();
    await db.merchantTopup.updateMany({ data: { createdAt: sameTime } });
    const records = await db.merchantTopup.findMany();
    const ids = records.map(({ id }) => id).sort().reverse();
    const page = await read(await history('?page=2&pageSize=2'), 200);
    assert.deepEqual({ ...page, items: page.items.map(({ topupId }) => topupId) }, {
      items: ids.slice(2, 4), page: 2, pageSize: 2, total: ids.length, previousPage: 1, nextPage: 3,
    });
    const all = await read(await history(), 200);
    assert.deepEqual(all.items.map(({ topupId }) => topupId), ids);
    const historicalFirst = all.items.find(({ topupId }) => topupId === first.topupId);
    assert.deepEqual(historicalFirst, { ...first, createdAt: sameTime.toISOString() });
    const filtered = await read(await history(`?merchantId=${other.id}`), 200);
    assert.equal(filtered.total, 2);
    assert.ok(filtered.items.every(({ merchantId }) => merchantId === other.id));
    assert.equal(filtered.items.find(({ topupId }) => topupId === legacy.id).merchantNewAvailableBalanceSyp, null);
    assert.deepEqual((await read(await history('?page=999'), 200)).items, []);
  });

  await t.test('Swagger differentiates numeric POST and nullable history balances and declares authorization', async () => {
    const docs = await read(await fetch(`${base}/api/docs-json`, { signal: AbortSignal.timeout(5000) }), 200);
    const createOperation = docs.paths['/api/v1/admin/merchants/{merchantId}/topups'].post;
    const historyOperation = docs.paths['/api/v1/admin/topups'].get;
    for (const operation of [createOperation, historyOperation]) assert.deepEqual(operation.security, [{ bearer: [] }]);
    const key = createOperation.parameters.find(({ name }) => name === 'Idempotency-Key');
    assert.equal(key.required, true);
    assert.equal(key.schema.format, 'uuid');
    assert.equal(createOperation.requestBody.content['application/json'].schema.$ref, '#/components/schemas/CreateAdminTopupDto');
    assert.equal(createOperation.responses['201'].content['application/json'].schema.$ref, '#/components/schemas/AdminTopupResultDto');
    assert.equal(historyOperation.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/AdminTopupPageDto');
    assert.deepEqual(historyOperation.parameters.map(({ name }) => name).sort(), ['merchantId', 'page', 'pageSize']);
    const schemas = docs.components.schemas;
    const posted = schemas.AdminTopupResultDto.properties.merchantNewAvailableBalanceSyp;
    const historical = schemas.AdminTopupHistoryEntryDto.properties.merchantNewAvailableBalanceSyp;
    assert.equal(posted.type, 'integer');
    assert.ok(!posted.nullable);
    assert.equal(historical.type, 'integer');
    assert.equal(historical.nullable, true);
    assert.match(historical.description, /hundredths of one new Syrian Pound/);
    assert.equal(schemas.AdminTopupPageDto.properties.items.items.$ref, '#/components/schemas/AdminTopupHistoryEntryDto');
  });
});
