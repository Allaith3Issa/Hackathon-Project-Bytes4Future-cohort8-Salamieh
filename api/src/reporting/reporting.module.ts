import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerReportingController, MarketerReportingController, MerchantReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MerchantReportingController, MarketerReportingController, CustomerReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
