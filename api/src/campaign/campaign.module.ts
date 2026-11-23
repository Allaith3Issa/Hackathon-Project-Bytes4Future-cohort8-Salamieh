import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CampaignPreviewController } from './campaign-preview.controller';
import { CampaignPreviewService } from './campaign-preview.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CampaignPreviewController],
  providers: [CampaignPreviewService],
})
export class CampaignModule {}
