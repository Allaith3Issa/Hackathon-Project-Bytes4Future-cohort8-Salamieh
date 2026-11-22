import { HttpStatus, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedActor } from '../../common/auth-actor';
import { apiError } from '../../common/api-error';
import { IdempotencyService } from '../../common/idempotency.service';
import { parseSyp } from '../../common/money';
import { DatabaseService } from '../../database/database.service';
import { CreateTopupDto } from './topups.dto';

export type AdminTopupResult = {
  topupId: string;
  merchantId: string;
  shopName: string;
  amountSyp: number;
  paymentMethod: CreateTopupDto['paymentMethod'];
  referenceNote: string;
  merchantNewAvailableBalanceSyp: number;
  createdAt: string;
};

@Injectable()
export class TopupsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(
    actor: AuthenticatedActor,
    merchantId: string,
    requestKey: string,
    input: CreateTopupDto,
  ): Promise<AdminTopupResult> {
    return this.database.transaction(async (client) => {
      const result = await this.idempotency.execute<AdminTopupResult>(
        client,
        {
          actorId: actor.id,
          operation: 'admin.merchant_topup',
          requestKey,
          fingerprintValue: { merchantId, ...input },
        },
        async () => ({
          statusCode: HttpStatus.CREATED,
          body: await this.createTopup(client, actor, merchantId, input),
        }),
      );
      return result.body;
    });
  }

  private async createTopup(
    client: PoolClient,
    actor: AuthenticatedActor,
    merchantId: string,
    input: CreateTopupDto,
  ): Promise<AdminTopupResult> {
    const merchant = await client.query<{
      shop_name: string;
      verification_status: string;
      wallet_id: string;
      available_balance_syp: string;
    }>(
      `SELECT mp.shop_name, mp.verification_status, w.id AS wallet_id,
              w.available_balance_syp::text
       FROM merchant_profiles mp
       JOIN wallets w ON w.user_id = mp.user_id AND w.role = 'merchant'
       WHERE mp.user_id = $1
       FOR UPDATE OF mp, w`,
      [merchantId],
    );
    const profile = merchant.rows[0];
    if (!profile) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Merchant not found.');
    }
    if (profile.verification_status !== 'verified') {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'MERCHANT_NOT_VERIFIED',
        'Only verified merchants can receive top-ups.',
      );
    }

    const before = parseSyp(profile.available_balance_syp);
    const after = before + BigInt(input.amountSyp);
    parseSyp(after);

    const topup = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO merchant_topups
         (merchant_id, admin_id, amount_syp, payment_method, reference_note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        merchantId,
        actor.id,
        input.amountSyp,
        input.paymentMethod,
        input.referenceNote,
      ],
    );
    const topupRow = topup.rows[0];
    const updatedWallet = await client.query<{ available_balance_syp: string }>(
      `UPDATE wallets SET available_balance_syp = $2
       WHERE id = $1
       RETURNING available_balance_syp::text`,
      [profile.wallet_id, after.toString()],
    );
    await client.query(
      `INSERT INTO money_movements (wallet_id, topup_id, kind, amount_syp)
       VALUES ($1, $2, 'merchant_topup', $3)`,
      [profile.wallet_id, topupRow.id, input.amountSyp],
    );

    return {
      topupId: topupRow.id,
      merchantId,
      shopName: profile.shop_name,
      amountSyp: input.amountSyp,
      paymentMethod: input.paymentMethod,
      referenceNote: input.referenceNote,
      merchantNewAvailableBalanceSyp: Number(
        updatedWallet.rows[0].available_balance_syp,
      ),
      createdAt: topupRow.created_at.toISOString(),
    };
  }
}
