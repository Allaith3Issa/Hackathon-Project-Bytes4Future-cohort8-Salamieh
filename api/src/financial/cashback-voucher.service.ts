import { randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedActor } from '../common/auth-actor';
import { apiError } from '../common/api-error';
import { IdempotencyService } from '../common/idempotency.service';
import { normalizePagination, pageResult } from '../common/pagination';
import {
  calculateVoucherCheckout,
  parseSyp,
  sypNumber,
} from '../common/money';
import { DatabaseService } from '../database/database.service';
import {
  CashbackVoucherListQueryDto,
  CreateCashbackVoucherDto,
} from './cashback-voucher.dto';

type VoucherStatus = 'active' | 'redeemed' | 'cancelled';

export type CashbackVoucher = {
  voucherId: string;
  amountSyp: number;
  qrToken: string;
  voucherCode: string;
  status: VoucherStatus;
  redeemedShopName: string | null;
  createdAt: string;
  redeemedAt: string | null;
};

export type VoucherRedeemResult = {
  voucherId: string;
  amountSyp: number;
  billTotalSyp: number;
  customerPaidCashSyp: number;
  merchantNewAvailableBalanceSyp: number;
  redeemedAt: string;
};

@Injectable()
export class CashbackVoucherService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async issue(
    actor: AuthenticatedActor,
    requestKey: string,
    input: CreateCashbackVoucherDto,
  ): Promise<CashbackVoucher> {
    const result = await this.database.transaction(async (client) =>
      this.idempotency.execute<CashbackVoucher>(
        client,
        {
          actorId: actor.id,
          operation: 'customer.cashback_voucher_issue',
          requestKey,
          fingerprintValue: input,
        },
        async () => ({
          statusCode: HttpStatus.CREATED,
          body: await this.issueWithinTransaction(client, actor, input),
        }),
      ),
    );
    return result.body;
  }

  async list(actor: AuthenticatedActor, query: CashbackVoucherListQueryDto) {
    const pagination = normalizePagination(query);
    const [count, rows] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM cashback_vouchers
         WHERE customer_id = $1 AND ($2::text IS NULL OR status = $2)`,
        [actor.id, query.status ?? null],
      ),
      this.database.query<{
        id: string;
        amount_syp: string;
        qr_token: string;
        voucher_code: string;
        status: VoucherStatus;
        redeemed_shop_name: string | null;
        created_at: Date;
        redeemed_at: Date | null;
      }>(
        `SELECT v.id, v.amount_syp::text, v.qr_token, v.voucher_code,
                v.status, mp.shop_name AS redeemed_shop_name,
                v.created_at, v.redeemed_at
         FROM cashback_vouchers v
         LEFT JOIN merchant_profiles mp
           ON mp.user_id = v.redeemed_by_merchant_id
         WHERE v.customer_id = $1 AND ($2::text IS NULL OR v.status = $2)
         ORDER BY v.created_at DESC, v.id DESC
         LIMIT $3 OFFSET $4`,
        [actor.id, query.status ?? null, pagination.pageSize, pagination.offset],
      ),
    ]);

    return pageResult(
      rows.rows.map((row) => this.toVoucher(row)),
      pagination.page,
      pagination.pageSize,
      count.rows[0]?.total ?? '0',
    );
  }

  async cancel(
    actor: AuthenticatedActor,
    voucherId: string,
  ): Promise<CashbackVoucher> {
    return this.database.transaction(async (client) => {
      const voucherResult = await client.query<{
        id: string;
        customer_id: string;
        amount_syp: string;
        qr_token: string;
        voucher_code: string;
        status: VoucherStatus;
        redeemed_shop_name: string | null;
        created_at: Date;
        redeemed_at: Date | null;
      }>(
        `SELECT v.id, v.customer_id, v.amount_syp::text, v.qr_token,
                v.voucher_code, v.status, mp.shop_name AS redeemed_shop_name,
                v.created_at, v.redeemed_at
         FROM cashback_vouchers v
         LEFT JOIN merchant_profiles mp
           ON mp.user_id = v.redeemed_by_merchant_id
         WHERE v.id = $1 AND v.customer_id = $2
         FOR UPDATE OF v`,
        [voucherId, actor.id],
      );
      const voucher = voucherResult.rows[0];
      if (!voucher) {
        throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Voucher not found.');
      }
      if (voucher.status === 'cancelled') {
        return this.toVoucher(voucher);
      }
      if (voucher.status !== 'active') {
        throw apiError(
          HttpStatus.CONFLICT,
          'INVALID_STATUS_TRANSITION',
          'A redeemed voucher cannot be cancelled.',
        );
      }

      const customerResult = await client.query<{
        available_cashback_syp: string;
      }>(
        `SELECT available_cashback_syp::text
         FROM customer_profiles
         WHERE user_id = $1
         FOR UPDATE`,
        [actor.id],
      );
      const customer = customerResult.rows[0];
      if (!customer) {
        throw new Error('Voucher customer profile is missing');
      }
      const restoredBalance =
        parseSyp(customer.available_cashback_syp) +
        parseSyp(voucher.amount_syp);
      parseSyp(restoredBalance);

      await client.query(
        `UPDATE customer_profiles
         SET available_cashback_syp = $2
         WHERE user_id = $1`,
        [actor.id, restoredBalance.toString()],
      );
      await client.query(
        `UPDATE cashback_vouchers
         SET status = 'cancelled'
         WHERE id = $1`,
        [voucher.id],
      );
      await client.query(
        `INSERT INTO money_movements
           (voucher_id, customer_id, kind, amount_syp)
         VALUES ($1, $2, 'cashback_voucher_reservation_release', $3)`,
        [voucher.id, actor.id, voucher.amount_syp],
      );

      return this.toVoucher({ ...voucher, status: 'cancelled' });
    });
  }

  async lookupForMerchant(
    actor: AuthenticatedActor,
    code: string,
  ): Promise<{
    kind: 'cashback_voucher';
    voucherId: string;
    customerName: string;
    amountSyp: number;
    status: 'active';
  }> {
    await this.assertVerifiedMerchant(this.database, actor.id);
    const result = await this.database.query<{
      id: string;
      customer_name: string;
      amount_syp: string;
      status: VoucherStatus;
    }>(
      `SELECT v.id, u.name AS customer_name, v.amount_syp::text, v.status
       FROM cashback_vouchers v
       JOIN users u ON u.id = v.customer_id
       WHERE v.qr_token = $1 OR v.voucher_code = $1
       LIMIT 1`,
      [code],
    );
    const voucher = result.rows[0];
    if (!voucher) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }
    this.assertRedeemableStatus(voucher.status);
    return {
      kind: 'cashback_voucher',
      voucherId: voucher.id,
      customerName: voucher.customer_name,
      amountSyp: sypNumber(parseSyp(voucher.amount_syp)),
      status: 'active',
    };
  }

  async redeemForMerchant(
    actor: AuthenticatedActor,
    requestKey: string,
    code: string,
    billTotalSyp: number,
  ): Promise<VoucherRedeemResult> {
    const result = await this.database.transaction(async (client) =>
      this.idempotency.execute<VoucherRedeemResult>(
        client,
        {
          actorId: actor.id,
          operation: 'merchant.cashback_voucher_redeem',
          requestKey,
          fingerprintValue: { code, billTotalSyp },
        },
        async () => ({
          statusCode: HttpStatus.OK,
          body: await this.redeemWithinTransaction(
            client,
            actor,
            code,
            billTotalSyp,
          ),
        }),
      ),
    );
    return result.body;
  }

  private async issueWithinTransaction(
    client: PoolClient,
    actor: AuthenticatedActor,
    input: CreateCashbackVoucherDto,
  ): Promise<CashbackVoucher> {
    const customerResult = await client.query<{
      available_cashback_syp: string;
    }>(
      `SELECT available_cashback_syp::text
       FROM customer_profiles
       WHERE user_id = $1
       FOR UPDATE`,
      [actor.id],
    );
    const customer = customerResult.rows[0];
    if (!customer) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Customer profile not found.');
    }

    const amount = parseSyp(input.amountSyp);
    const available = parseSyp(customer.available_cashback_syp);
    if (available < amount) {
      throw apiError(
        HttpStatus.CONFLICT,
        'INSUFFICIENT_CASHBACK_BALANCE',
        'Available cashback is lower than the requested voucher amount.',
      );
    }

    const voucherId = randomUUID();
    const qrToken = randomBytes(32).toString('base64url');
    const voucherCode = `CB-${randomBytes(6).toString('hex').toUpperCase()}`;
    const created = await client.query<{ created_at: Date }>(
      `INSERT INTO cashback_vouchers
         (id, customer_id, amount_syp, qr_token, voucher_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING created_at`,
      [voucherId, actor.id, amount.toString(), qrToken, voucherCode],
    );
    await client.query(
      `UPDATE customer_profiles
       SET available_cashback_syp = $2
       WHERE user_id = $1`,
      [actor.id, (available - amount).toString()],
    );
    await client.query(
      `INSERT INTO money_movements
         (voucher_id, customer_id, kind, amount_syp)
       VALUES ($1, $2, 'cashback_voucher_reservation', $3)`,
      [voucherId, actor.id, amount.toString()],
    );

    return {
      voucherId,
      amountSyp: sypNumber(amount),
      qrToken,
      voucherCode,
      status: 'active',
      redeemedShopName: null,
      createdAt: created.rows[0].created_at.toISOString(),
      redeemedAt: null,
    };
  }

  private async redeemWithinTransaction(
    client: PoolClient,
    actor: AuthenticatedActor,
    code: string,
    billTotalSyp: number,
  ): Promise<VoucherRedeemResult> {
    const merchantResult = await client.query<{
      wallet_id: string;
      available_balance_syp: string;
      verification_status: string;
    }>(
      `SELECT w.id AS wallet_id, w.available_balance_syp::text,
              mp.verification_status
       FROM merchant_profiles mp
       JOIN wallets w ON w.user_id = mp.user_id AND w.role = 'merchant'
       WHERE mp.user_id = $1
       FOR UPDATE OF mp, w`,
      [actor.id],
    );
    const merchant = merchantResult.rows[0];
    if (!merchant || merchant.verification_status !== 'verified') {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'MERCHANT_NOT_VERIFIED',
        'Only verified merchants can redeem cashback vouchers.',
      );
    }

    const voucherResult = await client.query<{
      id: string;
      amount_syp: string;
      status: VoucherStatus;
    }>(
      `SELECT id, amount_syp::text, status
       FROM cashback_vouchers
       WHERE qr_token = $1 OR voucher_code = $1
       FOR UPDATE`,
      [code],
    );
    const voucher = voucherResult.rows[0];
    if (!voucher) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Code not found.');
    }
    this.assertRedeemableStatus(voucher.status);

    const checkout = calculateVoucherCheckout(
      voucher.amount_syp,
      billTotalSyp,
    );
    const { amountSyp: amount, billTotalSyp: bill } = checkout;
    const newBalance = parseSyp(
      parseSyp(merchant.available_balance_syp) + amount,
    );
    const redeemedAt = new Date();
    await client.query(
      `UPDATE cashback_vouchers
       SET status = 'redeemed', redeemed_by_merchant_id = $2,
           redeemed_bill_total_syp = $3, redeemed_at = $4
       WHERE id = $1`,
      [voucher.id, actor.id, bill.toString(), redeemedAt],
    );
    await client.query(
      `UPDATE wallets SET available_balance_syp = $2
       WHERE id = $1`,
      [merchant.wallet_id, newBalance.toString()],
    );
    await client.query(
      `INSERT INTO money_movements
         (wallet_id, voucher_id, kind, amount_syp)
       VALUES ($1, $2, 'cashback_voucher_merchant_credit', $3)`,
      [merchant.wallet_id, voucher.id, amount.toString()],
    );

    return {
      voucherId: voucher.id,
      amountSyp: sypNumber(amount),
      billTotalSyp: sypNumber(bill),
      customerPaidCashSyp: sypNumber(checkout.customerPaidCashSyp),
      merchantNewAvailableBalanceSyp: sypNumber(newBalance),
      redeemedAt: redeemedAt.toISOString(),
    };
  }

  private async assertVerifiedMerchant(
    database: DatabaseService,
    merchantId: string,
  ): Promise<void> {
    const result = await database.query<{ verification_status: string }>(
      `SELECT verification_status
       FROM merchant_profiles
       WHERE user_id = $1`,
      [merchantId],
    );
    if (result.rows[0]?.verification_status !== 'verified') {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'MERCHANT_NOT_VERIFIED',
        'Only verified merchants can scan cashback vouchers.',
      );
    }
  }

  private assertRedeemableStatus(status: VoucherStatus): void {
    if (status === 'active') return;
    if (status === 'redeemed') {
      throw apiError(
        HttpStatus.CONFLICT,
        'QR_ALREADY_REDEEMED',
        'This cashback voucher has already been redeemed.',
      );
    }
    throw apiError(
      HttpStatus.CONFLICT,
      'INVALID_STATUS_TRANSITION',
      'A cancelled voucher cannot be redeemed.',
    );
  }

  private toVoucher(row: {
    id: string;
    amount_syp: string;
    qr_token: string;
    voucher_code: string;
    status: VoucherStatus;
    redeemed_shop_name: string | null;
    created_at: Date;
    redeemed_at: Date | null;
  }): CashbackVoucher {
    return {
      voucherId: row.id,
      amountSyp: sypNumber(parseSyp(row.amount_syp)),
      qrToken: row.qr_token,
      voucherCode: row.voucher_code,
      status: row.status,
      redeemedShopName: row.redeemed_shop_name,
      createdAt: row.created_at.toISOString(),
      redeemedAt: row.redeemed_at?.toISOString() ?? null,
    };
  }
}
