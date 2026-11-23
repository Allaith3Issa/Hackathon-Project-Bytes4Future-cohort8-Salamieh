import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedActor } from '../../common/auth-actor';
import { apiError } from '../../common/api-error';
import { IdempotencyService } from '../../common/idempotency.service';
import {
  calculateOfferAmounts,
  parseSyp,
  sypNumber,
} from '../../common/money';
import { DatabaseService } from '../../database/database.service';
import { CampaignClosureService } from '../../campaign/campaign-closure.service';
import { RedeemOfferDto, ScannerLookupDto } from './scanner.dto';

type CampaignStatus = 'active' | 'ended';
type OfferLookup = {
  kind: 'offer_qr';
  passId: string;
  campaignId: string;
  campaignType: 'product' | 'store_discount';
  productName: string;
  customerName: string;
  discountPercent: number;
  finalPriceSyp: number | null;
  maxQuantity: number | null;
  availableQuantityOptions: { quantity: number; customerPaidCashSyp: number }[];
  status: 'active';
};

export type OfferRedeemResult = {
  saleId: string;
  campaignId: string;
  productName: string;
  quantity: number;
  originalAmountSyp: number;
  customerPaidCashSyp: number;
  marketerCommissionSyp: number;
  platformTotalFeeSyp: number;
  customerCashbackSyp: number;
  platformNetFeeSyp: number;
  remainingLockedBudgetSyp: number;
  campaignStatusAfterSale: CampaignStatus;
  scannedAt: string;
};

type CampaignRow = {
  id: string;
  merchant_id: string;
  campaign_type: string;
  product_name: string;
  original_price_syp: string;
  discount_percent: string;
  commission_type: string;
  commission_value: string;
  max_items: number;
  locked_budget_syp: string;
  status: CampaignStatus;
  ends_at: Date;
  verification_status: string;
};

@Injectable()
export class ScannerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly campaignClosure: CampaignClosureService,
  ) {}

  async lookup(
    actor: AuthenticatedActor,
    input: ScannerLookupDto,
  ): Promise<OfferLookup> {
    const result = await this.database.query<{
      pass_id: string;
      campaign_id: string;
      campaign_type: string;
      product_name: string;
      customer_name: string;
      original_price_syp: string;
      discount_percent: string;
      status: string;
      ends_at: Date;
      merchant_id: string;
      verification_status: string;
      campaign_status: string;
    }>(
      `SELECT p.id AS pass_id, c.id AS campaign_id, c.campaign_type,
              c.product_name, u.name AS customer_name,
              c.original_price_syp::text, c.discount_percent::text,
              p.status, c.ends_at, c.merchant_id, mp.verification_status,
              c.status AS campaign_status
       FROM offer_qr_passes p
       JOIN campaigns c ON c.id = p.campaign_id
       JOIN merchant_profiles mp ON mp.user_id = c.merchant_id
       JOIN users u ON u.id = p.customer_id
       WHERE (p.qr_token = $1 OR p.pass_code = $1)
         AND c.merchant_id = $2
       LIMIT 1`,
      [input.code, actor.id],
    );
    const pass = result.rows[0];
    if (!pass) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }
    if (pass.verification_status !== 'verified') {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'MERCHANT_NOT_VERIFIED',
        'Only verified merchants can scan Offer QRs.',
      );
    }
    if (pass.status !== 'active') {
      throw apiError(
        HttpStatus.CONFLICT,
        pass.status === 'expired' ? 'QR_EXPIRED' : 'QR_ALREADY_REDEEMED',
        pass.status === 'expired'
          ? 'This Offer QR has expired.'
          : 'This Offer QR has already been redeemed.',
      );
    }
    if (!pass.original_price_syp || !pass.product_name) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }
    if (pass.ends_at.getTime() <= Date.now() || pass.campaign_status !== 'active') {
      throw apiError(
        HttpStatus.CONFLICT,
        'CAMPAIGN_ENDED',
        'This campaign is no longer available.',
      );
    }

    const finalPrice = calculateOfferAmounts({
      originalPriceSyp: pass.original_price_syp,
      discountPercent: pass.discount_percent,
      fixedCommissionSyp: 0,
    }).customerPaidCashSyp;

    return {
      kind: 'offer_qr',
      passId: pass.pass_id,
      campaignId: pass.campaign_id,
      campaignType: 'product',
      productName: pass.product_name,
      customerName: pass.customer_name,
      discountPercent: Number(pass.discount_percent),
      finalPriceSyp: sypNumber(finalPrice),
      maxQuantity: 1,
      availableQuantityOptions: [
        { quantity: 1, customerPaidCashSyp: sypNumber(finalPrice) },
      ],
      status: 'active',
    };
  }

  async redeemOffer(
    actor: AuthenticatedActor,
    requestKey: string,
    input: RedeemOfferDto,
  ): Promise<OfferRedeemResult> {
    if (input.originalBillSyp !== undefined || (input.quantity ?? 1) !== 1) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Demo Offer QR redemption accepts one product item and no bill total.',
      );
    }

    return this.database.transaction(async (client) => {
      const replay = await this.idempotency.execute<OfferRedeemResult>(
        client,
        {
          actorId: actor.id,
          operation: 'merchant.offer_redeem',
          requestKey,
          fingerprintValue: { code: input.code, quantity: 1 },
        },
        async () => ({
          statusCode: HttpStatus.CREATED,
          body: await this.settleOffer(client, actor, input.code),
        }),
      );
      return replay.body;
    });
  }

  private async settleOffer(
    client: PoolClient,
    actor: AuthenticatedActor,
    code: string,
  ): Promise<OfferRedeemResult> {
    const reference = await client.query<{ campaign_id: string }>(
      `SELECT campaign_id FROM offer_qr_passes
       WHERE qr_token = $1 OR pass_code = $1
       LIMIT 1`,
      [code],
    );
    const campaignId = reference.rows[0]?.campaign_id;
    if (!campaignId) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }

    const campaignResult = await client.query<CampaignRow>(
      `SELECT c.id, c.merchant_id, c.campaign_type, c.product_name,
              c.original_price_syp::text, c.discount_percent::text,
              c.commission_type, c.commission_value::text, c.max_items,
              c.locked_budget_syp::text, c.status, c.ends_at,
              mp.verification_status
       FROM campaigns c
       JOIN merchant_profiles mp ON mp.user_id = c.merchant_id
       WHERE c.id = $1 AND c.merchant_id = $2
       FOR UPDATE OF c, mp`,
      [campaignId, actor.id],
    );
    const campaign = campaignResult.rows[0];
    if (!campaign) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }
    if (campaign.verification_status !== 'verified') {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'MERCHANT_NOT_VERIFIED',
        'Only verified merchants can redeem Offer QRs.',
      );
    }
    if (campaign.campaign_type !== 'product') {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }

    const passResult = await client.query<{
      id: string;
      customer_id: string;
      campaign_marketer_id: string | null;
      pass_status: string;
      marketer_id: string | null;
    }>(
      `SELECT p.id, p.customer_id, p.campaign_marketer_id,
              p.status AS pass_status, cm.marketer_id
       FROM offer_qr_passes p
       LEFT JOIN campaign_marketers cm
         ON cm.id = p.campaign_marketer_id
       WHERE p.campaign_id = $1 AND (p.qr_token = $2 OR p.pass_code = $2)
       FOR UPDATE OF p`,
      [campaign.id, code],
    );
    const pass = passResult.rows[0];
    if (!pass) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }
    if (pass.pass_status !== 'active') {
      throw apiError(
        HttpStatus.CONFLICT,
        pass.pass_status === 'expired' ? 'QR_EXPIRED' : 'QR_ALREADY_REDEEMED',
        pass.pass_status === 'expired'
          ? 'This Offer QR has expired.'
          : 'This Offer QR has already been redeemed.',
      );
    }
    if (campaign.status !== 'active' || campaign.ends_at.getTime() <= Date.now()) {
      throw apiError(
        HttpStatus.CONFLICT,
        'CAMPAIGN_ENDED',
        'This campaign is no longer available.',
      );
    }

    const amounts = calculateOfferAmounts({
      originalPriceSyp: campaign.original_price_syp,
      discountPercent: campaign.discount_percent,
      fixedCommissionSyp: pass.campaign_marketer_id
        ? campaign.commission_value
        : 0,
    });
    if (
      campaign.commission_type !== 'fixed' ||
      amounts.marketerCommissionSyp + amounts.platformTotalFeeSyp >=
        amounts.customerPaidCashSyp
    ) {
      throw apiError(
        HttpStatus.CONFLICT,
        'AMOUNT_OUT_OF_RANGE',
        'The campaign pricing configuration is invalid.',
      );
    }

    const sales = await client.query<{ sold_items: string }>(
      `SELECT COALESCE(SUM(quantity), 0)::text AS sold_items
       FROM sales WHERE campaign_id = $1`,
      [campaign.id],
    );
    const soldItems = BigInt(sales.rows[0].sold_items);
    if (soldItems >= BigInt(campaign.max_items)) {
      throw apiError(
        HttpStatus.CONFLICT,
        'CAMPAIGN_ENDED',
        'This campaign has reached its sale limit.',
      );
    }

    const existingLockedBudget = parseSyp(campaign.locked_budget_syp);
    if (existingLockedBudget < amounts.totalDeductedReserveSyp) {
      throw apiError(
        HttpStatus.CONFLICT,
        'INSUFFICIENT_LOCKED_BUDGET',
        'The campaign reserve cannot cover this sale.',
      );
    }
    const remainingBeforeClose =
      existingLockedBudget - amounts.totalDeductedReserveSyp;
    const closesAtCap = soldItems + 1n >= BigInt(campaign.max_items);

    const walletUsers = [actor.id];
    if (pass.marketer_id) walletUsers.push(pass.marketer_id);
    const walletResult = await client.query<{
      id: string;
      user_id: string;
      role: string;
      available_balance_syp: string;
    }>(
      `SELECT id, user_id, role, available_balance_syp::text
       FROM wallets
       WHERE role IN ('merchant', 'marketer') AND user_id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [walletUsers],
    );
    const merchantWallet = walletResult.rows.find(
      (wallet) => wallet.user_id === actor.id && wallet.role === 'merchant',
    );
    const marketerWallet = pass.marketer_id
      ? walletResult.rows.find(
          (wallet) =>
            wallet.user_id === pass.marketer_id && wallet.role === 'marketer',
        )
      : undefined;
    if (!merchantWallet || (pass.marketer_id && !marketerWallet)) {
      throw new Error('A campaign participant is missing a required wallet');
    }
    const merchantBalance = parseSyp(merchantWallet.available_balance_syp);
    if (closesAtCap) {
      parseSyp(merchantBalance + remainingBeforeClose);
    }
    const marketerBalance = marketerWallet
      ? parseSyp(marketerWallet.available_balance_syp)
      : 0n;
    const marketerBalanceAfter =
      marketerBalance + amounts.marketerCommissionSyp;
    parseSyp(marketerBalanceAfter);

    const customerResult = await client.query<{
      verified_purchase_count: number;
      milestone_purchase_count: number;
      milestone_spend_syp: string;
      locked_cashback_syp: string;
      available_cashback_syp: string;
    }>(
      `SELECT verified_purchase_count, milestone_purchase_count,
              milestone_spend_syp::text, locked_cashback_syp::text,
              available_cashback_syp::text
       FROM customer_profiles
       WHERE user_id = $1
       FOR UPDATE`,
      [pass.customer_id],
    );
    const customer = customerResult.rows[0];
    if (!customer) {
      throw new Error('Offer QR customer profile is missing');
    }

    const milestonePurchaseCount = customer.milestone_purchase_count + 1;
    const milestoneSpendSyp =
      parseSyp(customer.milestone_spend_syp) + amounts.customerPaidCashSyp;
    const lockedCashback =
      parseSyp(customer.locked_cashback_syp) + amounts.customerCashbackSyp;
    const milestoneReached =
      milestonePurchaseCount >= 5 && milestoneSpendSyp >= 50_000n;
    const availableCashback = parseSyp(customer.available_cashback_syp);
    const cashbackToUnlock = milestoneReached ? lockedCashback : 0n;
    const lockedCashbackAfter = milestoneReached ? 0n : lockedCashback;
    const availableCashbackAfter = availableCashback + cashbackToUnlock;
    parseSyp(milestoneSpendSyp);
    parseSyp(lockedCashbackAfter);
    parseSyp(availableCashbackAfter);

    const saleId = randomUUID();
    const remainingLockedBudgetSyp = closesAtCap ? 0n : remainingBeforeClose;
    const scannedAt = new Date();
    await client.query(
      `INSERT INTO sales
         (id, offer_qr_pass_id, campaign_id, merchant_id,
          campaign_marketer_id, customer_id, attribution_source, quantity,
          original_amount_syp, customer_paid_cash_syp,
          marketer_commission_syp, platform_total_fee_syp,
          customer_cashback_syp, platform_net_fee_syp,
          total_deducted_reserve_syp, scanned_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        saleId,
        pass.id,
        campaign.id,
        actor.id,
        pass.campaign_marketer_id,
        pass.customer_id,
        pass.campaign_marketer_id ? 'marketer' : 'merchant_direct',
        amounts.originalAmountSyp.toString(),
        amounts.customerPaidCashSyp.toString(),
        amounts.marketerCommissionSyp.toString(),
        amounts.platformTotalFeeSyp.toString(),
        amounts.customerCashbackSyp.toString(),
        amounts.platformNetFeeSyp.toString(),
        amounts.totalDeductedReserveSyp.toString(),
        scannedAt,
      ],
    );

    await client.query(
      `UPDATE offer_qr_passes SET status = 'redeemed', redeemed_at = $2
       WHERE id = $1`,
      [pass.id, scannedAt],
    );
    await client.query(
      `UPDATE campaigns
       SET locked_budget_syp = $2
       WHERE id = $1`,
      [campaign.id, remainingBeforeClose.toString()],
    );

    if (marketerWallet && amounts.marketerCommissionSyp > 0n) {
      await client.query(
        `UPDATE wallets SET available_balance_syp = $2 WHERE id = $1`,
        [marketerWallet.id, marketerBalanceAfter.toString()],
      );
    }
    await client.query(
      `UPDATE customer_profiles
       SET verified_purchase_count = verified_purchase_count + 1,
           milestone_purchase_count = $2,
           milestone_spend_syp = $3,
           locked_cashback_syp = $4,
           available_cashback_syp = $5
       WHERE user_id = $1`,
      [
        pass.customer_id,
        milestoneReached ? 0 : milestonePurchaseCount,
        milestoneReached ? '0' : milestoneSpendSyp.toString(),
        lockedCashbackAfter.toString(),
        availableCashbackAfter.toString(),
      ],
    );

    await client.query(
      `INSERT INTO money_movements
         (campaign_id, sale_id, kind, amount_syp)
       VALUES ($1, $2, 'sale_reserve_debit', $3)`,
      [campaign.id, saleId, amounts.totalDeductedReserveSyp.toString()],
    );
    if (marketerWallet && amounts.marketerCommissionSyp > 0n) {
      await client.query(
        `INSERT INTO money_movements (wallet_id, sale_id, kind, amount_syp)
         VALUES ($1, $2, 'marketer_commission_credit', $3)`,
        [
          marketerWallet.id,
          saleId,
          amounts.marketerCommissionSyp.toString(),
        ],
      );
    }
    await client.query(
      `INSERT INTO money_movements (customer_id, sale_id, kind, amount_syp)
       VALUES ($1, $2, 'customer_cashback_accrual', $3)`,
      [pass.customer_id, saleId, amounts.customerCashbackSyp.toString()],
    );
    await client.query(
      `INSERT INTO money_movements (customer_id, sale_id, kind, amount_syp)
       VALUES ($1, $2, 'platform_net_fee', $3)`,
      [pass.customer_id, saleId, amounts.platformNetFeeSyp.toString()],
    );
    if (milestoneReached && cashbackToUnlock > 0n) {
      await client.query(
        `INSERT INTO money_movements (customer_id, sale_id, kind, amount_syp)
         VALUES ($1, $2, 'customer_cashback_milestone_unlock', $3)`,
        [pass.customer_id, saleId, cashbackToUnlock.toString()],
      );
    }

    if (closesAtCap) {
      const closure = await this.campaignClosure.closeWithinTransaction(
        client,
        campaign.id,
        scannedAt,
      );
      if (closure.remainingLockedBudgetSyp !== 0n) {
        throw new Error('Campaign close did not release its remaining reserve');
      }
    }

    return {
      saleId,
      campaignId: campaign.id,
      productName: campaign.product_name,
      quantity: 1,
      originalAmountSyp: sypNumber(amounts.originalAmountSyp),
      customerPaidCashSyp: sypNumber(amounts.customerPaidCashSyp),
      marketerCommissionSyp: sypNumber(amounts.marketerCommissionSyp),
      platformTotalFeeSyp: sypNumber(amounts.platformTotalFeeSyp),
      customerCashbackSyp: sypNumber(amounts.customerCashbackSyp),
      platformNetFeeSyp: sypNumber(amounts.platformNetFeeSyp),
      remainingLockedBudgetSyp: sypNumber(remainingLockedBudgetSyp),
      campaignStatusAfterSale: closesAtCap ? 'ended' : 'active',
      scannedAt: scannedAt.toISOString(),
    };
  }
}
