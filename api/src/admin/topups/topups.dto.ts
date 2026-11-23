import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum TopupPaymentMethod {
  CASH = 'cash',
  SHAM_CASH = 'sham_cash',
  SYRIATEL_CASH = 'syriatel_cash',
  BANK_TRANSFER = 'bank_transfer',
}

export class CreateTopupDto {
  @ApiProperty({ minimum: 1, maximum: 9_007_199_254_740_991 })
  @IsInt()
  @Min(1)
  @Max(9_007_199_254_740_991)
  amountSyp!: number;

  @ApiProperty({ enum: TopupPaymentMethod })
  @IsEnum(TopupPaymentMethod)
  paymentMethod!: TopupPaymentMethod;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  referenceNote!: string;
}

export class AdminTopupResponseDto {
  @ApiProperty({ format: 'uuid' })
  topupId!: string;

  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty()
  shopName!: string;

  @ApiProperty({ minimum: 1, maximum: 9_007_199_254_740_991 })
  amountSyp!: number;

  @ApiProperty({ enum: TopupPaymentMethod })
  paymentMethod!: TopupPaymentMethod;

  @ApiProperty()
  referenceNote!: string;

  @ApiProperty({ minimum: 0, maximum: 9_007_199_254_740_991 })
  merchantNewAvailableBalanceSyp!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
