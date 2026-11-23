import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMerchantController } from './admin-merchant.controller';
import { AdminMerchantService } from './admin-merchant.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminMerchantController],
  providers: [AdminMerchantService],
})
export class AdminMerchantModule {}
