import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OptionalCurrentActor } from '../common/auth-actor';
import { AuthenticatedActor } from '../common/auth-actor';
import { PaginationQueryDto } from '../common/pagination.dto';
import { WalletService } from './wallet.service';

@ApiTags('public')
@Controller('public/leaderboard')
export class LeaderboardController {
  constructor(private readonly wallets: WalletService) {}

  @Get()
  @ApiOperation({ security: [{ bearer: [] }, {}] })
  @ApiOkResponse({ description: 'Public marketer leaderboard with optional viewer rank.' })
  leaderboard(
    @Query() query: PaginationQueryDto,
    @OptionalCurrentActor() actor?: AuthenticatedActor,
  ) {
    return this.wallets.leaderboard(query, actor?.id);
  }
}
