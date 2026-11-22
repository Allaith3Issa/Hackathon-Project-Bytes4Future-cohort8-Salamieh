const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../dist/main');

test('GET /api/v1/health returns 200 and the health status', async (t) => {
  const app = await createApp({ logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');

  const response = await fetch(`${await app.getUrl()}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
