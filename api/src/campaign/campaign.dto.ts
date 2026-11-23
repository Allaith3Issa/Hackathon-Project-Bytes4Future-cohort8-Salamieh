import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_MONEY_MINOR_UNITS } from '../common/money';
import { CampaignPreviewInputDto } from './campaign-preview.dto';

const statuses = ['active', 'ended'] as const;
const money = {
  type: 'integer', minimum: 0, maximum: Number(MAX_MONEY_MINOR_UNITS),
  description: 'Integer hundredths of one new Syrian Pound (SYP).',
} as const;
const count = { type: 'integer', minimum: 0 } as const;

export class LaunchCampaignDto extends CampaignPreviewInputDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  productName!: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ format: 'uri', maxLength: 2048 })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  imageUrl!: string;

  @ApiProperty({ format: 'date-time', description: 'Future ISO 8601 timestamp with a timezone.' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;

  @ApiProperty({ enum: ['open'] })
  @IsIn(['open'])
  joinMode!: 'open';
}

const parseQueryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;

export class CampaignPageQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, default: 1 })
  @Transform(parseQueryInteger)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @Transform(parseQueryInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class MerchantCampaignQueryDto extends CampaignPageQueryDto {
  @ApiPropertyOptional({ enum: statuses })
  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class CampaignFixedCommissionDto {
  @ApiProperty({ enum: ['fixed'] })
  type!: 'fixed';

  @ApiProperty(money)
  amountSyp!: number;
}

export class CampaignPercentageCommissionDto {
  @ApiProperty({ enum: ['percentage'] })
  type!: 'percentage';

  @ApiProperty({ minimum: 0, maximum: 100, multipleOf: 0.01 })
  percent!: number;
}

class CampaignUsageDto {
  @ApiProperty({ ...count, nullable: true })
  maxItems!: number | null;
  @ApiProperty(count)
  itemsSold!: number;
  @ApiProperty({ ...count, nullable: true })
  itemsLeft!: number | null;
  @ApiProperty({ ...money, nullable: true })
  maxSalesVolumeSyp!: number | null;
  @ApiProperty(money)
  salesVolumeSyp!: number;
  @ApiProperty({ ...money, nullable: true })
  salesVolumeLeftSyp!: number | null;
  @ApiProperty(money)
  worstCaseReserveSyp!: number;
  @ApiProperty(money)
  lockedBudgetSyp!: number;
  @ApiProperty(money)
  commissionsPaidSyp!: number;
  @ApiProperty(money)
  platformFeesPaidSyp!: number;
}

class MerchantCampaignStatsDto {
  @ApiProperty(count)
  clicks!: number;
  @ApiProperty(count)
  salesCount!: number;
  @ApiProperty(count)
  itemsSold!: number;
  @ApiProperty(money)
  grossCashSalesSyp!: number;
  @ApiProperty(money)
  commissionPaidSyp!: number;
  @ApiProperty(money)
  platformFeesPaidSyp!: number;
  @ApiProperty({ minimum: 0, multipleOf: 0.01 })
  conversionRatePercent!: number;
}

export class CampaignDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['product', 'store_discount'] })
  campaignType!: 'product' | 'store_discount';
  @ApiProperty()
  shopName!: string;
  @ApiProperty()
  productName!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty({ format: 'uri' })
  imageUrl!: string;
  @ApiProperty({ ...money, nullable: true })
  originalPriceSyp!: number | null;
  @ApiProperty({ minimum: 0, maximum: 100, multipleOf: 0.01 })
  discountPercent!: number;
  @ApiProperty({ ...money, nullable: true })
  finalPriceSyp!: number | null;
  @ApiProperty({ oneOf: [{ $ref: getSchemaPath(CampaignFixedCommissionDto) }, { $ref: getSchemaPath(CampaignPercentageCommissionDto) }] })
  commission!: CampaignFixedCommissionDto | CampaignPercentageCommissionDto;
  @ApiProperty({ ...money, nullable: true })
  commissionPerItemSyp!: number | null;
  @ApiProperty({ enum: ['open', 'approval_required'] })
  joinMode!: 'open' | 'approval_required';
  @ApiProperty({ enum: statuses })
  status!: (typeof statuses)[number];
  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class MerchantCampaignDto extends CampaignDto {
  @ApiProperty({ type: String, nullable: true })
  directReferralUrl!: string | null;
  @ApiProperty({ type: CampaignUsageDto })
  usage!: CampaignUsageDto;
  @ApiProperty({ type: MerchantCampaignStatsDto })
  stats!: MerchantCampaignStatsDto;
}

export class CampaignPageDto {
  @ApiProperty({ ...count, minimum: 1 })
  page!: number;
  @ApiProperty({ ...count, minimum: 1, maximum: 100 })
  pageSize!: number;
  @ApiProperty(count)
  total!: number;
  @ApiProperty({ ...count, minimum: 1, nullable: true })
  previousPage!: number | null;
  @ApiProperty({ ...count, minimum: 1, nullable: true })
  nextPage!: number | null;
}

export class MerchantCampaignPageDto extends CampaignPageDto {
  @ApiProperty({ type: [MerchantCampaignDto] })
  items!: MerchantCampaignDto[];
}
