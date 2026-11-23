import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminMerchantModule } from './admin/admin-merchant.module';
import { AuthModule } from './auth/auth.module';
import { CampaignModule } from './campaign/campaign.module';
import { HealthModule } from './health/health.module';
import { validateDatabaseConfig } from './prisma/database-config';
import { PrismaModule } from './prisma/prisma.module';
import { ReferralModule } from './referral/referral.module';
import { ScannerModule } from './scanner/scanner.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateDatabaseConfig }),
    HealthModule,
    PrismaModule,
    AuthModule,
    CampaignModule,
    ReferralModule,
    ScannerModule,
    AdminMerchantModule,
  ],
})
export class AppModule {}
