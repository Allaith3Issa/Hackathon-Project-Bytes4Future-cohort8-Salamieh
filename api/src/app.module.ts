import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { validateDatabaseConfig } from './prisma/database-config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateDatabaseConfig }),
    HealthModule,
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
