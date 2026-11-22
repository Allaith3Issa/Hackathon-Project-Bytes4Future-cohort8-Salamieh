import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
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
} from '../../common/auth-actor';
import { AuthenticatedActor } from '../../common/auth-actor';
import { validateRequestKey } from '../../common/request-key';
import {
  OfferRedeemResponseDto,
  RedeemOfferDto,
  ScannerLookupDto,
  ScannerOfferLookupResponseDto,
} from './scanner.dto';
import { ScannerService } from './scanner.service';

@ApiTags('merchant')
@ApiBearerAuth()
@Controller('merchant/scanner')
@UseGuards(AuthenticatedActorGuard, RequiredRolesGuard)
@RequireRoles('merchant')
export class ScannerController {
  constructor(private readonly scanner: ScannerService) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: ScannerOfferLookupResponseDto,
    description: 'Read-only Offer QR preview.',
  })
  lookup(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() input: ScannerLookupDto,
  ) {
    return this.scanner.lookup(actor, input);
  }

  @Post('redeem-offer')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({
    type: OfferRedeemResponseDto,
    description: 'Offer sale atomically settled.',
  })
  redeemOffer(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') requestKey: string | undefined,
    @Body() input: RedeemOfferDto,
  ) {
    return this.scanner.redeemOffer(
      actor,
      validateRequestKey(requestKey),
      input,
    );
  }
}
