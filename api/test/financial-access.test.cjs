const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../dist/main');

test('financial routes reject requests without an authenticated actor', async (t) => {
  const app = await createApp({ logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();

  const requests = [
    fetch(`${baseUrl}/api/v1/admin/merchants/00000000-0000-4000-8000-000000000001/topups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amountSyp: 400000,
        paymentMethod: 'cash',
        referenceNote: 'Test',
      }),
    }),
    fetch(`${baseUrl}/api/v1/merchant/scanner/redeem-offer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'OF-DEMO01' }),
    }),
  ];

  const responses = await Promise.all(requests);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  }
});
