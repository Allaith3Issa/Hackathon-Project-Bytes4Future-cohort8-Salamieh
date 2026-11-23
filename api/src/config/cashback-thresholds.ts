import type { ConfigService } from '@nestjs/config';
import { MAX_MONEY_MINOR_UNITS } from '../common/money';
import { MAX_POSTGRES_INT } from '../common/postgres-limits';

export function cashbackThresholds(config: ConfigService) {
  const purchases = config.get<string>('CASHBACK_MILESTONE_PURCHASES') ?? '5';
  const spend = config.get<string>('CASHBACK_MILESTONE_SPEND_SYP') ?? '50000';
  if (!/^[1-9][0-9]{0,9}$/.test(purchases) || !/^[1-9][0-9]{0,15}$/.test(spend)) throw new Error('Invalid cashback milestone configuration.');
  const minimumPurchases = Number(purchases);
  const minimumSpendSyp = BigInt(spend);
  if (minimumPurchases > MAX_POSTGRES_INT || minimumSpendSyp > MAX_MONEY_MINOR_UNITS) throw new Error('Invalid cashback milestone configuration.');
  return { minimumPurchases, minimumSpendSyp };
}
