import { Body, Controller, Header, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthErrorDto, AuthSessionDto } from './auth-session.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { LogoutDto, RefreshDto } from './session-token.dto';

@ApiTags('Authentication')
@ApiResponse({ status: 400, type: AuthErrorDto, description: 'VALIDATION_ERROR' })
@ApiResponse({ status: 429, type: AuthErrorDto, description: 'RATE_LIMITED' })
@ApiResponse({ status: 500, type: AuthErrorDto, description: 'INTERNAL_ERROR' })
@UseGuards(LoginThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sign in to a public account' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiResponse({ status: 401, type: AuthErrorDto, description: 'INVALID_CREDENTIALS' })
  login(@Body() input: LoginDto) {
    return this.auth.login(input, false);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sign in to an administrator account' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiResponse({ status: 401, type: AuthErrorDto, description: 'INVALID_CREDENTIALS' })
  adminLogin(@Body() input: LoginDto) {
    return this.auth.login(input, true);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Rotate an active session’s refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiResponse({ status: 401, type: AuthErrorDto, description: 'REFRESH_TOKEN_INVALID or SESSION_EXPIRED' })
  refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Revoke the session identified by the access token' })
  @ApiBearerAuth()
  @ApiBody({ type: LogoutDto, required: false })
  @ApiNoContentResponse({ description: 'Session revoked or already signed out.' })
  @ApiResponse({ status: 401, type: AuthErrorDto, description: 'AUTH_REQUIRED, REFRESH_TOKEN_INVALID or SESSION_EXPIRED' })
  logout(@Headers('authorization') authorization: string | undefined, @Body() input: LogoutDto) {
    return this.auth.logout(authorization, input?.refreshToken);
  }
}
