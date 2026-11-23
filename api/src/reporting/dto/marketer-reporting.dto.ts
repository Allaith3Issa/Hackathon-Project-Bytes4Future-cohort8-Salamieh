import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/pagination.dto';
import { conversion, count, money, nullableName } from './reporting-dto-options';

const marketerKinds = ['marketer_commission_credit', 'payout_hold', 'payout_release_refund',
  'payout_completed', 'payout_transfer_reversal'] as const;

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
