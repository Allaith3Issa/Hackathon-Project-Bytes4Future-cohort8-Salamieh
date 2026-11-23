import { randomUUID } from 'node:crypto';
import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedActor } from '../common/auth-actor';
import { apiError } from '../common/api-error';
import { IdempotencyService } from '../common/idempotency.service';
import { normalizePagination, pageResult } from '../common/pagination';
import { parseSyp, sypNumber } from '../common/money';
import { DatabaseService } from '../database/database.service';
import {
  CreatePayoutDto,
  DisputePayoutDto,
  MarkPayoutTransferredDto,
  PayoutListQueryDto,
  PayoutMethod,
  PayoutStatus,
  RejectPayoutDto,
  ResolvePayoutDisputeDto,
} from './payout.dto';

const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000;
const RECEIPT_URL_PREFIX = '/api/v1/marketer/payouts/';
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

type PayoutRow = {
  id: string;
  marketer_id: string;
  marketer_name: string;
  marketer_phone: string;
  amount_syp: string;
  method: PayoutMethod;
  account_details: string;
  status: PayoutStatus;
  transfer_reference: string | null;
  transfer_receipt_url: string | null;
  transferred_at: Date | null;
  confirmed_at: Date | null;
  dispute_reason: string | null;
  rejection_reason: string | null;
  dispute_resolution_outcome: 'confirm_paid' | 'return_funds' | null;
  dispute_resolution_note: string | null;
  reversal_reference: string | null;
  dispute_resolved_at: Date | null;
  created_at: Date;
};

type ReceiptUpload = {
  mimetype: string;
  buffer: Buffer;
  size: number;
};

export type PayoutRequest = {
  id: string;
  marketerId: string;
  marketerName: string;
  marketerPhone: string;
  amountSyp: number;
  method: PayoutMethod;
  accountDetails: string;
  status: PayoutStatus;
  transferReference: string | null;
  transferReceiptUrl: string | null;
  transferredAt: string | null;
  confirmedAt: string | null;
  disputeReason: string | null;
  rejectionReason: string | null;
  disputeResolution: {
    outcome: 'confirm_paid' | 'return_funds';
    note: string;
    reversalReference: string | null;
    resolvedAt: string;
  } | null;
  createdAt: string;
};

@Injectable()
export class PayoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutService.name);
  private reconciliationTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
  ) {}

  onModuleInit(): void {
    this.reconciliationTimer = setInterval(() => {
      void this.reconcileDuePayouts().catch((error: unknown) => {
        this.logger.error(
          'Automatic payout confirmation failed.',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, RECONCILIATION_INTERVAL_MS);
    this.reconciliationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
  }

  async request(
    actor: AuthenticatedActor,
    requestKey: string,
    input: CreatePayoutDto,
  ): Promise<PayoutRequest> {
    if (!input.accountDetails.trim()) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Account details cannot be blank.',
      );
    }
    const result = await this.database.transaction(async (client) =>
      this.idempotency.execute<PayoutRequest>(
        client,
        {
          actorId: actor.id,
          operation: 'marketer.payout_request',
          requestKey,
          fingerprintValue: {
            amountSyp: input.amountSyp,
            method: input.method,
            accountDetails: input.accountDetails.trim(),
          },
        },
        async () => ({
          statusCode: HttpStatus.CREATED,
          body: await this.requestWithinTransaction(client, actor, input),
        }),
      ),
    );
    return result.body;
  }

  async listMarketer(
    actor: AuthenticatedActor,
    query: PayoutListQueryDto,
  ) {
    return this.list(actor.id, query);
  }

  async listAdmin(query: PayoutListQueryDto) {
    return this.list(null, query);
  }

  async confirm(actor: AuthenticatedActor, payoutId: string) {
    return this.database.transaction(async (client) => {
      const payout = await this.lockPayout(client, payoutId, actor.id);
      if (payout.status === 'confirmed') return this.toPayout(payout);
      if (payout.status !== 'transferred') {
        throw this.invalidTransition();
      }

      await client.query(
        `UPDATE payout_requests
         SET status = 'confirmed',
             confirmed_at = CASE
               WHEN transferred_at <= now() - interval '72 hours'
                 THEN transferred_at + interval '72 hours'
               ELSE now()
             END
         WHERE id = $1`,
        [payoutId],
      );
      return this.toPayout(
        (await this.getPayout(client, payoutId)) as PayoutRow,
      );
    });
  }

  async dispute(
    actor: AuthenticatedActor,
    payoutId: string,
    input: DisputePayoutDto,
  ) {
    if (!input.reason.trim()) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'A dispute reason is required.',
      );
    }
    const result = await this.database.transaction(async (client) => {
      const payout = await this.lockPayout(client, payoutId, actor.id);
      if (payout.status === 'disputed') {
        if (payout.dispute_reason === input.reason.trim()) {
          return { payout: this.toPayout(payout), autoConfirmed: false };
        }
        throw this.invalidTransition();
      }
      if (payout.status !== 'transferred') {
        throw this.invalidTransition();
      }

      const due = await client.query<{ due: boolean }>(
        `SELECT transferred_at <= now() - interval '72 hours' AS due
         FROM payout_requests WHERE id = $1`,
        [payoutId],
      );
      if (due.rows[0]?.due) {
        await client.query(
          `UPDATE payout_requests
           SET status = 'confirmed',
               confirmed_at = transferred_at + interval '72 hours'
           WHERE id = $1 AND status = 'transferred'`,
          [payoutId],
        );
        return {
          payout: this.toPayout(
            (await this.getPayout(client, payoutId)) as PayoutRow,
          ),
          autoConfirmed: true,
        };
      }

      await client.query(
        `UPDATE payout_requests
         SET status = 'disputed', dispute_reason = $2
         WHERE id = $1`,
        [payoutId, input.reason.trim()],
      );
      return {
        payout: this.toPayout(
          (await this.getPayout(client, payoutId)) as PayoutRow,
        ),
        autoConfirmed: false,
      };
    });
    if (result.autoConfirmed) {
      throw this.invalidTransition(
        'The payout was automatically confirmed after 72 hours and can no longer be disputed.',
      );
    }
    return result.payout;
  }

  async uploadReceipt(
    payoutId: string,
    adminId: string,
    file: ReceiptUpload | undefined,
  ): Promise<{ transferReceiptUrl: string }> {
    const receipt = this.validateReceipt(file);
    return this.database.transaction(async (client) => {
      const payoutResult = await client.query<{
        status: PayoutStatus;
      }>(
        `SELECT status FROM payout_requests WHERE id = $1 FOR UPDATE`,
        [payoutId],
      );
      const payout = payoutResult.rows[0];
      if (!payout) {
        throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Payout not found.');
      }
      if (payout.status !== 'pending_review') {
        throw this.invalidTransition(
          'A transfer receipt can only be uploaded before the payout is transferred.',
        );
      }

      const transferReceiptUrl = this.receiptUrl(payoutId);
      await client.query(
        `INSERT INTO payout_receipt_files
           (payout_id, content_type, file_data, uploaded_by_admin_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (payout_id) DO UPDATE
         SET content_type = EXCLUDED.content_type,
             file_data = EXCLUDED.file_data,
             uploaded_by_admin_id = EXCLUDED.uploaded_by_admin_id,
             uploaded_at = now()`,
        [payoutId, receipt.contentType, receipt.data, adminId],
      );
      await client.query(
        `UPDATE payout_requests SET transfer_receipt_url = $2 WHERE id = $1`,
        [payoutId, transferReceiptUrl],
      );
      return { transferReceiptUrl };
    });
  }

  async getReceipt(actor: AuthenticatedActor, payoutId: string) {
    const result = await this.database.query<{
      marketer_id: string;
      content_type: string;
      file_data: Buffer;
    }>(
      `SELECT p.marketer_id, f.content_type, f.file_data
       FROM payout_requests p
       JOIN payout_receipt_files f ON f.payout_id = p.id
       WHERE p.id = $1`,
      [payoutId],
    );
    const receipt = result.rows[0];
    if (
      !receipt ||
      (!actor.roles.includes('admin') && receipt.marketer_id !== actor.id)
    ) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Receipt not found.');
    }
    return {
      contentType: receipt.content_type,
      data: receipt.file_data,
    };
  }

  async markTransferred(
    payoutId: string,
    input: MarkPayoutTransferredDto,
  ): Promise<PayoutRequest> {
    if (!input.transferReference.trim() || !input.transferReceiptUrl.trim()) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'A transfer reference and receipt URL are required.',
      );
    }
    try {
      return await this.database.transaction(async (client) => {
        const payout = await this.lockPayout(client, payoutId);
        const reference = input.transferReference.trim();
        const receiptUrl = input.transferReceiptUrl.trim();
        if (
          ['transferred', 'confirmed', 'disputed'].includes(payout.status) &&
          payout.transfer_reference === reference &&
          payout.transfer_receipt_url === receiptUrl
        ) {
          return this.toPayout(payout);
        }
        if (payout.status !== 'pending_review') {
          throw this.invalidTransition();
        }
        const receipt = await client.query<{ payout_id: string }>(
          `SELECT payout_id FROM payout_receipt_files WHERE payout_id = $1`,
          [payoutId],
        );
        if (
          receipt.rowCount === 0 ||
          receiptUrl !== this.receiptUrl(payoutId) ||
          payout.transfer_receipt_url !== receiptUrl
        ) {
          throw apiError(
            HttpStatus.BAD_REQUEST,
            'VALIDATION_ERROR',
            'Upload and use this payout’s stored transfer receipt.',
          );
        }

        const walletResult = await client.query<{
          id: string;
          pending_payout_syp: string;
        }>(
          `SELECT id, pending_payout_syp::text
           FROM wallets WHERE user_id = $1 AND role = 'marketer'
           FOR UPDATE`,
          [payout.marketer_id],
        );
        const wallet = walletResult.rows[0];
        if (!wallet) {
          throw new Error('Payout marketer wallet is missing');
        }
        const pending = parseSyp(wallet.pending_payout_syp);
        const amount = parseSyp(payout.amount_syp);
        if (pending < amount) {
          throw new Error('Payout hold exceeds the marketer pending balance');
        }
        const transferredAt = new Date();
        await client.query(
          `UPDATE wallets SET pending_payout_syp = $2 WHERE id = $1`,
          [wallet.id, (pending - amount).toString()],
        );
        await client.query(
          `UPDATE payout_requests
           SET status = 'transferred', transfer_reference = $2,
               transfer_receipt_url = $3, transferred_at = $4
           WHERE id = $1`,
          [payoutId, reference, receiptUrl, transferredAt],
        );
        await client.query(
          `INSERT INTO money_movements
             (wallet_id, payout_id, kind, amount_syp)
           VALUES ($1, $2, 'payout_completed', $3)`,
          [wallet.id, payoutId, amount.toString()],
        );
        return this.toPayout(
          (await this.getPayout(client, payoutId)) as PayoutRow,
        );
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.invalidTransition(
          'This transfer reference has already been used for this payment method.',
        );
      }
      throw error;
    }
  }

  async reject(
    payoutId: string,
    input: RejectPayoutDto,
  ): Promise<PayoutRequest> {
    if (!input.reason.trim()) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'A rejection reason is required.',
      );
    }
    return this.database.transaction(async (client) => {
      const payout = await this.lockPayout(client, payoutId);
      if (payout.status === 'rejected' && payout.transfer_reference === null) {
        if (payout.rejection_reason === input.reason.trim()) {
          return this.toPayout(payout);
        }
        throw this.invalidTransition();
      }
      if (payout.status !== 'pending_review') {
        throw this.invalidTransition();
      }

      const walletResult = await client.query<{
        id: string;
        available_balance_syp: string;
        pending_payout_syp: string;
      }>(
        `SELECT id, available_balance_syp::text, pending_payout_syp::text
         FROM wallets WHERE user_id = $1 AND role = 'marketer'
         FOR UPDATE`,
        [payout.marketer_id],
      );
      const wallet = walletResult.rows[0];
      if (!wallet) {
        throw new Error('Payout marketer wallet is missing');
      }
      const amount = parseSyp(payout.amount_syp);
      const available = parseSyp(wallet.available_balance_syp);
      const pending = parseSyp(wallet.pending_payout_syp);
      if (pending < amount) {
        throw new Error('Payout hold exceeds the marketer pending balance');
      }
      const updatedAvailable = parseSyp(available + amount);
      await client.query(
        `UPDATE wallets
         SET available_balance_syp = $2, pending_payout_syp = $3
         WHERE id = $1`,
        [
          wallet.id,
          updatedAvailable.toString(),
          (pending - amount).toString(),
        ],
      );
      await client.query(
        `UPDATE payout_requests
         SET status = 'rejected', rejection_reason = $2
         WHERE id = $1`,
        [payoutId, input.reason.trim()],
      );
      await client.query(
        `INSERT INTO money_movements
           (wallet_id, payout_id, kind, amount_syp)
         VALUES ($1, $2, 'payout_release_refund', $3)`,
        [wallet.id, payoutId, amount.toString()],
      );
      return this.toPayout(
        (await this.getPayout(client, payoutId)) as PayoutRow,
      );
    });
  }

  async resolveDispute(
    payoutId: string,
    adminId: string,
    input: ResolvePayoutDisputeDto,
  ): Promise<PayoutRequest> {
    if (
      !input.note.trim() ||
      (input.outcome === 'return_funds' && !input.reversalReference?.trim())
    ) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'A resolution note and, when returning funds, a reversal reference are required.',
      );
    }
    try {
      return await this.database.transaction(async (client) => {
        const payout = await this.lockPayout(client, payoutId);
        const note = input.note.trim();
        const reversalReference = input.reversalReference?.trim() ?? null;
        if (
          payout.dispute_resolution_outcome === input.outcome &&
          payout.dispute_resolution_note === note &&
          payout.reversal_reference === reversalReference
        ) {
          return this.toPayout(payout);
        }
        if (payout.status !== 'disputed') {
          throw this.invalidTransition();
        }
        if (input.outcome === 'return_funds' && !reversalReference) {
          throw apiError(
            HttpStatus.BAD_REQUEST,
            'VALIDATION_ERROR',
            'A reversal reference is required when returning funds.',
          );
        }
        if (input.outcome === 'confirm_paid' && reversalReference !== null) {
          throw apiError(
            HttpStatus.BAD_REQUEST,
            'VALIDATION_ERROR',
            'A reversal reference is not valid when confirming payment.',
          );
        }

        let nextStatus: PayoutStatus = 'confirmed';
        if (input.outcome === 'return_funds') {
          const walletResult = await client.query<{
            id: string;
            available_balance_syp: string;
          }>(
            `SELECT id, available_balance_syp::text
             FROM wallets WHERE user_id = $1 AND role = 'marketer'
             FOR UPDATE`,
            [payout.marketer_id],
          );
          const wallet = walletResult.rows[0];
          if (!wallet) {
            throw new Error('Payout marketer wallet is missing');
          }
          const amount = parseSyp(payout.amount_syp);
          const available = parseSyp(wallet.available_balance_syp);
          const updatedAvailable = parseSyp(available + amount);
          await client.query(
            `UPDATE wallets SET available_balance_syp = $2 WHERE id = $1`,
            [wallet.id, updatedAvailable.toString()],
          );
          await client.query(
            `INSERT INTO money_movements
               (wallet_id, payout_id, kind, amount_syp)
             VALUES ($1, $2, 'payout_transfer_reversal', $3)`,
            [wallet.id, payoutId, amount.toString()],
          );
          nextStatus = 'rejected';
        }
        await client.query(
          `UPDATE payout_requests
           SET status = $2,
               confirmed_at = CASE WHEN $2 = 'confirmed' THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
               dispute_resolution_outcome = $3,
               dispute_resolution_note = $4,
               reversal_reference = $5,
               dispute_resolved_by_admin_id = $6,
               dispute_resolved_at = now()
           WHERE id = $1`,
          [
            payoutId,
            nextStatus,
            input.outcome,
            note,
            reversalReference,
            adminId,
          ],
        );
        return this.toPayout(
          (await this.getPayout(client, payoutId)) as PayoutRow,
        );
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.invalidTransition(
          'This reversal reference has already been used for this payment method.',
        );
      }
      throw error;
    }
  }

  async reconcileDuePayouts(): Promise<void> {
    await this.database.query(
      `UPDATE payout_requests
       SET status = 'confirmed',
           confirmed_at = transferred_at + interval '72 hours'
       WHERE status = 'transferred'
         AND transferred_at <= now() - interval '72 hours'`,
    );
  }

  private async requestWithinTransaction(
    client: PoolClient,
    actor: AuthenticatedActor,
    input: CreatePayoutDto,
  ): Promise<PayoutRequest> {
    const walletResult = await client.query<{
      id: string;
      available_balance_syp: string;
      pending_payout_syp: string;
      marketer_name: string;
      marketer_phone: string;
    }>(
      `SELECT w.id, w.available_balance_syp::text,
              w.pending_payout_syp::text, u.name AS marketer_name,
              u.phone AS marketer_phone
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1 AND w.role = 'marketer'
       FOR UPDATE OF w`,
      [actor.id],
    );
    const wallet = walletResult.rows[0];
    if (!wallet) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Marketer wallet not found.');
    }
    const amount = parseSyp(input.amountSyp);
    const available = parseSyp(wallet.available_balance_syp);
    if (available < amount) {
      throw apiError(
        HttpStatus.CONFLICT,
        'INSUFFICIENT_WALLET_BALANCE',
        'Available marketer balance is lower than the requested payout.',
      );
    }
    const pending = parseSyp(
      parseSyp(wallet.pending_payout_syp) + amount,
    );
    const payoutId = randomUUID();
    const created = await client.query<{ created_at: Date }>(
      `INSERT INTO payout_requests
         (id, marketer_id, wallet_id, amount_syp, method, account_details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING created_at`,
      [
        payoutId,
        actor.id,
        wallet.id,
        amount.toString(),
        input.method,
        input.accountDetails.trim(),
      ],
    );
    await client.query(
      `UPDATE wallets
       SET available_balance_syp = $2, pending_payout_syp = $3
       WHERE id = $1`,
      [wallet.id, (available - amount).toString(), pending.toString()],
    );
    await client.query(
      `INSERT INTO money_movements
         (wallet_id, payout_id, kind, amount_syp)
       VALUES ($1, $2, 'payout_hold', $3)`,
      [wallet.id, payoutId, amount.toString()],
    );
    return {
      id: payoutId,
      marketerId: actor.id,
      marketerName: wallet.marketer_name,
      marketerPhone: wallet.marketer_phone,
      amountSyp: sypNumber(amount),
      method: input.method,
      accountDetails: input.accountDetails.trim(),
      status: 'pending_review',
      transferReference: null,
      transferReceiptUrl: null,
      transferredAt: null,
      confirmedAt: null,
      disputeReason: null,
      rejectionReason: null,
      disputeResolution: null,
      createdAt: created.rows[0].created_at.toISOString(),
    };
  }

  private async list(
    marketerId: string | null,
    query: PayoutListQueryDto,
  ) {
    await this.reconcileDuePayouts();
    const pagination = normalizePagination(query);
    const values = [
      marketerId,
      query.status ?? null,
      pagination.pageSize,
      pagination.offset,
    ];
    const [count, rows] = await Promise.all([
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM payout_requests p
         WHERE ($1::uuid IS NULL OR p.marketer_id = $1)
           AND ($2::text IS NULL OR p.status = $2)`,
        values.slice(0, 2),
      ),
      this.database.query<PayoutRow>(
        `SELECT p.id, p.marketer_id, u.name AS marketer_name,
                u.phone AS marketer_phone, p.amount_syp::text, p.method,
                p.account_details, p.status, p.transfer_reference,
                p.transfer_receipt_url, p.transferred_at, p.confirmed_at,
                p.dispute_reason, p.rejection_reason,
                p.dispute_resolution_outcome, p.dispute_resolution_note,
                p.reversal_reference, p.dispute_resolved_at, p.created_at
         FROM payout_requests p
         JOIN users u ON u.id = p.marketer_id
         WHERE ($1::uuid IS NULL OR p.marketer_id = $1)
           AND ($2::text IS NULL OR p.status = $2)
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT $3 OFFSET $4`,
        values,
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => this.toPayout(row)),
      pagination.page,
      pagination.pageSize,
      count.rows[0]?.total ?? '0',
    );
  }

  private async lockPayout(
    client: PoolClient,
    payoutId: string,
    marketerId?: string,
  ): Promise<PayoutRow> {
    const result = await client.query<PayoutRow>(
      `SELECT p.id, p.marketer_id, u.name AS marketer_name,
              u.phone AS marketer_phone, p.amount_syp::text, p.method,
              p.account_details, p.status, p.transfer_reference,
              p.transfer_receipt_url, p.transferred_at, p.confirmed_at,
              p.dispute_reason, p.rejection_reason,
              p.dispute_resolution_outcome, p.dispute_resolution_note,
              p.reversal_reference, p.dispute_resolved_at, p.created_at
       FROM payout_requests p
       JOIN users u ON u.id = p.marketer_id
       WHERE p.id = $1 AND ($2::uuid IS NULL OR p.marketer_id = $2)
       FOR UPDATE OF p`,
      [payoutId, marketerId ?? null],
    );
    const payout = result.rows[0];
    if (!payout) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Payout not found.');
    }
    return payout;
  }

  private async getPayout(
    client: PoolClient,
    payoutId: string,
  ): Promise<PayoutRow | undefined> {
    const result = await client.query<PayoutRow>(
      `SELECT p.id, p.marketer_id, u.name AS marketer_name,
              u.phone AS marketer_phone, p.amount_syp::text, p.method,
              p.account_details, p.status, p.transfer_reference,
              p.transfer_receipt_url, p.transferred_at, p.confirmed_at,
              p.dispute_reason, p.rejection_reason,
              p.dispute_resolution_outcome, p.dispute_resolution_note,
              p.reversal_reference, p.dispute_resolved_at, p.created_at
       FROM payout_requests p
       JOIN users u ON u.id = p.marketer_id
       WHERE p.id = $1`,
      [payoutId],
    );
    return result.rows[0];
  }

  private validateReceipt(file: ReceiptUpload | undefined): {
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    data: Buffer;
  } {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.size < 1 ||
      file.size > MAX_RECEIPT_BYTES ||
      file.buffer.length !== file.size
    ) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'A receipt image up to 5 MB is required.',
      );
    }
    const contentType = this.detectImageType(file.buffer);
    if (!contentType || contentType !== file.mimetype) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Receipt must be a valid JPEG, PNG, or WebP image.',
      );
    }
    return { contentType, data: file.buffer };
  }

  private detectImageType(
    data: Buffer,
  ): 'image/jpeg' | 'image/png' | 'image/webp' | null {
    if (
      data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff
    ) {
      return 'image/jpeg';
    }
    if (
      data.length >= 8 &&
      data.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    ) {
      return 'image/png';
    }
    if (
      data.length >= 12 &&
      data.toString('ascii', 0, 4) === 'RIFF' &&
      data.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  private receiptUrl(payoutId: string): string {
    return `${RECEIPT_URL_PREFIX}${payoutId}/receipt`;
  }

  private toPayout(row: PayoutRow): PayoutRequest {
    return {
      id: row.id,
      marketerId: row.marketer_id,
      marketerName: row.marketer_name,
      marketerPhone: row.marketer_phone,
      amountSyp: sypNumber(parseSyp(row.amount_syp)),
      method: row.method,
      accountDetails: row.account_details,
      status: row.status,
      transferReference: row.transfer_reference,
      transferReceiptUrl: row.transfer_receipt_url,
      transferredAt: row.transferred_at?.toISOString() ?? null,
      confirmedAt: row.confirmed_at?.toISOString() ?? null,
      disputeReason: row.dispute_reason,
      rejectionReason: row.rejection_reason,
      disputeResolution:
        row.dispute_resolution_outcome &&
        row.dispute_resolution_note &&
        row.dispute_resolved_at
          ? {
              outcome: row.dispute_resolution_outcome,
              note: row.dispute_resolution_note,
              reversalReference: row.reversal_reference,
              resolvedAt: row.dispute_resolved_at.toISOString(),
            }
          : null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private invalidTransition(message = 'This payout status transition is not allowed.') {
    return apiError(
      HttpStatus.CONFLICT,
      'INVALID_STATUS_TRANSITION',
      message,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
