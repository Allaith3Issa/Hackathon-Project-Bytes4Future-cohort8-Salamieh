import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, InternalServerErrorException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_SECONDS, AccountDto, AuthSessionDto, Role } from './auth-session.dto';
import { LoginDto } from './login.dto';

const SESSION_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_HASH = /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const accountRelations = { merchantProfile: true, customerProfile: true } as const;
type AccountRecord = Prisma.UserGetPayload<{ include: typeof accountRelations }>;

function mapAccount(record: AccountRecord): AccountDto {
  const roles: Role[] = [];
  if (record.isAdmin) roles.push('admin');
  if (record.isCustomer) roles.push('customer');
  if (record.isMarketer) roles.push('marketer');
  if (record.merchantProfile) roles.push('merchant');

  const merchant = record.merchantProfile;
  const customer = record.customerProfile;
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    roles,
    createdAt: record.createdAt.toISOString(),
    merchant: merchant ? {
      name: merchant.shopName,
      details: merchant.shopDetails,
      verificationStatus: merchant.verificationStatus,
      contractReference: merchant.contractReference,
    } : null,
    customer: customer ? {
      verifiedPurchaseCount: customer.verifiedPurchaseCount,
      availableCashbackSyp: Number(customer.availableCashbackSyp),
      lockedCashbackSyp: Number(customer.lockedCashbackSyp),
    } : null,
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await bcrypt.hash(randomBytes(32), 10);
  }

  async login(input: LoginDto, adminLogin: boolean): Promise<AuthSessionDto> {
    try {
      const client = this.prisma.getClient();
      const account = await client.user.findUnique({
        where: { phone: input.phone },
        include: accountRelations,
      });
      const hash = account?.passwordHash;
      const supportedHash = hash && BCRYPT_HASH.test(hash) ? hash : undefined;
      const match = await bcrypt.compare(input.password, supportedHash ?? this.dummyHash);
      if (!account || !supportedHash || !match || account.isAdmin !== adminLogin) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid phone number or password.',
        });
      }

      const secret = this.config.get<string>('JWT_SECRET');
      if (!secret || Buffer.byteLength(secret.trim(), 'utf8') < 32) {
        throw new Error('JWT signing secret is missing or too short.');
      }

      const user = mapAccount(account);
      const sessionId = randomUUID();
      const refreshToken = randomBytes(32).toString('base64url');
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const now = new Date();
      const accessToken = await this.jwt.signAsync(
        { sub: account.id, sid: sessionId, roles: user.roles },
        { secret, algorithm: 'HS256', expiresIn: ACCESS_TOKEN_SECONDS },
      );
      await client.userSession.create({
        data: {
          id: sessionId,
          userId: account.id,
          refreshTokenHash,
          lastActivityAt: now,
          expiresAt: new Date(now.getTime() + SESSION_INACTIVITY_MS),
          createdAt: now,
        },
        select: { id: true },
      });
      return { accessToken, expiresInSeconds: ACCESS_TOKEN_SECONDS, refreshToken, user };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Unable to sign in.',
      });
    }
  }
}
