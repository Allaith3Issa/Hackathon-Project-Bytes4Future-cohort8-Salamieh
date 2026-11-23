import { ApiProperty } from '@nestjs/swagger';
import { MAX_MONEY_MINOR_UNITS } from '../../common/money';

export class AdminRevenueDto {
  @ApiProperty({
    type: 'integer', minimum: 0, maximum: Number(MAX_MONEY_MINOR_UNITS),
    description: 'All-time net platform fees from settled sales in integer hundredths of one new Syrian Pound (SYP).',
  })
  netPlatformFeesSyp!: number;
}
