import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { FinancialModule } from './financial/financial.module';
import { CampaignModule } from './campaign/campaign.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CampaignModule,
    FinancialModule,
    HealthModule,
  ],
})
export class AppModule {}
