import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { validateDatabaseConfig } from './prisma/database-config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateDatabaseConfig }),
    HealthModule,
    PrismaModule,
  ],
})
export class AppModule {}
