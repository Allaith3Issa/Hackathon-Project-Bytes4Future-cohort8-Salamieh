import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';

const BCRYPT_ROUNDS = 10;

const accounts = [
  { key: 1, name: 'Demo Admin', role: 'admin' },
  { key: 2, name: 'Live Merchant', role: 'merchant' },
  { key: 3, name: 'Live Marketer', role: 'marketer' },
  { key: 4, name: 'Live Customer', role: 'customer' },
  { key: 5, name: 'Scanner Merchant', role: 'merchant' },
  { key: 6, name: 'Scanner Marketer', role: 'marketer' },
  { key: 7, name: 'Scanner Customer', role: 'customer' },
] as const;

const fixtureId = (key: number) => `aff111a7-e000-4000-8000-${String(key).padStart(12, '0')}`;
const adminId = fixtureId(1);
const marker = { actorId: adminId, operation: 'demo.seed.v1', requestKey: fixtureId(90) };
const reserve = 435_000n;

class SeedError extends Error {}

function readConfig() {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new SeedError('Set NODE_ENV to development or test to run the demo seed.');
  }

  const url = URL.parse(process.env.DEMO_SEED_DATABASE_URL ?? '');
  const database = url?.pathname.slice(1) ?? '';
  if (
    !url ||
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^affiliate_marketing_(?:demo|seed_test)(?:_[a-z0-9]+)*$/.test(database) ||
    url.search ||
    url.hash
  ) {
    throw new SeedError('DEMO_SEED_DATABASE_URL must point to a dedicated loopback demo or seed-test database without URL options.');
  }
  const developmentDatabase = URL.parse(process.env.DATABASE_URL ?? '')?.pathname;
  if (developmentDatabase && decodeURIComponent(developmentDatabase) === url.pathname) {
    throw new SeedError('The demo seed database must differ from DATABASE_URL.');
  }

  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const accountPassword = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!adminPassword || !accountPassword || adminPassword.length < 12 || accountPassword.length < 12 || adminPassword === accountPassword) {
    throw new SeedError('Set distinct DEMO_ADMIN_PASSWORD and DEMO_ACCOUNT_PASSWORD values of at least 12 characters.');
  }
  if (Buffer.byteLength(adminPassword, 'utf8') > 72 || Buffer.byteLength(accountPassword, 'utf8') > 72) {
    throw new SeedError('Demo passwords must be at most 72 UTF-8 bytes for bcrypt.');
  }
  return { url, database, adminPassword, accountPassword };
}

async function seed() {
  const { url, database, adminPassword, accountPassword } = readConfig();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.href, connectionTimeoutMillis: 5000 }),
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [identity] = await tx.$queryRaw<{ database: string; address: string }[]>`
        SELECT current_database() AS database, host(inet_server_addr()) AS address
      `;
      if (identity?.database !== database || !['127.0.0.1', '::1'].includes(identity.address)) {
        throw new SeedError('PostgreSQL did not confirm the dedicated loopback database identity.');
      }

      // Serialize seed attempts before checking the committed marker.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(7101, 3)`;
      if (await tx.idempotencyRecord.findUnique({ where: { actorId_operation_requestKey: marker } })) {
        return 'already seeded';
      }

      for (const account of accounts) {
        const userId = fixtureId(account.key);
        const password = account.role === 'admin' ? adminPassword : accountPassword;
        await tx.user.create({
          data: {
            id: userId,
            phone: `099910000${account.key}`,
            name: account.name,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
            isAdmin: account.role === 'admin',
            isMarketer: account.role === 'marketer',
            isCustomer: account.role === 'customer',
          },
        });
        if (account.role === 'merchant') {
          await tx.merchantProfile.create({
            data: {
              userId,
              shopName: account.name,
              shopDetails: 'Simulated Salamiyah demo shop',
              verificationStatus: 'verified',
            },
          });
          await tx.wallet.create({
            data: { id: fixtureId(10 + account.key), userId, role: 'merchant', availableBalanceSyp: account.key === 2 ? 100_000n : 0n },
          });
        } else if (account.role === 'marketer') {
          await tx.wallet.create({ data: { id: fixtureId(10 + account.key), userId, role: 'marketer' } });
        } else if (account.role === 'customer') {
          await tx.customerProfile.create({ data: { userId } });
        }
      }

      for (const [key, amountSyp] of [[2, 100_000n], [5, reserve]] as const) {
        const topupId = fixtureId(20 + key);
        await tx.merchantTopup.create({
          data: { id: topupId, merchantId: fixtureId(key), adminId, amountSyp, paymentMethod: 'cash', referenceNote: 'Simulated demo opening credit' },
        });
        await tx.moneyMovement.create({
          data: { id: fixtureId(30 + key), topupId, walletId: fixtureId(10 + key), amountSyp, kind: 'merchant_topup' },
        });
      }

      const campaignId = fixtureId(40);
      const membershipId = fixtureId(41);
      await tx.campaign.create({
        data: {
          id: campaignId,
          merchantId: fixtureId(5),
          campaignType: 'product',
          productName: 'Maamoul box',
          description: 'One kilogram',
          imageUrl: 'https://demo.example.test/maamoul.jpg',
          originalPriceSyp: 100_000n,
          discountPercent: 10,
          commissionType: 'fixed',
          commissionValue: 10_000,
          joinMode: 'open',
          maxItems: 30,
          worstCaseReserveSyp: reserve,
          lockedBudgetSyp: reserve,
          status: 'active',
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.moneyMovement.create({
        data: { id: fixtureId(43), campaignId, walletId: fixtureId(15), amountSyp: reserve, kind: 'campaign_reserve_lock' },
      });
      await tx.campaignMarketer.create({
        data: { id: membershipId, campaignId, marketerId: fixtureId(6), status: 'approved', referralCode: 'mk-demo01' },
      });
      await tx.offerQrPass.create({
        data: {
          id: fixtureId(42),
          campaignId,
          campaignMarketerId: membershipId,
          customerId: fixtureId(7),
          passCode: 'OF-DEMO01',
          qrToken: randomBytes(32).toString('base64url'),
          status: 'active',
        },
      });
      await tx.idempotencyRecord.create({
        data: { ...marker, requestFingerprint: 'demo-seed-v1', responseStatus: 201, responseBody: {} },
      });
      return 'created';
    }, { timeout: 30_000 });
    console.log(`Demo fixtures ${result}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error(error instanceof SeedError
    ? error.message
    : 'Demo seed failed. Check the local migration status and fixture identifier conflicts.');
  process.exitCode = 1;
});
