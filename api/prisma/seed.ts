import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

const demoPassword = 'Mardood@2026';
const accounts = [
  { name: 'Demo Admin', role: 'admin' },
  { name: 'Demo Merchant', role: 'merchant', shop: 'Mardood Demo Store', status: 'verified' },
  { name: 'Demo Marketer', role: 'marketer' },
  { name: 'Demo Customer', role: 'customer' },
  { name: 'Pending Merchant', role: 'merchant', shop: 'Pending Demo Store', status: 'pending' },
] as const;

class SeedError extends Error {}

async function seed() {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new SeedError('Evaluator seeding requires NODE_ENV=development or test.');
  }
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new SeedError('Set ALLOW_DEMO_SEED=true explicitly to seed evaluator accounts.');
  }
  const url = URL.parse(process.env.DATABASE_URL ?? '');
  if (!url || !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/affiliate_marketing_(?:demo|seed_test)(?:_[a-z0-9]+)*$/u.test(url.pathname) || url.search || url.hash) {
    throw new SeedError('DATABASE_URL must point to a dedicated loopback affiliate_marketing_demo or affiliate_marketing_seed_test database without URL options.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href, connectionTimeoutMillis: 5000 }) });
  try {
    const created = await prisma.$transaction(async (tx) => {
      const [identity] = await tx.$queryRaw<{ database: string; address: string }[]>`
        SELECT current_database() AS database, host(inet_server_addr()) AS address
      `;
      if (identity?.database !== url.pathname.slice(1) || !['127.0.0.1', '::1'].includes(identity.address)) {
        throw new SeedError('PostgreSQL did not confirm the dedicated loopback database identity.');
      }
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(7101, 4)`;
      let created = 0;
      for (const [index, account] of accounts.entries()) {
        const number = index + 1;
        const phone = `090000000${number}`;
        const id = `69bc0fc2-7b51-42af-804c-00000000000${number}`;
        const flags = { isAdmin: account.role === 'admin', isMarketer: account.role === 'marketer',
          isCustomer: account.role === 'customer' };
        const walletRole = account.role === 'merchant' || account.role === 'marketer' ? account.role : undefined;
        const existing = await tx.user.findMany({
          where: { OR: [{ id }, { phone }] },
          select: { id: true, phone: true, isAdmin: true, isMarketer: true, isCustomer: true,
            merchantProfile: { select: { userId: true } }, customerProfile: { select: { userId: true } },
            wallets: { select: { role: true } } },
        });
        if (existing.length) {
          const [user] = existing;
          if (existing.length !== 1 || user.id !== id || user.phone !== phone ||
              user.isAdmin !== flags.isAdmin || user.isMarketer !== flags.isMarketer || user.isCustomer !== flags.isCustomer ||
              Boolean(user.merchantProfile) !== (account.role === 'merchant') ||
              Boolean(user.customerProfile) !== flags.isCustomer ||
              user.wallets.length !== (walletRole ? 1 : 0) || (walletRole && user.wallets[0]?.role !== walletRole)) {
            throw new SeedError(`Unexpected evaluator account collision at ${phone}. No records were changed.`);
          }
          continue;
        }
        const data: Prisma.UserCreateInput = {
          id, phone, name: account.name, ...flags, passwordHash: await bcrypt.hash(demoPassword, 10),
          ...(walletRole && { wallets: { create: { role: walletRole } } }),
          ...(flags.isCustomer && { customerProfile: { create: {} } }),
          ...(account.role === 'merchant' && { merchantProfile: { create: {
            shopName: account.shop, shopDetails: 'Evaluator demo store', verificationStatus: account.status,
          } } }),
        };
        await tx.user.create({ data });
        created++;
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
    console.log(`Evaluator seed complete. Created ${created}; preserved ${accounts.length - created} existing fixture accounts.`);
  } finally {
    await prisma.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error(error instanceof SeedError ? error.message :
    'Evaluator seed failed. Check connectivity, applied migrations, and conflicting records.');
  process.exitCode = 1;
});
