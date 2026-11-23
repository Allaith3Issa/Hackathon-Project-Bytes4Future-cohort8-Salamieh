import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CampaignPreviewController } from './campaign-preview.controller';
import { CampaignPreviewService } from './campaign-preview.service';
import { CampaignService } from './campaign.service';

@Module({
  imports: [AuthModule, PrismaModule, IdempotencyModule],
  controllers: [CampaignPreviewController],
  providers: [CampaignPreviewService, CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
