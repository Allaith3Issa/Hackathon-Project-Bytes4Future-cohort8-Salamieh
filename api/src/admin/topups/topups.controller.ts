import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedActorGuard,
  CurrentActor,
  RequireRoles,
  RequiredRolesGuard,
} from '../../common/auth-actor';
import { AuthenticatedActor } from '../../common/auth-actor';
import { TopupsService } from './topups.service';
import { AdminTopupResponseDto, CreateTopupDto } from './topups.dto';
import { validateRequestKey } from '../../common/request-key';
import { UuidParamPipe } from '../../common/uuid-param.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/merchants/:merchantId/topups')
@UseGuards(AuthenticatedActorGuard, RequiredRolesGuard)
@RequireRoles('admin')
export class TopupsController {
  constructor(private readonly topups: TopupsService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({
    type: AdminTopupResponseDto,
    description: 'Merchant top-up and ledger movement recorded.',
  })
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('merchantId', UuidParamPipe) merchantId: string,
    @Headers('idempotency-key') requestKey: string | undefined,
    @Body() input: CreateTopupDto,
  ) {
    return this.topups.create(
      actor,
      merchantId,
      validateRequestKey(requestKey),
      input,
    );
  }
}
