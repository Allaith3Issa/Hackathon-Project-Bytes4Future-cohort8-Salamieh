import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AuthenticatedActorGuard,
  CurrentActor,
  RequireRoles,
  RequiredRolesGuard,
} from '../common/auth-actor';
import { AuthenticatedActor } from '../common/auth-actor';
import { apiError } from '../common/api-error';
import { PayoutListQueryDto } from './payout.dto';
import {
  CreatePayoutDto,
  DisputePayoutDto,
  MarkPayoutTransferredDto,
  RejectPayoutDto,
  ResolvePayoutDisputeDto,
} from './payout.dto';
import { PayoutService } from './payout.service';
import { validateRequestKey } from '../common/request-key';
import { UuidParamPipe } from '../common/uuid-param.pipe';

type UploadedReceiptFile = {
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const receiptInterceptor = FileInterceptor('receipt', {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(
        apiError(
          HttpStatus.BAD_REQUEST,
          'VALIDATION_ERROR',
          'Receipt must be a JPEG, PNG, or WebP image.',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
});

@ApiTags('payouts')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthenticatedActorGuard, RequiredRolesGuard)
export class PayoutController {
  constructor(private readonly payouts: PayoutService) {}

  @Post('marketer/payouts')
  @RequireRoles('marketer')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({ description: 'Payout requested and balance reserved.' })
  request(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') requestKey: string | undefined,
    @Body() input: CreatePayoutDto,
  ) {
    return this.payouts.request(
      actor,
      validateRequestKey(requestKey),
      input,
    );
  }

  @Get('marketer/payouts')
  @RequireRoles('marketer')
  @ApiOkResponse({ description: 'Paginated marketer payout history.' })
  listMarketer(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: PayoutListQueryDto,
  ) {
    return this.payouts.listMarketer(actor, query);
  }

  @Post('marketer/payouts/:payoutId/confirm')
  @RequireRoles('marketer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Payout receipt confirmed.' })
  confirm(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('payoutId', UuidParamPipe) payoutId: string,
  ) {
    return this.payouts.confirm(actor, payoutId);
  }

  @Post('marketer/payouts/:payoutId/dispute')
  @RequireRoles('marketer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Payout dispute recorded.' })
  dispute(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('payoutId', UuidParamPipe) payoutId: string,
    @Body() input: DisputePayoutDto,
  ) {
    return this.payouts.dispute(actor, payoutId, input);
  }

  @Get('marketer/payouts/:payoutId/receipt')
  @RequireRoles('admin', 'marketer')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  receipt(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('payoutId', UuidParamPipe) payoutId: string,
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.payouts.getReceipt(actor, payoutId).then(
      (receipt) =>
        new StreamableFile(receipt.data, {
          type: receipt.contentType,
          disposition: 'inline',
        }),
    );
  }

  @Get('admin/payouts')
  @RequireRoles('admin')
  @ApiOkResponse({ description: 'Paginated payout queue for administration.' })
  listAdmin(@Query() query: PayoutListQueryDto) {
    return this.payouts.listAdmin(query);
  }

  @Post('admin/payouts/:payoutId/upload-receipt')
  @RequireRoles('admin')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(receiptInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['receipt'],
      properties: { receipt: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'Private receipt URL recorded.' })
  uploadReceipt(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('payoutId', UuidParamPipe) payoutId: string,
    @UploadedFile() file: UploadedReceiptFile | undefined,
  ) {
    return this.payouts.uploadReceipt(payoutId, actor.id, file);
  }

  @Patch('admin/payouts/:payoutId/mark-transferred')
  @RequireRoles('admin')
  @ApiOkResponse({ description: 'Payout transfer recorded.' })
  markTransferred(
    @Param('payoutId', UuidParamPipe) payoutId: string,
    @Body() input: MarkPayoutTransferredDto,
  ) {
    return this.payouts.markTransferred(payoutId, input);
  }

  @Patch('admin/payouts/:payoutId/reject')
  @RequireRoles('admin')
  @ApiOkResponse({ description: 'Pending payout rejected and hold released.' })
  reject(
    @Param('payoutId', UuidParamPipe) payoutId: string,
    @Body() input: RejectPayoutDto,
  ) {
    return this.payouts.reject(payoutId, input);
  }

  @Patch('admin/payouts/:payoutId/resolve-dispute')
  @RequireRoles('admin')
  @ApiOkResponse({ description: 'Payout dispute resolved.' })
  resolveDispute(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('payoutId', UuidParamPipe) payoutId: string,
    @Body() input: ResolvePayoutDisputeDto,
  ) {
    return this.payouts.resolveDispute(payoutId, actor.id, input);
  }
}
