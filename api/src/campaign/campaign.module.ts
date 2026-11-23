import { Module } from '@nestjs/common';
import { CampaignClosureService } from './campaign-closure.service';

@Module({
  providers: [CampaignClosureService],
  exports: [CampaignClosureService],
})
export class CampaignModule {}
