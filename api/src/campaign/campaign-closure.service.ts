import { HttpStatus, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { apiError } from '../common/api-error';
import { parseSyp } from '../common/money';

type LockedCampaign = {
  merchant_id: string;
  status: string;
  locked_budget_syp: string;
};

@Injectable()
export class CampaignClosureService {
  async closeWithinTransaction(
    client: PoolClient,
    campaignId: string,
    closedAt = new Date(),
  ): Promise<{ remainingLockedBudgetSyp: bigint }> {
    const campaignResult = await client.query<LockedCampaign>(
      `SELECT merchant_id, status, locked_budget_syp::text
       FROM campaigns
       WHERE id = $1
       FOR UPDATE`,
      [campaignId],
    );
    const campaign = campaignResult.rows[0];
    if (!campaign) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Campaign not found.');
    }

    const lockedBudget = parseSyp(campaign.locked_budget_syp);
    if (campaign.status === 'ended') {
      if (lockedBudget !== 0n) {
        throw new Error('Ended campaign has a nonzero locked reserve');
      }
      return { remainingLockedBudgetSyp: 0n };
    }

    const walletResult = await client.query<{
      id: string;
      available_balance_syp: string;
    }>(
      `SELECT id, available_balance_syp::text
       FROM wallets
       WHERE user_id = $1 AND role = 'merchant'
       FOR UPDATE`,
      [campaign.merchant_id],
    );
    const wallet = walletResult.rows[0];
    if (!wallet) {
      throw new Error('Campaign owner is missing a merchant wallet');
    }
    const availableBalance =
      parseSyp(wallet.available_balance_syp) + lockedBudget;
    parseSyp(availableBalance);

    await client.query(
      `UPDATE wallets SET available_balance_syp = $2 WHERE id = $1`,
      [wallet.id, availableBalance.toString()],
    );
    await client.query(
      `UPDATE campaigns
       SET status = 'ended', locked_budget_syp = 0, closed_at = $2
       WHERE id = $1`,
      [campaignId, closedAt],
    );
    await client.query(
      `UPDATE offer_qr_passes SET status = 'expired'
       WHERE campaign_id = $1 AND status = 'active'`,
      [campaignId],
    );
    if (lockedBudget > 0n) {
      await client.query(
        `INSERT INTO money_movements
           (wallet_id, campaign_id, kind, amount_syp)
         VALUES ($1, $2, 'campaign_reserve_unlock', $3)`,
        [wallet.id, campaignId, lockedBudget.toString()],
      );
    }
    return { remainingLockedBudgetSyp: 0n };
  }
}
