const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash, randomBytes } = require('node:crypto');
const { URL } = require('node:url');
const { JwtService } = require('@nestjs/jwt');
const bcrypt = require('bcrypt');

const databaseUrl = process.env.AUTH_INTEGRATION_DATABASE_URL;

test('Step 04B session HTTP and PostgreSQL integration', { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl);
  assert.ok(
    ['postgresql:', 'postgres:'].includes(url.protocol) &&
    ['127.0.0.1', '[::1]'].includes(url.hostname) &&
    /^\/affiliate_marketing_session_test_[a-z0-9_]+$/.test(url.pathname) &&
    !url.search && !url.hash,
    'Expected a dedicated loopback session-test database',
  );
  const secret = randomBytes(32).toString('base64url');
  process.env.JWT_SECRET = secret;
  process.env.DATABASE_URL = databaseUrl;
  const { createApp } = require('../dist/main');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const app = await createApp({ logger: false });
  t.after(() => app.close());
  const client = app.get(PrismaService).getClient();
  const [identity] = await client.$queryRaw`SELECT current_database() AS db, host(inet_server_addr()) AS host`;
  assert.equal(identity.db, url.pathname.slice(1));
  assert.ok(['127.0.0.1', '::1'].includes(identity.host));
  assert.equal(await client.user.count(), 0, 'Expected a fresh database without users');

  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);
  const [first, second] = await client.$transaction([
    client.user.create({ data: { name: 'Session test user', phone: '0999100001', passwordHash, isCustomer: true } }),
    client.user.create({ data: { name: 'Other session test user', phone: '0999100002', passwordHash, isMarketer: true } }),
  ]);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const post = (path, body, bearer) => fetch(`${base}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const jwt = new JwtService();
  const verify = (token) => jwt.verifyAsync(token, { secret, algorithms: ['HS256'] });
  const login = async (user) => {
    const response = await post('login', { phone: user.phone, password });
    assert.equal(response.status, 200);
    return response.json();
  };
  const refresh = (refreshToken) => post('refresh', { refreshToken });
  const expectError = async (response, code, status = 401) => {
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  };
  const readSession = (id) => client.userSession.findUniqueOrThrow({ where: { id } });

  const original = await login(first);
  const originalClaims = await verify(original.accessToken);
  const initial = await readSession(originalClaims.sid);
  let current;

  await t.test('rotation returns AuthSession and leaves activity and expiry unchanged', async () => {
    const response = await refresh(original.refreshToken);
    assert.equal(response.status, 200);
    current = await response.json();
    assert.deepEqual(Object.keys(current).sort(), ['accessToken', 'expiresInSeconds', 'refreshToken', 'user']);
    assert.deepEqual(current.user, original.user);
    assert.equal(current.expiresInSeconds, 900);
    assert.ok(current.refreshToken !== original.refreshToken && current.accessToken !== original.accessToken);
    const claims = await verify(current.accessToken);
    assert.equal(claims.sub, first.id);
    assert.equal(claims.sid, initial.id);
    assert.equal(claims.exp - claims.iat, 900);
    const after = await readSession(initial.id);
    assert.ok(after.refreshTokenHash === createHash('sha256').update(current.refreshToken).digest('hex'));
    assert.deepEqual(after.lastActivityAt, initial.lastActivityAt);
    assert.deepEqual(after.expiresAt, initial.expiresAt);
    await expectError(await refresh(original.refreshToken), 'REFRESH_TOKEN_INVALID');
    const next = await refresh(current.refreshToken);
    assert.equal(next.status, 200);
    current = await next.json();
  });

  await t.test('concurrent refresh has one winner and creates no extra session', async () => {
    const replayed = current.refreshToken;
    const responses = await Promise.all([refresh(replayed), refresh(replayed)]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 401]);
    await expectError(responses.find(({ status }) => status === 401), 'REFRESH_TOKEN_INVALID');
    current = await responses.find(({ status }) => status === 200).json();
    assert.equal(await client.userSession.count({ where: { userId: first.id } }), 1);
  });

  await t.test('unknown, expired and inactive sessions reject refresh', async () => {
    await expectError(await refresh('unknown-token'), 'REFRESH_TOKEN_INVALID');
    const expired = await login(first);
    const expiryClaims = await verify(expired.accessToken);
    await client.userSession.update({ where: { id: expiryClaims.sid }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectError(await refresh(expired.refreshToken), 'SESSION_EXPIRED');
    const inactive = await login(first);
    const inactiveClaims = await verify(inactive.accessToken);
    await client.userSession.update({ where: { id: inactiveClaims.sid }, data: { lastActivityAt: new Date(Date.now() - 31 * 86400000) } });
    await expectError(await refresh(inactive.refreshToken), 'SESSION_EXPIRED');
  });

  await t.test('logout verifies the bearer, ownership and optional refresh token', async () => {
    const other = await login(second);
    await expectError(await post('logout'), 'AUTH_REQUIRED');
    await expectError(await post('logout', {}, 'invalid-token'), 'AUTH_REQUIRED');
    const wrongSignature = await jwt.signAsync({ sub: first.id, sid: initial.id }, { secret: randomBytes(32), expiresIn: 900 });
    await expectError(await post('logout', {}, wrongSignature), 'AUTH_REQUIRED');
    const expiredBearer = await jwt.signAsync({ sub: first.id, sid: initial.id }, { secret, expiresIn: -1 });
    await expectError(await post('logout', {}, expiredBearer), 'AUTH_REQUIRED');
    const wrongOwner = await jwt.signAsync({ sub: second.id, sid: initial.id }, { secret, expiresIn: 900 });
    await expectError(await post('logout', {}, wrongOwner), 'AUTH_REQUIRED');
    await expectError(await post('logout', { refreshToken: other.refreshToken }, current.accessToken), 'REFRESH_TOKEN_INVALID');
    assert.equal((await readSession(initial.id)).revokedAt, null);

    const response = await post('logout', { refreshToken: current.refreshToken }, current.accessToken);
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    const revoked = await readSession(initial.id);
    assert.ok(revoked.revokedAt instanceof Date);
    const repeat = await post('logout', undefined, current.accessToken);
    assert.equal(repeat.status, 204);
    assert.equal(await repeat.text(), '');
    assert.deepEqual(await readSession(initial.id), revoked);
    await expectError(await refresh(current.refreshToken), 'REFRESH_TOKEN_INVALID');
    assert.equal((await readSession((await verify(other.accessToken)).sid)).revokedAt, null);
  });

  await t.test('Swagger exposes refresh and bearer-authenticated logout', async () => {
    const response = await fetch(`${base}/api/docs-json`);
    assert.equal(response.status, 200);
    const { paths } = await response.json();
    const refreshSpec = paths['/api/v1/auth/refresh'].post;
    const logoutSpec = paths['/api/v1/auth/logout'].post;
    assert.equal(refreshSpec.requestBody.content['application/json'].schema.$ref, '#/components/schemas/RefreshDto');
    assert.equal(refreshSpec.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/AuthSessionDto');
    assert.equal(logoutSpec.requestBody.required, false);
    assert.equal(logoutSpec.requestBody.content['application/json'].schema.$ref, '#/components/schemas/LogoutDto');
    assert.deepEqual(logoutSpec.security, [{ bearer: [] }]);
    assert.ok(!logoutSpec.responses['204'].content);
    for (const spec of [refreshSpec, logoutSpec]) {
      for (const status of ['400', '401', '429', '500']) {
        assert.equal(spec.responses[status].content['application/json'].schema.$ref, '#/components/schemas/AuthErrorDto');
      }
    }
  });
});
