import { ApiProperty } from '@nestjs/swagger';
import { MAX_MONEY_MINOR_UNITS } from '../common/money';
import { PageDto } from '../common/pagination.dto';
import { MerchantVerificationStatus } from '../generated/prisma/client';

const money = { type: 'integer', minimum: 0, maximum: Number(MAX_MONEY_MINOR_UNITS),
  description: 'Integer hundredths of one new Syrian Pound (SYP).' } as const;
const count = { type: 'integer', minimum: 0 } as const;
const nullableName = { type: String, nullable: true } as const;
const conversion = { type: Number, minimum: 0, description: 'Items sold divided by clicks, times 100, rounded to two decimals. Zero when there are no clicks.' } as const;

const merchantKinds = ['merchant_topup', 'campaign_reserve_lock', 'campaign_reserve_unlock',
  'sale_reserve_debit', 'cashback_voucher_merchant_credit'] as const;
const marketerKinds = ['marketer_commission_credit', 'payout_hold', 'payout_release_refund',
  'payout_completed', 'payout_transfer_reversal'] as const;

export class MerchantWalletDto {
  @ApiProperty(money) availableBalanceSyp!: number;
  @ApiProperty(money) totalLockedReservesSyp!: number;
  @ApiProperty(money) creditLimitSyp!: number;
}

export class MerchantWalletTransactionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: [...merchantKinds] }) kind!: typeof merchantKinds[number];
  @ApiProperty(money) amountSyp!: number;
  @ApiProperty({ ...nullableName, format: 'uuid' }) campaignId!: string | null;
  @ApiProperty(nullableName) campaignName!: string | null;
  @ApiProperty(nullableName) referenceNote!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class MerchantWalletTransactionPageDto extends PageDto {
  @ApiProperty({ type: [MerchantWalletTransactionDto] }) items!: MerchantWalletTransactionDto[];
}

class TopMerchantCampaignDto {
  @ApiProperty({ format: 'uuid' }) campaignId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty(money) grossCashSalesSyp!: number;
  @ApiProperty(count) salesCount!: number;
}

class MerchantStatsDto {
  @ApiProperty(count) clicks!: number;
  @ApiProperty(count) salesCount!: number;
  @ApiProperty(count) itemsSold!: number;
  @ApiProperty(money) grossCashSalesSyp!: number;
  @ApiProperty(money) commissionPaidSyp!: number;
  @ApiProperty(money) platformFeesPaidSyp!: number;
  @ApiProperty(conversion) conversionRatePercent!: number;
}

export class MerchantDashboardDto {
  @ApiProperty({ enum: MerchantVerificationStatus }) verificationStatus!: MerchantVerificationStatus;
  @ApiProperty({ type: MerchantWalletDto }) wallet!: MerchantWalletDto;
  @ApiProperty(count) activeCampaignsCount!: number;
  @ApiProperty({ type: TopMerchantCampaignDto, nullable: true }) topCampaign!: TopMerchantCampaignDto | null;
  @ApiProperty({ type: MerchantStatsDto }) stats!: MerchantStatsDto;
}

export class MarketerWalletDto {
  @ApiProperty(money) availableBalanceSyp!: number;
  @ApiProperty(money) pendingPayoutSyp!: number;
  @ApiProperty(money) totalEarnedSyp!: number;
  @ApiProperty({ ...money, description: 'Confirmed payouts in new SYP minor units. Zero while payouts are disabled in the three-day MVP.' })
  totalConfirmedPaidOutSyp!: number;
}

export class MarketerMerchantEarningsDto {
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty() shopName!: string;
  @ApiProperty(count) salesCount!: number;
  @ApiProperty(count) itemsSold!: number;
  @ApiProperty(money) totalEarnedSyp!: number;
}

export class MarketerMerchantEarningsPageDto extends PageDto {
  @ApiProperty({ type: [MarketerMerchantEarningsDto] }) items!: MarketerMerchantEarningsDto[];
}

export class MarketerWalletTransactionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: [...marketerKinds] }) kind!: typeof marketerKinds[number];
  @ApiProperty(money) amountSyp!: number;
  @ApiProperty({ ...nullableName, format: 'uuid' }) campaignId!: string | null;
  @ApiProperty(nullableName) campaignName!: string | null;
  @ApiProperty(nullableName) shopName!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class MarketerWalletTransactionPageDto extends PageDto {
  @ApiProperty({ type: [MarketerWalletTransactionDto] }) items!: MarketerWalletTransactionDto[];
}

export class MarketerStatsDto {
  @ApiProperty(count) clicks!: number;
  @ApiProperty(count) itemsSold!: number;
  @ApiProperty(money) earnedSyp!: number;
  @ApiProperty(conversion) conversionRatePercent!: number;
}

export class CustomerDashboardDto {
  @ApiProperty(count) verifiedPurchaseCount!: number;
  @ApiProperty(count) milestonePurchaseCount!: number;
  @ApiProperty(count) milestonePurchasesRequired!: number;
  @ApiProperty(money) milestoneSpendSyp!: number;
  @ApiProperty(money) milestoneSpendRequiredSyp!: number;
  @ApiProperty(money) lockedCashbackSyp!: number;
  @ApiProperty(money) availableCashbackSyp!: number;
  @ApiProperty(money) totalCashbackUnlockedSyp!: number;
}

export class CustomerPurchaseDto {
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty() shopName!: string;
  @ApiProperty() productName!: string;
  @ApiProperty(count) quantity!: number;
  @ApiProperty(money) customerPaidCashSyp!: number;
  @ApiProperty(money) cashbackEarnedSyp!: number;
  @ApiProperty({ format: 'date-time' }) scannedAt!: string;
}

export class CustomerPurchasePageDto extends PageDto {
  @ApiProperty({ type: [CustomerPurchaseDto] }) items!: CustomerPurchaseDto[];
}
