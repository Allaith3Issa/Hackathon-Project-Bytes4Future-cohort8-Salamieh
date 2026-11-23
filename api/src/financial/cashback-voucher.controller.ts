import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedActorGuard,
  CurrentActor,
  RequireRoles,
  RequiredRolesGuard,
} from '../common/auth-actor';
import { AuthenticatedActor } from '../common/auth-actor';
import { validateRequestKey } from '../common/request-key';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import {
  CashbackVoucherListQueryDto,
  CreateCashbackVoucherDto,
} from './cashback-voucher.dto';
import { CashbackVoucherService } from './cashback-voucher.service';

@ApiTags('customer')
@ApiBearerAuth()
@Controller('customer/cashback-vouchers')
@UseGuards(AuthenticatedActorGuard, RequiredRolesGuard)
@RequireRoles('customer')
export class CashbackVoucherController {
  constructor(private readonly vouchers: CashbackVoucherService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({ description: 'Cashback voucher reserved.' })
  issue(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') requestKey: string | undefined,
    @Body() input: CreateCashbackVoucherDto,
  ) {
    return this.vouchers.issue(
      actor,
      validateRequestKey(requestKey),
      input,
    );
  }

  @Get()
  @ApiOkResponse({ description: 'Paginated customer cashback vouchers.' })
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: CashbackVoucherListQueryDto,
  ) {
    return this.vouchers.list(actor, query);
  }

  @Post(':voucherId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Voucher cancelled or already cancelled.' })
  cancel(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('voucherId', UuidParamPipe) voucherId: string,
  ) {
    return this.vouchers.cancel(actor, voucherId);
  }
}
