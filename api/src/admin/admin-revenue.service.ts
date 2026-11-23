import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { toMoneyJsonInteger } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminRevenueDto } from './dto/admin-revenue.dto';

@Injectable()
export class AdminRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenue(): Promise<AdminRevenueDto> {
    try {
      // PostgreSQL SUM(bigint) is numeric. Read it as text so it stays exact through the range check.
      const [total] = await this.prisma.getClient().$queryRaw<{ netFees: string }[]>`
        SELECT COALESCE(SUM(platform_net_fee_syp), 0)::text AS "netFees" FROM sales
      `;
      return { netPlatformFeesSyp: toMoneyJsonInteger(BigInt(total.netFees)) };
    } catch (error) {
      if (error instanceof RangeError) {
        throw new ConflictException({ statusCode: 409, code: 'AMOUNT_OUT_OF_RANGE', message: 'A reported amount exceeds the supported range.' });
      }
      throw new InternalServerErrorException({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Unable to load the requested report.' });
    }
  }
}
