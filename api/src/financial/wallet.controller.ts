import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedActorGuard,
  CurrentActor,
  RequireRoles,
  RequiredRolesGuard,
} from '../common/auth-actor';
import { AuthenticatedActor } from '../common/auth-actor';
import { WalletService } from './wallet.service';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthenticatedActorGuard, RequiredRolesGuard)
export class WalletController {
  constructor(private readonly wallets: WalletService) {}

  @Get('merchant/wallet')
  @RequireRoles('merchant')
  @ApiOkResponse({ description: 'Merchant available and locked balances.' })
  merchantWallet(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.merchantWallet(actor);
  }

  @Get('marketer/wallet')
  @RequireRoles('marketer')
  @ApiOkResponse({ description: 'Marketer wallet balances and earnings.' })
  marketerWallet(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.marketerWallet(actor);
  }

  @Get('customer/dashboard')
  @RequireRoles('customer')
  @ApiOkResponse({ description: 'Customer cashback milestone progress.' })
  customerDashboard(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.customerDashboard(actor);
  }
}
