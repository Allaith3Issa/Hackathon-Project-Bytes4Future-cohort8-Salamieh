import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthenticatedActor } from '../common/auth-actor';
import { apiError } from '../common/api-error';
import { normalizePagination, pageResult } from '../common/pagination';
import { parseSyp, sypNumber } from '../common/money';
import { DatabaseService } from '../database/database.service';
import { PaginationQueryDto } from '../common/pagination.dto';

@Injectable()
export class WalletService {
  constructor(private readonly database: DatabaseService) {}

  async merchantWallet(actor: AuthenticatedActor) {
    const result = await this.database.query<{
      available_balance_syp: string;
      total_locked_reserves_syp: string;
      credit_limit_syp: string;
    }>(
      `SELECT w.available_balance_syp::text,
              COALESCE(SUM(c.locked_budget_syp), 0)::text AS total_locked_reserves_syp,
              mp.credit_limit_syp::text
       FROM wallets w
       JOIN merchant_profiles mp ON mp.user_id = w.user_id
       LEFT JOIN campaigns c ON c.merchant_id = w.user_id AND c.status = 'active'
       WHERE w.user_id = $1 AND w.role = 'merchant'
       GROUP BY w.id, mp.credit_limit_syp`,
      [actor.id],
    );
    const wallet = result.rows[0];
    if (!wallet) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Merchant wallet not found.');
    }
    return {
      availableBalanceSyp: sypNumber(parseSyp(wallet.available_balance_syp)),
      totalLockedReservesSyp: sypNumber(
        parseSyp(wallet.total_locked_reserves_syp),
      ),
      creditLimitSyp: sypNumber(parseSyp(wallet.credit_limit_syp)),
    };
  }

  async marketerWallet(actor: AuthenticatedActor) {
    const result = await this.database.query<{
      available_balance_syp: string;
      pending_payout_syp: string;
      total_earned_syp: string;
      total_confirmed_paid_out_syp: string;
    }>(
      `SELECT w.available_balance_syp::text,
              w.pending_payout_syp::text,
              COALESCE(SUM(m.amount_syp) FILTER (
                WHERE m.kind = 'marketer_commission_credit'
              ), 0)::text AS total_earned_syp,
              COALESCE((
                SELECT SUM(p.amount_syp)
                FROM payout_requests p
                WHERE p.marketer_id = w.user_id AND p.status = 'confirmed'
              ), 0)::text AS total_confirmed_paid_out_syp
       FROM wallets w
       LEFT JOIN money_movements m ON m.wallet_id = w.id
       WHERE w.user_id = $1 AND w.role = 'marketer'
       GROUP BY w.id`,
      [actor.id],
    );
    const wallet = result.rows[0];
    if (!wallet) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Marketer wallet not found.');
    }
    return {
      availableBalanceSyp: sypNumber(parseSyp(wallet.available_balance_syp)),
      pendingPayoutSyp: sypNumber(parseSyp(wallet.pending_payout_syp)),
      totalEarnedSyp: sypNumber(parseSyp(wallet.total_earned_syp)),
      totalConfirmedPaidOutSyp: sypNumber(
        parseSyp(wallet.total_confirmed_paid_out_syp),
      ),
    };
  }

  async customerDashboard(actor: AuthenticatedActor) {
    const result = await this.database.query<{
      verified_purchase_count: number;
      milestone_purchase_count: number;
      milestone_spend_syp: string;
      locked_cashback_syp: string;
      available_cashback_syp: string;
      total_cashback_unlocked_syp: string;
    }>(
      `SELECT cp.verified_purchase_count, cp.milestone_purchase_count,
              cp.milestone_spend_syp::text, cp.locked_cashback_syp::text,
              cp.available_cashback_syp::text,
              COALESCE((
                SELECT SUM(m.amount_syp)
                FROM money_movements m
                WHERE m.customer_id = cp.user_id
                  AND m.kind = 'customer_cashback_milestone_unlock'
              ), 0)::text AS total_cashback_unlocked_syp
       FROM customer_profiles cp
       WHERE cp.user_id = $1`,
      [actor.id],
    );
    const customer = result.rows[0];
    if (!customer) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Customer profile not found.');
    }
    return {
      verifiedPurchaseCount: customer.verified_purchase_count,
      milestonePurchaseCount: customer.milestone_purchase_count,
      milestonePurchasesRequired: 5,
      milestoneSpendSyp: sypNumber(parseSyp(customer.milestone_spend_syp)),
      milestoneSpendRequiredSyp: 50_000,
      lockedCashbackSyp: sypNumber(parseSyp(customer.locked_cashback_syp)),
      availableCashbackSyp: sypNumber(
        parseSyp(customer.available_cashback_syp),
      ),
      totalCashbackUnlockedSyp: sypNumber(
        parseSyp(customer.total_cashback_unlocked_syp),
      ),
    };
  }

  async merchantTransactions(
    actor: AuthenticatedActor,
    query: PaginationQueryDto,
  ) {
    const wallet = await this.database.query<{ id: string }>(
      `SELECT id FROM wallets WHERE user_id = $1 AND role = 'merchant'`,
      [actor.id],
    );
    if (!wallet.rows[0]) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Merchant wallet not found.');
    }
    const pagination = normalizePagination(query);
    const values = [wallet.rows[0].id, actor.id, pagination.pageSize, pagination.offset];
    const [count, rows] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM money_movements m
         WHERE m.wallet_id = $1
            OR (m.kind = 'sale_reserve_debit' AND EXISTS (
              SELECT 1 FROM campaigns c
              WHERE c.id = m.campaign_id AND c.merchant_id = $2
            ))`,
        values.slice(0, 2),
      ),
      this.database.query<{
        id: string;
        kind: string;
        amount_syp: string;
        campaign_id: string | null;
        campaign_name: string | null;
        reference_note: string | null;
        created_at: Date;
      }>(
        `SELECT m.id, m.kind, m.amount_syp::text, m.campaign_id,
                c.product_name AS campaign_name, t.reference_note, m.created_at
         FROM money_movements m
         LEFT JOIN campaigns c ON c.id = m.campaign_id
         LEFT JOIN merchant_topups t ON t.id = m.topup_id
         WHERE m.wallet_id = $1
            OR (m.kind = 'sale_reserve_debit' AND EXISTS (
              SELECT 1 FROM campaigns owner_campaign
              WHERE owner_campaign.id = m.campaign_id
                AND owner_campaign.merchant_id = $2
            ))
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $3 OFFSET $4`,
        values,
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountSyp: sypNumber(parseSyp(row.amount_syp)),
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        referenceNote: row.reference_note,
        createdAt: row.created_at.toISOString(),
      })),
      pagination.page,
      pagination.pageSize,
      count.rows[0]?.total ?? '0',
    );
  }

  async marketerTransactions(
    actor: AuthenticatedActor,
    query: PaginationQueryDto,
  ) {
    const wallet = await this.database.query<{ id: string }>(
      `SELECT id FROM wallets WHERE user_id = $1 AND role = 'marketer'`,
      [actor.id],
    );
    if (!wallet.rows[0]) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Marketer wallet not found.');
    }
    const pagination = normalizePagination(query);
    const values = [wallet.rows[0].id, pagination.pageSize, pagination.offset];
    const [count, rows] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM money_movements
         WHERE wallet_id = $1
           AND kind IN (
             'marketer_commission_credit', 'payout_hold',
             'payout_release_refund', 'payout_completed',
             'payout_transfer_reversal'
           )`,
        [wallet.rows[0].id],
      ),
      this.database.query<{
        id: string;
        kind: string;
        amount_syp: string;
        campaign_id: string | null;
        campaign_name: string | null;
        shop_name: string | null;
        created_at: Date;
      }>(
        `SELECT m.id, m.kind, m.amount_syp::text,
                COALESCE(m.campaign_id, s.campaign_id) AS campaign_id,
                c.product_name AS campaign_name, mp.shop_name, m.created_at
         FROM money_movements m
         LEFT JOIN sales s ON s.id = m.sale_id
         LEFT JOIN campaigns c ON c.id = COALESCE(m.campaign_id, s.campaign_id)
         LEFT JOIN merchant_profiles mp ON mp.user_id = c.merchant_id
         WHERE m.wallet_id = $1
           AND m.kind IN (
             'marketer_commission_credit', 'payout_hold',
             'payout_release_refund', 'payout_completed',
             'payout_transfer_reversal'
           )
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $2 OFFSET $3`,
        values,
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountSyp: sypNumber(parseSyp(row.amount_syp)),
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        shopName: row.shop_name,
        createdAt: row.created_at.toISOString(),
      })),
      pagination.page,
      pagination.pageSize,
      count.rows[0]?.total ?? '0',
    );
  }

  async marketerEarningsByMerchant(
    actor: AuthenticatedActor,
    query: PaginationQueryDto,
  ) {
    await this.marketerWallet(actor);
    const pagination = normalizePagination(query);
    const aggregate = `SELECT c.merchant_id, mp.shop_name,
                              count(*)::text AS sales_count,
                              sum(s.quantity)::text AS items_sold,
                              sum(s.marketer_commission_syp)::text AS earned_syp,
                              max(s.scanned_at) AS latest_sale_at
                       FROM sales s
                       JOIN campaign_marketers cm ON cm.id = s.campaign_marketer_id
                       JOIN campaigns c ON c.id = s.campaign_id
                       JOIN merchant_profiles mp ON mp.user_id = c.merchant_id
                       WHERE cm.marketer_id = $1
                       GROUP BY c.merchant_id, mp.shop_name`;
    const [count, rows] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM (${aggregate}) earnings`,
        [actor.id],
      ),
      this.database.query<{
        merchant_id: string;
        shop_name: string;
        sales_count: string;
        items_sold: string;
        earned_syp: string;
      }>(
        `SELECT * FROM (${aggregate}) earnings
        ORDER BY latest_sale_at DESC, merchant_id
         LIMIT $2 OFFSET $3`,
        [actor.id, pagination.pageSize, pagination.offset],
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => ({
        merchantId: row.merchant_id,
        shopName: row.shop_name,
        salesCount: safeCount(row.sales_count),
        itemsSold: safeCount(row.items_sold),
        totalEarnedSyp: sypNumber(parseSyp(row.earned_syp)),
      })),
      pagination.page,
      pagination.pageSize,
      count.rows[0]?.total ?? '0',
    );
  }

  async marketerStats(actor: AuthenticatedActor) {
    await this.marketerWallet(actor);
    const result = await this.database.query<{
      clicks: string;
      items_sold: string;
      earned_syp: string;
      latest_sale_at: Date;
    }>(
      `SELECT
         (SELECT count(*)::text
          FROM referral_clicks rc
          JOIN campaign_marketers cm ON cm.id = rc.campaign_marketer_id
          WHERE cm.marketer_id = $1) AS clicks,
         COALESCE(sum(s.quantity), 0)::text AS items_sold,
         COALESCE(sum(s.marketer_commission_syp), 0)::text AS earned_syp
       FROM campaign_marketers cm
       LEFT JOIN sales s ON s.campaign_marketer_id = cm.id
       WHERE cm.marketer_id = $1`,
      [actor.id],
    );
    const stats = result.rows[0];
    const clicks = BigInt(stats?.clicks ?? '0');
    const itemsSold = BigInt(stats?.items_sold ?? '0');
    return {
      clicks: safeCount(clicks),
      itemsSold: safeCount(itemsSold),
      earnedSyp: sypNumber(parseSyp(stats?.earned_syp ?? '0')),
      conversionRatePercent: conversionRate(itemsSold, clicks),
    };
  }

  async customerPurchases(
    actor: AuthenticatedActor,
    query: PaginationQueryDto,
  ) {
    await this.customerDashboard(actor);
    const pagination = normalizePagination(query);
    const values = [actor.id, pagination.pageSize, pagination.offset];
    const [count, rows] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM sales WHERE customer_id = $1`,
        [actor.id],
      ),
      this.database.query<{
        id: string;
        shop_name: string;
        product_name: string;
        quantity: number;
        customer_paid_cash_syp: string;
        customer_cashback_syp: string;
        scanned_at: Date;
      }>(
        `SELECT s.id, mp.shop_name, c.product_name, s.quantity,
                s.customer_paid_cash_syp::text,
                s.customer_cashback_syp::text, s.scanned_at
         FROM sales s
         JOIN campaigns c ON c.id = s.campaign_id
         JOIN merchant_profiles mp ON mp.user_id = s.merchant_id
         WHERE s.customer_id = $1
         ORDER BY s.scanned_at DESC, s.id DESC
         LIMIT $2 OFFSET $3`,
        values,
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => ({
        saleId: row.id,
        shopName: row.shop_name,
        productName: row.product_name,
        quantity: row.quantity,
        customerPaidCashSyp: sypNumber(parseSyp(row.customer_paid_cash_syp)),
        cashbackEarnedSyp: sypNumber(parseSyp(row.customer_cashback_syp)),
        scannedAt: row.scanned_at.toISOString(),
      })),
      pagination.page,
      pagination.pageSize,
      count.rows[0]?.total ?? '0',
    );
  }

  async merchantDashboard(actor: AuthenticatedActor) {
    const result = await this.database.query<{
      verification_status: string;
      available_balance_syp: string;
      total_locked_reserves_syp: string;
      credit_limit_syp: string;
      active_campaigns_count: string;
      top_campaign_id: string | null;
      top_campaign_product_name: string | null;
      top_campaign_gross_syp: string | null;
      top_campaign_sales_count: string | null;
      clicks: string;
      sales_count: string;
      items_sold: string;
      gross_cash_sales_syp: string;
      commission_paid_syp: string;
      platform_fees_paid_syp: string;
    }>(
      `SELECT mp.verification_status,
              w.available_balance_syp::text,
              COALESCE((SELECT sum(c.locked_budget_syp)
                        FROM campaigns c
                        WHERE c.merchant_id = mp.user_id AND c.status = 'active'), 0)::text
                AS total_locked_reserves_syp,
              mp.credit_limit_syp::text,
              (SELECT count(*)::text FROM campaigns c
               WHERE c.merchant_id = mp.user_id AND c.status = 'active')
                AS active_campaigns_count,
              top_campaign.id AS top_campaign_id,
              top_campaign.product_name AS top_campaign_product_name,
              top_campaign.gross_syp::text AS top_campaign_gross_syp,
              top_campaign.sales_count::text AS top_campaign_sales_count,
              (SELECT count(*)::text
               FROM referral_clicks rc
               JOIN campaigns c ON c.id = rc.campaign_id
               WHERE c.merchant_id = mp.user_id) AS clicks,
              (SELECT count(*)::text FROM sales s
               WHERE s.merchant_id = mp.user_id) AS sales_count,
              (SELECT COALESCE(sum(s.quantity), 0)::text FROM sales s
               WHERE s.merchant_id = mp.user_id) AS items_sold,
              (SELECT COALESCE(sum(s.customer_paid_cash_syp), 0)::text FROM sales s
               WHERE s.merchant_id = mp.user_id) AS gross_cash_sales_syp,
              (SELECT COALESCE(sum(s.marketer_commission_syp), 0)::text FROM sales s
               WHERE s.merchant_id = mp.user_id) AS commission_paid_syp,
              (SELECT COALESCE(sum(s.platform_total_fee_syp), 0)::text FROM sales s
               WHERE s.merchant_id = mp.user_id) AS platform_fees_paid_syp
       FROM merchant_profiles mp
       JOIN wallets w ON w.user_id = mp.user_id AND w.role = 'merchant'
       LEFT JOIN LATERAL (
         SELECT c.id, c.product_name,
                COALESCE(sum(s.customer_paid_cash_syp), 0) AS gross_syp,
                count(s.id) AS sales_count
         FROM campaigns c
         LEFT JOIN sales s ON s.campaign_id = c.id
         WHERE c.merchant_id = mp.user_id
         GROUP BY c.id
         ORDER BY gross_syp DESC, sales_count DESC, c.id
         LIMIT 1
       ) top_campaign ON true
       WHERE mp.user_id = $1`,
      [actor.id],
    );
    const row = result.rows[0];
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Merchant dashboard not found.');
    }
    const clicks = BigInt(row.clicks);
    const salesCount = BigInt(row.sales_count);
    const itemsSold = BigInt(row.items_sold);
    return {
      verificationStatus: row.verification_status,
      wallet: {
        availableBalanceSyp: sypNumber(parseSyp(row.available_balance_syp)),
        totalLockedReservesSyp: sypNumber(
          parseSyp(row.total_locked_reserves_syp),
        ),
        creditLimitSyp: sypNumber(parseSyp(row.credit_limit_syp)),
      },
      activeCampaignsCount: safeCount(row.active_campaigns_count),
      topCampaign: row.top_campaign_id
        ? {
            campaignId: row.top_campaign_id,
            productName: row.top_campaign_product_name ?? '',
            grossCashSalesSyp: sypNumber(
              parseSyp(row.top_campaign_gross_syp ?? '0'),
            ),
            salesCount: safeCount(row.top_campaign_sales_count ?? '0'),
          }
        : null,
      stats: {
        clicks: safeCount(clicks),
        salesCount: safeCount(salesCount),
        itemsSold: safeCount(itemsSold),
        grossCashSalesSyp: sypNumber(parseSyp(row.gross_cash_sales_syp)),
        commissionPaidSyp: sypNumber(parseSyp(row.commission_paid_syp)),
        platformFeesPaidSyp: sypNumber(parseSyp(row.platform_fees_paid_syp)),
        conversionRatePercent: conversionRate(itemsSold, clicks),
      },
    };
  }

  async adminOverview() {
    const result = await this.database.query<{
      merchant_count: string;
      marketer_count: string;
      customer_count: string;
      active_campaign_count: string;
      settled_sale_count: string;
      gross_cash_sales_volume_syp: string;
      total_merchant_topups_collected_syp: string;
      merchant_available_escrow_syp: string;
      campaign_locked_reserves_syp: string;
      marketer_available_liabilities_syp: string;
      marketer_pending_payout_liabilities_syp: string;
      marketer_transferred_unconfirmed_syp: string;
      customer_locked_cashback_pool_syp: string;
      customer_available_cashback_pool_syp: string;
      customer_reserved_voucher_cashback_syp: string;
      net_platform_fees_syp: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM merchant_profiles) AS merchant_count,
         (SELECT count(*)::text FROM wallets WHERE role = 'marketer') AS marketer_count,
         (SELECT count(*)::text FROM customer_profiles) AS customer_count,
         (SELECT count(*)::text FROM campaigns WHERE status = 'active') AS active_campaign_count,
         (SELECT count(*)::text FROM sales) AS settled_sale_count,
         (SELECT COALESCE(sum(customer_paid_cash_syp), 0)::text FROM sales)
           AS gross_cash_sales_volume_syp,
         (SELECT COALESCE(sum(amount_syp), 0)::text FROM merchant_topups)
           AS total_merchant_topups_collected_syp,
         (SELECT COALESCE(sum(available_balance_syp), 0)::text
          FROM wallets WHERE role = 'merchant') AS merchant_available_escrow_syp,
         (SELECT COALESCE(sum(locked_budget_syp), 0)::text
          FROM campaigns WHERE status = 'active') AS campaign_locked_reserves_syp,
         (SELECT COALESCE(sum(available_balance_syp), 0)::text
          FROM wallets WHERE role = 'marketer') AS marketer_available_liabilities_syp,
         (SELECT COALESCE(sum(pending_payout_syp), 0)::text
          FROM wallets WHERE role = 'marketer') AS marketer_pending_payout_liabilities_syp,
         (SELECT COALESCE(sum(amount_syp), 0)::text
          FROM payout_requests WHERE status IN ('transferred', 'disputed'))
           AS marketer_transferred_unconfirmed_syp,
         (SELECT COALESCE(sum(locked_cashback_syp), 0)::text
          FROM customer_profiles) AS customer_locked_cashback_pool_syp,
         (SELECT COALESCE(sum(available_cashback_syp), 0)::text
          FROM customer_profiles) AS customer_available_cashback_pool_syp,
         (SELECT COALESCE(sum(amount_syp), 0)::text
          FROM cashback_vouchers WHERE status = 'active')
           AS customer_reserved_voucher_cashback_syp,
         (SELECT COALESCE(sum(amount_syp), 0)::text
          FROM money_movements WHERE kind = 'platform_net_fee')
           AS net_platform_fees_syp`,
    );
    const row = result.rows[0];
    if (!row) throw new Error('Admin overview query returned no result');
    return {
      merchantCount: safeCount(row.merchant_count),
      marketerCount: safeCount(row.marketer_count),
      customerCount: safeCount(row.customer_count),
      activeCampaignCount: safeCount(row.active_campaign_count),
      settledSaleCount: safeCount(row.settled_sale_count),
      grossCashSalesVolumeSyp: sypNumber(parseSyp(row.gross_cash_sales_volume_syp)),
      totalMerchantTopupsCollectedSyp: sypNumber(
        parseSyp(row.total_merchant_topups_collected_syp),
      ),
      merchantAvailableEscrowSyp: sypNumber(
        parseSyp(row.merchant_available_escrow_syp),
      ),
      campaignLockedReservesSyp: sypNumber(
        parseSyp(row.campaign_locked_reserves_syp),
      ),
      marketerAvailableLiabilitiesSyp: sypNumber(
        parseSyp(row.marketer_available_liabilities_syp),
      ),
      marketerPendingPayoutLiabilitiesSyp: sypNumber(
        parseSyp(row.marketer_pending_payout_liabilities_syp),
      ),
      marketerTransferredUnconfirmedSyp: sypNumber(
        parseSyp(row.marketer_transferred_unconfirmed_syp),
      ),
      customerLockedCashbackPoolSyp: sypNumber(
        parseSyp(row.customer_locked_cashback_pool_syp),
      ),
      customerAvailableCashbackPoolSyp: sypNumber(
        parseSyp(row.customer_available_cashback_pool_syp),
      ),
      customerReservedVoucherCashbackSyp: sypNumber(
        parseSyp(row.customer_reserved_voucher_cashback_syp),
      ),
      netPlatformFeesSyp: sypNumber(parseSyp(row.net_platform_fees_syp)),
    };
  }

  async leaderboard(
    query: PaginationQueryDto,
    actorId?: string,
  ) {
    const pagination = normalizePagination(query);
    const ranked = `SELECT w.user_id, u.name, u.created_at,
                           COALESCE(sum(m.amount_syp) FILTER (
                             WHERE m.kind = 'marketer_commission_credit'
                           ), 0)::text AS earned_syp,
                           row_number() OVER (
                             ORDER BY COALESCE(sum(m.amount_syp) FILTER (
                               WHERE m.kind = 'marketer_commission_credit'
                             ), 0) DESC, u.created_at ASC, w.user_id ASC
                           )::text AS rank
                    FROM wallets w
                    JOIN users u ON u.id = w.user_id
                    LEFT JOIN money_movements m ON m.wallet_id = w.id
                    WHERE w.role = 'marketer'
                    GROUP BY w.id, w.user_id, u.name, u.created_at`;
    const values = [pagination.pageSize, pagination.offset];
    const [count, rows, myRank] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM (${ranked}) leaderboard`,
      ),
      this.database.query<{
        rank: string;
        user_id: string;
        name: string;
        earned_syp: string;
        created_at: Date;
      }>(
        `SELECT * FROM (${ranked}) leaderboard
         ORDER BY rank::bigint
         LIMIT $1 OFFSET $2`,
        values,
      ),
      actorId
        ? this.database.query<{ rank: string }>(
            `SELECT rank FROM (${ranked}) leaderboard WHERE user_id = $1`,
            [actorId],
          )
        : Promise.resolve({ rows: [] as { rank: string }[] }),
    ]);
    return {
      ...pageResult(
        rows.rows.map((row) => ({
          rank: safeCount(row.rank),
          marketerId: row.user_id,
          name: row.name,
          earnedSyp: sypNumber(parseSyp(row.earned_syp)),
          registeredAt: row.created_at.toISOString(),
        })),
        pagination.page,
        pagination.pageSize,
        count.rows[0]?.total ?? '0',
      ),
      myRank: myRank.rows[0] ? safeCount(myRank.rows[0].rank) : null,
    };
  }
}

function safeCount(value: string | bigint): number {
  const count = BigInt(value);
  if (count < 0n || count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'A reported count is outside the supported range.',
    );
  }
  return Number(count);
}

function conversionRate(itemsSold: bigint, clicks: bigint): number {
  if (clicks === 0n) return 0;
  const hundredths = (itemsSold * 10_000n + clicks / 2n) / clicks;
  const rate = Number(hundredths) / 100;
  if (!Number.isFinite(rate)) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'A reported conversion rate is outside the supported range.',
    );
  }
  return rate;
}
