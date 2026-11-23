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
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
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
  PreviewOfferDto,
  RedeemOfferDto,
  RedeemVoucherDto,
  ScannerLookupDto,
  ScannerOfferLookupResponseDto,
  ScannerVoucherLookupResponseDto,
  StoreDiscountPreviewResponseDto,
  VoucherRedeemResponseDto,
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
  @ApiExtraModels(
    ScannerOfferLookupResponseDto,
    ScannerVoucherLookupResponseDto,
  )
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ScannerOfferLookupResponseDto) },
        { $ref: getSchemaPath(ScannerVoucherLookupResponseDto) },
      ],
    },
    description: 'Read-only Offer QR or cashback voucher preview.',
  })
  lookup(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() input: ScannerLookupDto,
  ) {
    return this.scanner.lookup(actor, input);
  }

  @Post('preview-offer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StoreDiscountPreviewResponseDto })
  previewOffer(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() input: PreviewOfferDto,
  ) {
    return this.scanner.previewStoreDiscount(actor, input);
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

  @Post('redeem-voucher')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ type: VoucherRedeemResponseDto })
  redeemVoucher(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') requestKey: string | undefined,
    @Body() input: RedeemVoucherDto,
  ) {
    return this.scanner.redeemVoucher(
      actor,
      validateRequestKey(requestKey),
      input,
    );
  }
}
