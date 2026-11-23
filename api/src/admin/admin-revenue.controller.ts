import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthErrorDto } from '../common/http/auth-error.dto';
import { AdminRevenueService } from './admin-revenue.service';
import { AdminRevenueDto } from './dto/admin-revenue.dto';

@ApiTags('Admin revenue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/revenue')
export class AdminRevenueController {
  constructor(private readonly revenue: AdminRevenueService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get all-time net platform fees from settled sales' })
  @ApiOkResponse({ type: AdminRevenueDto, headers: { 'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } } } })
  @ApiResponse({ status: 401, type: AuthErrorDto, description: 'AUTH_REQUIRED or SESSION_EXPIRED' })
  @ApiResponse({ status: 403, type: AuthErrorDto, description: 'FORBIDDEN' })
  @ApiResponse({ status: 409, type: AuthErrorDto, description: 'AMOUNT_OUT_OF_RANGE' })
  @ApiResponse({ status: 500, type: AuthErrorDto, description: 'INTERNAL_ERROR' })
  getRevenue(): Promise<AdminRevenueDto> {
    return this.revenue.getRevenue();
  }
}
