import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';

export class CreateCashbackVoucherDto {
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountSyp!: number;
}

export class CashbackVoucherListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'redeemed', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'redeemed', 'cancelled'])
  status?: 'active' | 'redeemed' | 'cancelled';
}
