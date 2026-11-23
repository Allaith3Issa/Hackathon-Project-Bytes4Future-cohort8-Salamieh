const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../dist/main');

test('financial routes reject requests without an authenticated actor', async (t) => {
  const app = await createApp({ logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();

  const protectedRequests = [
    ['POST', '/api/v1/admin/merchants/00000000-0000-4000-8000-000000000001/topups'],
    ['POST', '/api/v1/merchant/scanner/redeem-offer'],
    ['POST', '/api/v1/merchant/scanner/preview-offer'],
    ['POST', '/api/v1/merchant/scanner/redeem-voucher'],
    ['GET', '/api/v1/merchant/wallet/transactions'],
    ['GET', '/api/v1/merchant/dashboard'],
    ['GET', '/api/v1/customer/cashback-vouchers'],
    ['POST', '/api/v1/customer/cashback-vouchers'],
    ['POST', '/api/v1/customer/cashback-vouchers/00000000-0000-4000-8000-000000000001/cancel'],
    ['GET', '/api/v1/customer/purchases'],
    ['GET', '/api/v1/marketer/wallet/by-merchant'],
    ['GET', '/api/v1/marketer/wallet/transactions'],
    ['GET', '/api/v1/marketer/stats'],
    ['POST', '/api/v1/marketer/payouts'],
    ['GET', '/api/v1/marketer/payouts'],
    ['POST', '/api/v1/marketer/payouts/00000000-0000-4000-8000-000000000001/confirm'],
    ['POST', '/api/v1/marketer/payouts/00000000-0000-4000-8000-000000000001/dispute'],
    ['GET', '/api/v1/marketer/payouts/00000000-0000-4000-8000-000000000001/receipt'],
    ['GET', '/api/v1/admin/payouts'],
    ['POST', '/api/v1/admin/payouts/00000000-0000-4000-8000-000000000001/upload-receipt'],
    ['PATCH', '/api/v1/admin/payouts/00000000-0000-4000-8000-000000000001/mark-transferred'],
    ['PATCH', '/api/v1/admin/payouts/00000000-0000-4000-8000-000000000001/reject'],
    ['PATCH', '/api/v1/admin/payouts/00000000-0000-4000-8000-000000000001/resolve-dispute'],
    ['GET', '/api/v1/admin/overview'],
  ];
  const requests = protectedRequests.map(([method, path]) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({}),
    }),
  );

  const responses = await Promise.all(requests);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  }
});
