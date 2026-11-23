import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';

export const PAYOUT_METHODS = ['sham_cash', 'syriatel_cash', 'cash'] as const;
export const PAYOUT_STATUSES = [
  'pending_review',
  'transferred',
  'confirmed',
  'disputed',
  'rejected',
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export class CreatePayoutDto {
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountSyp!: number;

  @ApiProperty({ enum: PAYOUT_METHODS })
  @IsIn(PAYOUT_METHODS)
  method!: PayoutMethod;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  accountDetails!: string;
}

export class PayoutListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PAYOUT_STATUSES })
  @IsOptional()
  @IsIn(PAYOUT_STATUSES)
  status?: PayoutStatus;
}

export class MarkPayoutTransferredDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  transferReference!: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  transferReceiptUrl!: string;
}

export class RejectPayoutDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class DisputePayoutDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class ResolvePayoutDisputeDto {
  @ApiProperty({ enum: ['confirm_paid', 'return_funds'] })
  @IsIn(['confirm_paid', 'return_funds'])
  outcome!: 'confirm_paid' | 'return_funds';

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @ValidateIf((input: ResolvePayoutDisputeDto) => input.outcome === 'return_funds')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reversalReference?: string;
}
