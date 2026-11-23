import { ConflictException, ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { MAX_MONEY_MINOR_UNITS, toMoneyJsonInteger } from '../common/money';
import { Prisma, type MerchantTopup, type MerchantVerificationStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminTopupPageDto, AdminTopupQueryDto, AdminTopupResultDto, CreateAdminTopupDto } from './admin-topup.dto';

function topupFields(topup: MerchantTopup, shopName: string): Omit<AdminTopupResultDto, 'merchantNewAvailableBalanceSyp'> {
  return { topupId: topup.id, merchantId: topup.merchantId, shopName, amountSyp: toMoneyJsonInteger(topup.amountSyp),
    paymentMethod: topup.paymentMethod, referenceNote: topup.referenceNote, createdAt: topup.createdAt.toISOString() };
}

@Injectable()
export class AdminTopupService {
  constructor(private readonly prisma: PrismaService, private readonly idempotency: IdempotencyService) {}

  create(adminId: string, merchantId: string, key: string, input: CreateAdminTopupDto) {
    const targetId = merchantId.toLowerCase();
    const { amountSyp: requestedAmount, paymentMethod, referenceNote } = input;
    const payload = { merchantId: targetId, amountSyp: requestedAmount, paymentMethod, referenceNote };
    return this.idempotency.execute<AdminTopupResultDto>({
      actorId: adminId, operation: 'admin.merchant.topup', key, payload,
    }, async (tx) => {
      // Match campaign launch: claim the request, lock the merchant profile, then update the merchant wallet.
      const [merchant] = await tx.$queryRaw<{ status: MerchantVerificationStatus; shopName: string }[]>`
        SELECT verification_status::text AS status, shop_name AS "shopName"
        FROM merchant_profiles WHERE user_id = ${targetId}::uuid FOR SHARE
      `;
      if (!merchant) {
        throw new NotFoundException({ statusCode: 404, code: 'NOT_FOUND', message: 'Merchant profile not found.' });
      }
      if (merchant.status !== 'verified') {
        throw new ForbiddenException({ statusCode: 403, code: 'MERCHANT_NOT_VERIFIED', message: 'Only verified merchants can receive top-ups.' });
      }

      const amountSyp = BigInt(requestedAmount);
      const { id: walletId } = await tx.wallet.findUniqueOrThrow({
        where: { userId_role: { userId: targetId, role: 'merchant' } }, select: { id: true },
      });
      // PostgreSQL rechecks the bound on the updated row after concurrent writers release the lock.
      const [wallet] = await tx.wallet.updateManyAndReturn({
        where: { id: walletId, availableBalanceSyp: { lte: MAX_MONEY_MINOR_UNITS - amountSyp } },
        data: { availableBalanceSyp: { increment: amountSyp } }, select: { availableBalanceSyp: true },
      });
      if (!wallet) {
        throw new ConflictException({ statusCode: 409, code: 'AMOUNT_OUT_OF_RANGE', message: 'The credited merchant balance would exceed the supported range.' });
      }
      const topup = await tx.merchantTopup.create({
        data: { merchantId: targetId, adminId, amountSyp, paymentMethod, referenceNote,
          merchantNewAvailableBalanceSyp: wallet.availableBalanceSyp },
      });
      await tx.moneyMovement.create({ data: { kind: 'merchant_topup', amountSyp, topupId: topup.id, walletId } });
      return { statusCode: HttpStatus.CREATED, body: { ...topupFields(topup, merchant.shopName),
        merchantNewAvailableBalanceSyp: toMoneyJsonInteger(wallet.availableBalanceSyp) } };
    });
  }

  list({ page, pageSize, merchantId }: AdminTopupQueryDto): Promise<AdminTopupPageDto> {
    const where: Prisma.MerchantTopupWhereInput = merchantId === undefined ? {} : { merchantId };
    return this.prisma.getClient().$transaction(async (tx) => {
      const total = await tx.merchantTopup.count({ where });
      const lastPage = Math.ceil(total / pageSize);
      const topups = page > lastPage ? [] : await tx.merchantTopup.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
        include: { merchant: { select: { shopName: true } } },
      });
      return {
        items: topups.map((topup) => ({ ...topupFields(topup, topup.merchant.shopName),
          merchantNewAvailableBalanceSyp: topup.merchantNewAvailableBalanceSyp === null
            ? null : toMoneyJsonInteger(topup.merchantNewAvailableBalanceSyp) })),
        page, pageSize, total, previousPage: page > 1 ? page - 1 : null, nextPage: page < lastPage ? page + 1 : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
