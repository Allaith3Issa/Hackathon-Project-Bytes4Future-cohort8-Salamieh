import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client?: PrismaClient;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString) {
      const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 });
      this.client = new PrismaClient({ adapter });
    }
  }

  async onModuleInit() {
    try {
      await this.client?.$connect();
    } catch {
      throw new Error('Prisma could not initialize PostgreSQL. Check DATABASE_URL.');
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }

  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error('Database connection is not configured.');
    }
    return this.client;
  }

  async checkConnection() {
    if (!this.client) {
      throw new Error('Set DATABASE_URL before running the PostgreSQL check.');
    }

    const rows = await this.client.$queryRaw<{ result: number }[]>`SELECT 1 AS result`;
    if (rows[0]?.result !== 1) {
      throw new Error('PostgreSQL returned an unexpected result for SELECT 1.');
    }
  }
}
