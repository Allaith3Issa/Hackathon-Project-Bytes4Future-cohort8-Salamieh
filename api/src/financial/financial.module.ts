import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import {
  AuthenticatedActorGuard,
  RequiredRolesGuard,
} from '../common/auth-actor';
import { IdempotencyService } from '../common/idempotency.service';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { TopupsController } from '../admin/topups/topups.controller';
import { TopupsService } from '../admin/topups/topups.service';
import { ScannerController } from '../merchant/scanner/scanner.controller';
import { ScannerService } from '../merchant/scanner/scanner.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [CampaignModule],
  controllers: [TopupsController, ScannerController, WalletController],
  providers: [
    AuthenticatedActorGuard,
    RequiredRolesGuard,
    UuidParamPipe,
    IdempotencyService,
    TopupsService,
    ScannerService,
    WalletService,
  ],
})
export class FinancialModule {}
