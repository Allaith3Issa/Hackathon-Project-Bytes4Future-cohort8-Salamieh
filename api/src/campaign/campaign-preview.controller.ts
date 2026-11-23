import { Body, Controller, Header, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentActor, type AuthenticatedActor } from '../auth/authenticated-actor';
import { AuthErrorDto } from '../auth/auth-session.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CampaignPreviewDto, CampaignPreviewInputDto } from './campaign-preview.dto';
import { CampaignPreviewService } from './campaign-preview.service';

@ApiTags('Merchant campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('merchant')
@Controller('merchant/campaigns')
export class CampaignPreviewController {
  constructor(private readonly campaigns: CampaignPreviewService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Preview a product campaign', description: 'Read-only. Insufficient funds return 200 with isAffordableByMerchant set to false.' })
  @ApiBody({ type: CampaignPreviewInputDto })
  @ApiOkResponse({ type: CampaignPreviewDto })
  @ApiResponse({ status: 400, type: AuthErrorDto, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 401, type: AuthErrorDto, description: 'AUTH_REQUIRED or SESSION_EXPIRED' })
  @ApiResponse({ status: 403, type: AuthErrorDto, description: 'FORBIDDEN' })
  @ApiResponse({ status: 409, type: AuthErrorDto, description: 'AMOUNT_OUT_OF_RANGE' })
  @ApiResponse({ status: 500, type: AuthErrorDto, description: 'INTERNAL_ERROR' })
  preview(@CurrentActor() actor: AuthenticatedActor, @Body() input: CampaignPreviewInputDto) {
    return this.campaigns.preview(actor.userId, input);
  }
}
