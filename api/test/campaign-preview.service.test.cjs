const assert = require('node:assert/strict');
const test = require('node:test');
const { CampaignPreviewService } = require('../dist/campaign/campaign-preview.service');
const { MAX_MONEY_MINOR_UNITS } = require('../dist/common/money');

const previewInput = {
  campaignType: 'product',
  originalPriceSyp: 100000,
  discountPercent: 10,
  commission: { type: 'fixed', amountSyp: 10000 },
  maxItems: 30,
};

function createService(availableBalanceSyp) {
  const prisma = {
    getClient: () => ({
      user: {
        findUnique: async () => ({
          merchantProfile: { userId: 'merchant-id' },
          wallets: [{ availableBalanceSyp }],
        }),
      },
    }),
  };
  return new CampaignPreviewService(prisma);
}

test('campaign preview maps exact pricing and affordability without changing the balance', async () => {
  const service = createService(100000n);

  assert.deepEqual(await service.preview('merchant-id', previewInput), {
    finalPriceSyp: 90000,
    sampleSaleAmountSyp: 90000,
    commissionPerUnitSyp: 10000,
    platformTotalFeeSampleSyp: 4500,
    customerCashbackSampleSyp: 1800,
    platformNetFeeSampleSyp: 2700,
    merchantNetSampleSyp: 75500,
    worstCaseReserveSyp: 435000,
    isAffordableByMerchant: false,
    merchantAvailableBalanceSyp: 100000,
  });
});

test('campaign preview reports persisted balances outside the API range explicitly', async () => {
  for (const availableBalance of [MAX_MONEY_MINOR_UNITS + 1n, -1n]) {
    const service = createService(availableBalance);

    await assert.rejects(
      service.preview('merchant-id', previewInput),
      (error) => {
        assert.equal(error.getStatus(), 409);
        assert.deepEqual(error.getResponse(), {
          statusCode: 409,
          code: 'AMOUNT_OUT_OF_RANGE',
          message: 'A monetary value is outside the supported range.',
        });
        return true;
      },
    );
  }
});
