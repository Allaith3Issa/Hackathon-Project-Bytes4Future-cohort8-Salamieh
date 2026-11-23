import { applyDecorators, Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentActor, type AuthenticatedActor } from '../auth/authenticated-actor';
import { AuthErrorDto, type Role } from '../auth/auth-session.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PageQueryDto } from '../common/pagination.dto';
import {
  CustomerDashboardDto, CustomerPurchasePageDto, MarketerMerchantEarningsPageDto, MarketerStatsDto,
  MarketerWalletDto, MarketerWalletTransactionPageDto, MerchantDashboardDto, MerchantWalletDto,
  MerchantWalletTransactionPageDto,
} from './reporting.dto';
import { ReportingService } from './reporting.service';

const ReportingAccess = (role: Role) => applyDecorators(
  UseGuards(JwtAuthGuard, RolesGuard),
  Roles(role),
  ApiBearerAuth(),
  ApiResponse({ status: 401, type: AuthErrorDto, description: 'AUTH_REQUIRED or SESSION_EXPIRED' }),
  ApiResponse({ status: 403, type: AuthErrorDto, description: 'FORBIDDEN' }),
  ApiResponse({ status: 409, type: AuthErrorDto, description: 'AMOUNT_OUT_OF_RANGE' }),
  ApiResponse({ status: 500, type: AuthErrorDto, description: 'INTERNAL_ERROR' }),
);

const PageValidation = () => ApiResponse({ status: 400, type: AuthErrorDto, description: 'VALIDATION_ERROR' });

@ApiTags('Merchant reporting')
@ReportingAccess('merchant')
@Controller('merchant')
export class MerchantReportingController {
  constructor(private readonly reports: ReportingService) {}

  @Get('wallet')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MerchantWalletDto })
  wallet(@CurrentActor() actor: AuthenticatedActor) {
    return this.reports.merchantWallet(actor.userId);
  }

  @Get('wallet/transactions')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MerchantWalletTransactionPageDto })
  @PageValidation()
  transactions(@CurrentActor() actor: AuthenticatedActor, @Query() page: PageQueryDto) {
    return this.reports.merchantTransactions(actor.userId, page);
  }

  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MerchantDashboardDto })
  dashboard(@CurrentActor() actor: AuthenticatedActor) {
    return this.reports.merchantDashboard(actor.userId);
  }
}

@ApiTags('Marketer reporting')
@ReportingAccess('marketer')
@Controller('marketer')
export class MarketerReportingController {
  constructor(private readonly reports: ReportingService) {}

  @Get('wallet')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MarketerWalletDto })
  wallet(@CurrentActor() actor: AuthenticatedActor) {
    return this.reports.marketerWallet(actor.userId);
  }

  @Get('wallet/by-merchant')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MarketerMerchantEarningsPageDto })
  @PageValidation()
  byMerchant(@CurrentActor() actor: AuthenticatedActor, @Query() page: PageQueryDto) {
    return this.reports.marketerEarnings(actor.userId, page);
  }

  @Get('wallet/transactions')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MarketerWalletTransactionPageDto })
  @PageValidation()
  transactions(@CurrentActor() actor: AuthenticatedActor, @Query() page: PageQueryDto) {
    return this.reports.marketerTransactions(actor.userId, page);
  }

  @Get('stats')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MarketerStatsDto })
  stats(@CurrentActor() actor: AuthenticatedActor) {
    return this.reports.marketerStats(actor.userId);
  }
}

@ApiTags('Customer reporting')
@ReportingAccess('customer')
@Controller('customer')
export class CustomerReportingController {
  constructor(private readonly reports: ReportingService) {}

  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CustomerDashboardDto })
  dashboard(@CurrentActor() actor: AuthenticatedActor) {
    return this.reports.customerDashboard(actor.userId);
  }

  @Get('purchases')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CustomerPurchasePageDto })
  @PageValidation()
  purchases(@CurrentActor() actor: AuthenticatedActor, @Query() page: PageQueryDto) {
    return this.reports.customerPurchases(actor.userId, page);
  }
}
