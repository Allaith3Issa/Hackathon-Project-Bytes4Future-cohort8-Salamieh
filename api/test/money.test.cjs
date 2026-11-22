const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateOfferAmounts } = require('../dist/common/money');

test('calculates the demo sale and keeps the cashback split reconciled', () => {
  const amounts = calculateOfferAmounts({
    originalPriceSyp: 100000,
    discountPercent: '10',
    fixedCommissionSyp: '10000.00',
  });

  assert.deepEqual(amounts, {
    originalAmountSyp: 100000n,
    customerPaidCashSyp: 90000n,
    marketerCommissionSyp: 10000n,
    platformTotalFeeSyp: 4500n,
    customerCashbackSyp: 1800n,
    platformNetFeeSyp: 2700n,
    totalDeductedReserveSyp: 14500n,
  });
  assert.equal(
    amounts.platformNetFeeSyp + amounts.customerCashbackSyp,
    amounts.platformTotalFeeSyp,
  );
});

test('rejects derived SYP values above the safe integer limit', () => {
  assert.throws(
    () =>
      calculateOfferAmounts({
        originalPriceSyp: Number.MAX_SAFE_INTEGER,
        discountPercent: 0,
        fixedCommissionSyp: Number.MAX_SAFE_INTEGER,
      }),
    (error) => {
      assert.equal(error.getStatus(), 409);
      assert.equal(error.getResponse().code, 'AMOUNT_OUT_OF_RANGE');
      return true;
    },
  );
});
