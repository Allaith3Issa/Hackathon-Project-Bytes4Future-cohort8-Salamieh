import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottlerGuard } from './login-throttler.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [AuthController],
  providers: [AuthService, LoginThrottlerGuard],
})
export class AuthModule {}
