import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedActorGuard,
  CurrentActor,
  RequireRoles,
  RequiredRolesGuard,
} from '../common/auth-actor';
import { AuthenticatedActor } from '../common/auth-actor';
import { PaginationQueryDto } from '../common/pagination.dto';
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

  @Get('merchant/wallet/transactions')
  @RequireRoles('merchant')
  @ApiOkResponse({ description: 'Paginated merchant wallet ledger.' })
  merchantTransactions(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: PaginationQueryDto,
  ) {
    return this.wallets.merchantTransactions(actor, query);
  }

  @Get('merchant/dashboard')
  @RequireRoles('merchant')
  @ApiOkResponse({ description: 'Merchant dashboard and performance totals.' })
  merchantDashboard(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.merchantDashboard(actor);
  }

  @Get('marketer/wallet')
  @RequireRoles('marketer')
  @ApiOkResponse({ description: 'Marketer wallet balances and earnings.' })
  marketerWallet(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.marketerWallet(actor);
  }

  @Get('marketer/wallet/by-merchant')
  @RequireRoles('marketer')
  @ApiOkResponse({ description: 'Paginated marketer earnings by merchant.' })
  marketerEarningsByMerchant(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: PaginationQueryDto,
  ) {
    return this.wallets.marketerEarningsByMerchant(actor, query);
  }

  @Get('marketer/wallet/transactions')
  @RequireRoles('marketer')
  @ApiOkResponse({ description: 'Paginated marketer wallet ledger.' })
  marketerTransactions(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: PaginationQueryDto,
  ) {
    return this.wallets.marketerTransactions(actor, query);
  }

  @Get('marketer/stats')
  @RequireRoles('marketer')
  @ApiOkResponse({ description: 'Marketer sales and conversion statistics.' })
  marketerStats(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.marketerStats(actor);
  }

  @Get('customer/dashboard')
  @RequireRoles('customer')
  @ApiOkResponse({ description: 'Customer cashback milestone progress.' })
  customerDashboard(@CurrentActor() actor: AuthenticatedActor) {
    return this.wallets.customerDashboard(actor);
  }

  @Get('customer/purchases')
  @RequireRoles('customer')
  @ApiOkResponse({ description: 'Paginated customer purchase history.' })
  customerPurchases(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: PaginationQueryDto,
  ) {
    return this.wallets.customerPurchases(actor, query);
  }

  @Get('admin/overview')
  @RequireRoles('admin')
  @ApiOkResponse({ description: 'Separated financial accounting overview.' })
  adminOverview() {
    return this.wallets.adminOverview();
  }
}
