import { Body, Controller, Header, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthErrorDto, AuthSessionDto } from './auth-session.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { LoginThrottlerGuard } from './login-throttler.guard';

@ApiTags('Authentication')
@ApiResponse({ status: 400, type: AuthErrorDto, description: 'VALIDATION_ERROR' })
@ApiResponse({ status: 401, type: AuthErrorDto, description: 'INVALID_CREDENTIALS' })
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
  login(@Body() input: LoginDto) {
    return this.auth.login(input, false);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sign in to an administrator account' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  adminLogin(@Body() input: LoginDto) {
    return this.auth.login(input, true);
  }
}
