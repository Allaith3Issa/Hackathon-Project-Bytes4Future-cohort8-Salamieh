import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthenticatedActor } from '../common/auth-actor';
import { apiError } from '../common/api-error';
import { parseSyp, sypNumber } from '../common/money';
import { DatabaseService } from '../database/database.service';

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
}
