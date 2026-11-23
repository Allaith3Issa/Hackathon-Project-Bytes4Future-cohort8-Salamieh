import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ScannerLookupDto {
  @ApiProperty({ minLength: 3, maxLength: 256 })
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  code!: string;
}

export class RedeemOfferDto extends ScannerLookupDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1)
  quantity?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsInt()
  originalBillSyp?: number;
}

export class ScannerOfferLookupResponseDto {
  @ApiProperty({ enum: ['offer_qr'] })
  kind!: 'offer_qr';

  @ApiProperty({ format: 'uuid' })
  passId!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ enum: ['product'] })
  campaignType!: 'product';

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  discountPercent!: number;

  @ApiProperty({ minimum: 0 })
  finalPriceSyp!: number;

  @ApiProperty({ nullable: true })
  maxQuantity!: number | null;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        quantity: { type: 'integer', example: 1 },
        customerPaidCashSyp: { type: 'integer', example: 90000 },
      },
    },
  })
  availableQuantityOptions!: { quantity: number; customerPaidCashSyp: number }[];

  @ApiProperty({ enum: ['active'] })
  status!: 'active';
}

export class OfferRedeemResponseDto {
  @ApiProperty({ format: 'uuid' })
  saleId!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ minimum: 1, maximum: 1 })
  quantity!: number;

  @ApiProperty({ minimum: 0 })
  originalAmountSyp!: number;

  @ApiProperty({ minimum: 0 })
  customerPaidCashSyp!: number;

  @ApiProperty({ minimum: 0 })
  marketerCommissionSyp!: number;

  @ApiProperty({ minimum: 0 })
  platformTotalFeeSyp!: number;

  @ApiProperty({ minimum: 0 })
  customerCashbackSyp!: number;

  @ApiProperty({ minimum: 0 })
  platformNetFeeSyp!: number;

  @ApiProperty({ minimum: 0 })
  remainingLockedBudgetSyp!: number;

  @ApiProperty({ enum: ['active', 'ended'] })
  campaignStatusAfterSale!: 'active' | 'ended';

  @ApiProperty({ format: 'date-time' })
  scannedAt!: string;
}
