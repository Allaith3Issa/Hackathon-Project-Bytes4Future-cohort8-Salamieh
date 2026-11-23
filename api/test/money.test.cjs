const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateOfferAmounts,
  calculateStoreDiscountAmounts,
  calculateVoucherCheckout,
} = require('../dist/common/money');

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

test('calculates store-discount checkout fees using discounted cash', () => {
  assert.deepEqual(
    calculateStoreDiscountAmounts({
      originalBillSyp: 20000,
      discountPercent: '10',
      commissionPercent: '5',
    }),
    {
      originalAmountSyp: 20000n,
      customerPaidCashSyp: 18000n,
      marketerCommissionSyp: 900n,
      platformTotalFeeSyp: 900n,
      customerCashbackSyp: 360n,
      platformNetFeeSyp: 540n,
      totalDeductedReserveSyp: 1800n,
    },
  );
});

test('voucher checkout returns exact cash due and rejects a bill below the voucher', () => {
  assert.deepEqual(calculateVoucherCheckout(5000, 20000), {
    amountSyp: 5000n,
    billTotalSyp: 20000n,
    customerPaidCashSyp: 15000n,
  });
  assert.throws(
    () => calculateVoucherCheckout(5000, 3000),
    (error) => {
      assert.equal(error.getStatus(), 409);
      assert.equal(error.getResponse().code, 'VOUCHER_EXCEEDS_BILL');
      return true;
    },
  );
});
