import { ApiClientError } from '../api/errors';
import type { PaginatedResponse } from '../api/types';
import { tokenStorage } from '../auth/tokenStorage';
import type { Account, AuthSession } from '../auth/types';
import { env } from '../config';
import { DEV_SANDBOX_CREDENTIALS } from './credentials';

/**
 * Strictly isolated Dev Sandbox for pre-backend UI development ONLY.
 * Active ONLY when __DEV__ is true AND EXPO_PUBLIC_USE_DEV_SANDBOX === 'true'.
 * Never active when pointed at the hosted backend (EXPO_PUBLIC_USE_DEV_SANDBOX=false).
 */

interface SandboxCampaign {
  id: string;
  campaignType: 'product' | 'store_discount';
  shopName: string;
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  discountPercent: number;
  finalPriceSyp: number | null;
  commission: { type: 'fixed'; amountSyp: number } | { type: 'percentage'; percent: number };
  commissionPerItemSyp: number | null;
  joinMode: 'open' | 'approval_required';
  status: 'active' | 'ended';
  endsAt: string;
}

interface SandboxMembership {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  campaign: SandboxCampaign;
  referralUrl: string | null;
  stats: {
    clicks: number;
    itemsSold: number;
    earnedSyp: number;
    conversionRatePercent: number;
  };
}

type SandboxAccountKey =
  | 'marketer'
  | 'merchant'
  | 'dual'
  | 'customer'
  | 'scannerCustomer'
  | 'multiRole'
  | 'admin';

// All sandbox monetary literals use minor units (100 = 1.00 new SYP) matching API_CONTRACT.md & DEMO_SEED.md.
const DEMO_MARKETER_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000003',
  name: 'إسماعيل محفوظ (مسوّق تجريبي)',
  phone: '0999100003',
  roles: ['marketer'],
  createdAt: '2026-11-20T09:00:00Z',
  merchant: null,
  customer: null,
};

const DEMO_MERCHANT_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000002',
  name: 'أبو طلال الحلواني (تاجر تجريبي)',
  phone: '0999100002',
  roles: ['merchant'],
  createdAt: '2026-11-20T08:00:00Z',
  merchant: {
    name: 'مخبز وحلويات السلمية',
    details: 'شارع حماة الرئيسي، مقابل الحديقة العامة - السلمية',
    verificationStatus: 'verified',
    contractReference: 'CNT-DEMO-002',
  },
  customer: null,
};

const DEMO_DUAL_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000009',
  name: 'حساب مزدوج (مسوّق + متجر)',
  phone: '0999100009',
  roles: ['marketer', 'merchant'],
  createdAt: '2026-11-20T08:30:00Z',
  merchant: {
    name: 'محامص السلمية (تجريبي)',
    details: 'سوق الهال القديم، السلمية',
    verificationStatus: 'verified',
    contractReference: 'CNT-DEMO-009',
  },
  customer: null,
};

const DEMO_CUSTOMER_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000004',
  name: 'سارة الأحمد (زبون تجريبي)',
  phone: '0999100004',
  roles: ['customer'],
  createdAt: '2026-11-20T08:30:00Z',
  merchant: null,
  customer: {
    verifiedPurchaseCount: 2,
    availableCashbackSyp: 5000,
    lockedCashbackSyp: 3000,
  },
};

const DEMO_SCANNER_CUSTOMER_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000007',
  name: 'ليلى حسن (زبون السكانر)',
  phone: '0999100007',
  roles: ['customer'],
  createdAt: '2026-11-20T08:45:00Z',
  merchant: null,
  customer: {
    verifiedPurchaseCount: 0,
    availableCashbackSyp: 0,
    lockedCashbackSyp: 0,
  },
};

const DEMO_MULTI_ROLE_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000010',
  name: 'نور الهدى (زبون + مسوّق)',
  phone: '0999100010',
  roles: ['customer', 'marketer'],
  createdAt: '2026-11-20T08:50:00Z',
  merchant: null,
  customer: {
    verifiedPurchaseCount: 0,
    availableCashbackSyp: 0,
    lockedCashbackSyp: 0,
  },
};

const DEMO_ADMIN_ONLY_ACCOUNT: Account = {
  id: 'aff111a7-e000-4000-8000-000000000001',
  name: 'مدير المنصة (ويب فقط)',
  phone: '0999100001',
  roles: ['admin'],
  createdAt: '2026-11-20T07:00:00Z',
  merchant: null,
  customer: null,
};

const SEEDED_ACCOUNTS_BY_KEY: Record<SandboxAccountKey, Account> = {
  marketer: DEMO_MARKETER_ACCOUNT,
  merchant: DEMO_MERCHANT_ACCOUNT,
  dual: DEMO_DUAL_ACCOUNT,
  customer: DEMO_CUSTOMER_ACCOUNT,
  scannerCustomer: DEMO_SCANNER_CUSTOMER_ACCOUNT,
  multiRole: DEMO_MULTI_ROLE_ACCOUNT,
  admin: DEMO_ADMIN_ONLY_ACCOUNT,
};

const registeredSandboxAccounts = new Map<string, Account>();
const sandboxPasswordsByPhone = new Map<string, string>([
  [DEV_SANDBOX_CREDENTIALS.marketer.phone, DEV_SANDBOX_CREDENTIALS.marketer.password],
  [DEV_SANDBOX_CREDENTIALS.customer.phone, DEV_SANDBOX_CREDENTIALS.customer.password],
  [DEV_SANDBOX_CREDENTIALS.merchant.phone, DEV_SANDBOX_CREDENTIALS.merchant.password],
  [DEMO_DUAL_ACCOUNT.phone, 'dev-sandbox-dual'],
  [DEMO_SCANNER_CUSTOMER_ACCOUNT.phone, 'dev-sandbox-scanner-customer'],
  [DEMO_MULTI_ROLE_ACCOUNT.phone, 'dev-sandbox-multi'],
  [DEMO_ADMIN_ONLY_ACCOUNT.phone, 'dev-sandbox-admin'],
]);

const SEEDED_CAMPAIGNS: SandboxCampaign[] = [
  {
    id: 'aff111a7-e000-4000-8000-000000000040',
    campaignType: 'product',
    shopName: 'مخبز وحلويات السلمية',
    productName: 'علبة معمول مشكل ١ كغ',
    description: 'معمول فاخر بالسمن العربي محشو بالفستق والجوز، العرض ساري بالمتجر عبر رمز QR.',
    imageUrl: '',
    originalPriceSyp: 100000, // 1,000.00 new SYP
    discountPercent: 10,
    finalPriceSyp: 90000, // 900.00 new SYP
    commission: { type: 'fixed', amountSyp: 10000 }, // 100.00 new SYP
    commissionPerItemSyp: 10000,
    joinMode: 'open',
    status: 'active',
    endsAt: '2030-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    campaignType: 'product',
    shopName: 'محامص الشام',
    productName: 'قهوة عربية محمصة ٥٠٠ غ',
    description: 'خلطة قهوة طازجة مع هيل مطحون يومياً، خصم فوري عند إبراز بطاقة العرض في المحل.',
    imageUrl: '',
    originalPriceSyp: 75000, // 750.00 new SYP
    discountPercent: 20,
    finalPriceSyp: 60000, // 600.00 new SYP
    commission: { type: 'fixed', amountSyp: 6000 }, // 60.00 new SYP
    commissionPerItemSyp: 6000,
    joinMode: 'open',
    status: 'active',
    endsAt: '2030-02-15T00:00:00Z',
  },
];

interface SandboxMerchantCampaign extends SandboxCampaign {
  directReferralUrl: string | null;
  usage: {
    maxItems: number | null;
    itemsSold: number;
    itemsLeft: number | null;
    maxSalesVolumeSyp: number | null;
    salesVolumeSyp: number;
    salesVolumeLeftSyp: number | null;
    worstCaseReserveSyp: number;
    lockedBudgetSyp: number;
    commissionsPaidSyp: number;
    platformFeesPaidSyp: number;
  };
  stats: {
    clicks: number;
    salesCount: number;
    itemsSold: number;
    grossCashSalesSyp: number;
    commissionPaidSyp: number;
    platformFeesPaidSyp: number;
    conversionRatePercent: number;
  };
}

interface SandboxMerchantTransaction {
  id: string;
  kind:
    | 'merchant_topup'
    | 'campaign_reserve_lock'
    | 'campaign_reserve_unlock'
    | 'sale_reserve_debit'
    | 'cashback_voucher_merchant_credit';
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  referenceNote: string | null;
  createdAt: string;
}

const sandboxMerchantCampaigns: SandboxMerchantCampaign[] = [
  {
    id: 'aff111a7-e000-4000-8000-000000000040',
    campaignType: 'product',
    shopName: 'مخبز وحلويات السلمية',
    productName: 'علبة معمول مشكل ١ كغ',
    description:
      'معمول فاخر بالسمن العربي محشو بالفستق والجوز، العرض ساري بالمتجر عبر رمز QR.',
    imageUrl: '',
    originalPriceSyp: 100000, // 1,000.00 new SYP
    discountPercent: 10,
    finalPriceSyp: 90000, // 900.00 new SYP
    commission: { type: 'fixed', amountSyp: 10000 }, // 100.00 new SYP
    commissionPerItemSyp: 10000,
    joinMode: 'open',
    status: 'active',
    endsAt: '2030-01-01T00:00:00Z',
    directReferralUrl: null,
    usage: {
      maxItems: 30,
      itemsSold: 1,
      itemsLeft: 29,
      maxSalesVolumeSyp: null,
      salesVolumeSyp: 90000,
      salesVolumeLeftSyp: null,
      worstCaseReserveSyp: 435000, // 4,350.00 new SYP
      lockedBudgetSyp: 420500, // 4,205.00 new SYP
      commissionsPaidSyp: 10000,
      platformFeesPaidSyp: 4500,
    },
    stats: {
      clicks: 24,
      salesCount: 1,
      itemsSold: 1,
      grossCashSalesSyp: 90000,
      commissionPaidSyp: 10000,
      platformFeesPaidSyp: 4500,
      conversionRatePercent: 4.17,
    },
  },
  {
    id: 'aff111a7-e000-4000-8000-000000000039',
    campaignType: 'product',
    shopName: 'مخبز وحلويات السلمية',
    productName: 'بقلاوة مشكلة ٥٠٠ غ',
    description: 'بقلاوة طازجة بالفستق الحلبي مع خصم المتجر.',
    imageUrl: '',
    originalPriceSyp: 80000, // 800.00 new SYP
    discountPercent: 15,
    finalPriceSyp: 68000, // 680.00 new SYP
    commission: { type: 'fixed', amountSyp: 8000 }, // 80.00 new SYP
    commissionPerItemSyp: 8000,
    joinMode: 'open',
    status: 'ended',
    endsAt: '2026-11-22T20:00:00Z',
    directReferralUrl: null,
    usage: {
      maxItems: 10,
      itemsSold: 4,
      itemsLeft: 6,
      maxSalesVolumeSyp: null,
      salesVolumeSyp: 272000,
      salesVolumeLeftSyp: null,
      worstCaseReserveSyp: 114000,
      lockedBudgetSyp: 0,
      commissionsPaidSyp: 32000,
      platformFeesPaidSyp: 13600,
    },
    stats: {
      clicks: 38,
      salesCount: 4,
      itemsSold: 4,
      grossCashSalesSyp: 272000,
      commissionPaidSyp: 32000,
      platformFeesPaidSyp: 13600,
      conversionRatePercent: 10.53,
    },
  },
];

let sandboxMerchantAvailableSyp = 100000; // 1,000.00 new SYP
const sandboxMerchantTransactions: SandboxMerchantTransaction[] = [
  {
    id: 'tx-mer-006',
    kind: 'sale_reserve_debit',
    amountSyp: 14500,
    campaignId: 'aff111a7-e000-4000-8000-000000000040',
    campaignName: 'علبة معمول مشكل ١ كغ',
    referenceNote: 'OF-DEMO01',
    createdAt: '2026-11-23T08:15:00Z',
  },
  {
    id: 'tx-mer-005',
    kind: 'cashback_voucher_merchant_credit',
    amountSyp: 5000,
    campaignId: null,
    campaignName: null,
    referenceNote: 'CBV-9041',
    createdAt: '2026-11-22T18:30:00Z',
  },
  {
    id: 'tx-mer-004',
    kind: 'campaign_reserve_unlock',
    amountSyp: 68400,
    campaignId: 'aff111a7-e000-4000-8000-000000000039',
    campaignName: 'بقلاوة مشكلة ٥٠٠ غ',
    referenceNote: null,
    createdAt: '2026-11-22T14:10:00Z',
  },
  {
    id: 'tx-mer-003',
    kind: 'campaign_reserve_lock',
    amountSyp: 435000,
    campaignId: 'aff111a7-e000-4000-8000-000000000040',
    campaignName: 'علبة معمول مشكل ١ كغ',
    referenceNote: null,
    createdAt: '2026-11-21T10:00:00Z',
  },
  {
    id: 'tx-mer-002',
    kind: 'merchant_topup',
    amountSyp: 400000,
    campaignId: null,
    campaignName: null,
    referenceNote: 'REC-CASH-2026-11',
    createdAt: '2026-11-20T12:00:00Z',
  },
  {
    id: 'tx-mer-001',
    kind: 'merchant_topup',
    amountSyp: 100000,
    campaignId: null,
    campaignName: null,
    referenceNote: 'SEED-INITIAL-BALANCE',
    createdAt: '2026-11-20T08:05:00Z',
  },
];

function getSandboxLockedReservesSyp(): number {
  return sandboxMerchantCampaigns.reduce(
    (sum, item) => sum + item.usage.lockedBudgetSyp,
    0,
  );
}

interface SandboxMarketerMerchantEarnings {
  merchantId: string;
  shopName: string;
  salesCount: number;
  itemsSold: number;
  totalEarnedSyp: number;
}

interface SandboxMarketerTransaction {
  id: string;
  kind:
    | 'marketer_commission_credit'
    | 'payout_hold'
    | 'payout_release_refund'
    | 'payout_completed';
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  shopName: string | null;
  createdAt: string;
}

type SandboxPayoutStatus = 'pending_review' | 'confirmed' | 'rejected';

interface SandboxMarketerPayout {
  id: string;
  amountSyp: number;
  status: SandboxPayoutStatus;
  createdAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
}

interface SandboxMarketerWalletState {
  availableBalanceSyp: number;
  pendingPayoutSyp: number;
  totalEarnedSyp: number;
  confirmedPaidOutSyp: number;
  payouts: SandboxMarketerPayout[];
  transactions: SandboxMarketerTransaction[];
  byMerchant: SandboxMarketerMerchantEarnings[];
  statsClicks: number;
  statsConversionRatePercent: number;
}

const membershipsByAccountAndCampaign = new Map<string, SandboxMembership>();
const sandboxMarketerWalletsByAccountId = new Map<string, SandboxMarketerWalletState>([
  [
    DEMO_MARKETER_ACCOUNT.id,
    {
      availableBalanceSyp: 14000, // 140.00 new SYP ready for simulated payout test
      pendingPayoutSyp: 0,
      totalEarnedSyp: 26000, // 260.00 new SYP lifetime commissions
      confirmedPaidOutSyp: 12000, // 120.00 new SYP confirmed paid out
      payouts: [
        {
          id: '40000000-0000-4000-8000-000000000002',
          amountSyp: 4000,
          status: 'rejected',
          createdAt: '2026-11-22T17:40:00Z',
          decidedAt: '2026-11-22T18:10:00Z',
          rejectionReason: 'تم إلغاء الطلب التجريبي لإعادة التجميع مع الدفعة التالية.',
        },
        {
          id: '40000000-0000-4000-8000-000000000001',
          amountSyp: 12000,
          status: 'confirmed',
          createdAt: '2026-11-21T15:00:00Z',
          decidedAt: '2026-11-21T16:00:00Z',
          rejectionReason: null,
        },
      ],
      transactions: [
        {
          id: 'tx-mkt-006',
          kind: 'marketer_commission_credit',
          amountSyp: 10000,
          campaignId: 'aff111a7-e000-4000-8000-000000000040',
          campaignName: 'علبة معمول مشكل ١ كغ',
          shopName: 'مخبز وحلويات السلمية',
          createdAt: '2026-11-23T08:15:00Z',
        },
        {
          id: 'tx-mkt-005b',
          kind: 'payout_release_refund',
          amountSyp: 4000,
          campaignId: null,
          campaignName: null,
          shopName: null,
          createdAt: '2026-11-22T18:10:00Z',
        },
        {
          id: 'tx-mkt-005',
          kind: 'payout_hold',
          amountSyp: 4000,
          campaignId: null,
          campaignName: null,
          shopName: null,
          createdAt: '2026-11-22T17:40:00Z',
        },
        {
          id: 'tx-mkt-004',
          kind: 'marketer_commission_credit',
          amountSyp: 6000,
          campaignId: '10000000-0000-4000-8000-000000000002',
          campaignName: 'قهوة عربية محمصة ٥٠٠ غ',
          shopName: 'محامص الشام',
          createdAt: '2026-11-22T12:15:00Z',
        },
        {
          id: 'tx-mkt-003',
          kind: 'payout_completed',
          amountSyp: 12000,
          campaignId: null,
          campaignName: null,
          shopName: null,
          createdAt: '2026-11-21T16:00:00Z',
        },
        {
          id: 'tx-mkt-003a',
          kind: 'payout_hold',
          amountSyp: 12000,
          campaignId: null,
          campaignName: null,
          shopName: null,
          createdAt: '2026-11-21T15:00:00Z',
        },
        {
          id: 'tx-mkt-002',
          kind: 'marketer_commission_credit',
          amountSyp: 6000,
          campaignId: '20000000-0000-4000-8000-000000000022',
          campaignName: 'شال صوف شتوي مطرز',
          shopName: 'أزياء الريف الدمشقي',
          createdAt: '2026-11-21T11:20:00Z',
        },
        {
          id: 'tx-mkt-001',
          kind: 'marketer_commission_credit',
          amountSyp: 4000,
          campaignId: 'aff111a7-e000-4000-8000-000000000039',
          campaignName: 'بقلاوة مشكلة ٥٠٠ غ',
          shopName: 'مخبز وحلويات السلمية',
          createdAt: '2026-11-20T14:05:00Z',
        },
      ],
      byMerchant: [
        {
          merchantId: 'aff111a7-e000-4000-8000-000000000002',
          shopName: 'مخبز وحلويات السلمية',
          salesCount: 2,
          itemsSold: 2,
          totalEarnedSyp: 14000,
        },
        {
          merchantId: '20000000-0000-4000-8000-000000000011',
          shopName: 'محامص الشام',
          salesCount: 1,
          itemsSold: 1,
          totalEarnedSyp: 6000,
        },
        {
          merchantId: '20000000-0000-4000-8000-000000000012',
          shopName: 'أزياء الريف الدمشقي',
          salesCount: 1,
          itemsSold: 1,
          totalEarnedSyp: 6000,
        },
      ],
      statsClicks: 48,
      statsConversionRatePercent: 8.33,
    },
  ],
  [
    DEMO_DUAL_ACCOUNT.id,
    {
      availableBalanceSyp: 6000, // 60.00 new SYP
      pendingPayoutSyp: 4000, // Active pending_review payout seeded for testing PAYOUT_ALREADY_PENDING
      totalEarnedSyp: 10000,
      confirmedPaidOutSyp: 0,
      payouts: [
        {
          id: '40000000-0000-4000-8000-000000000009',
          amountSyp: 4000,
          status: 'pending_review',
          createdAt: '2026-11-23T09:00:00Z',
          decidedAt: null,
          rejectionReason: null,
        },
      ],
      transactions: [
        {
          id: 'tx-dual-002',
          kind: 'payout_hold',
          amountSyp: 4000,
          campaignId: null,
          campaignName: null,
          shopName: null,
          createdAt: '2026-11-23T09:00:00Z',
        },
        {
          id: 'tx-dual-001',
          kind: 'marketer_commission_credit',
          amountSyp: 10000,
          campaignId: 'aff111a7-e000-4000-8000-000000000040',
          campaignName: 'علبة معمول مشكل ١ كغ',
          shopName: 'مخبز وحلويات السلمية',
          createdAt: '2026-11-22T14:00:00Z',
        },
      ],
      byMerchant: [
        {
          merchantId: 'aff111a7-e000-4000-8000-000000000002',
          shopName: 'مخبز وحلويات السلمية',
          salesCount: 1,
          itemsSold: 1,
          totalEarnedSyp: 10000,
        },
      ],
      statsClicks: 16,
      statsConversionRatePercent: 6.25,
    },
  ],
]);

function getOrCreateMarketerWalletState(accountId: string): SandboxMarketerWalletState {
  const existing = sandboxMarketerWalletsByAccountId.get(accountId);
  if (existing) {
    return existing;
  }
  const initial: SandboxMarketerWalletState = {
    availableBalanceSyp: 0,
    pendingPayoutSyp: 0,
    totalEarnedSyp: 0,
    confirmedPaidOutSyp: 0,
    payouts: [],
    transactions: [],
    byMerchant: [],
    statsClicks: 0,
    statsConversionRatePercent: 0,
  };
  sandboxMarketerWalletsByAccountId.set(accountId, initial);
  return initial;
}

const sandboxPayoutIdempotency = new Map<
  string,
  { fingerprint: string; payout: SandboxMarketerPayout }
>();

let tokenCounter = 1;
const revokedSandboxTokens = new Set<string>();
const ACCESS_TOKEN_PATTERN = /^dev-access-token:([^:]+):\d+$/;
const REFRESH_TOKEN_PATTERN = /^dev-refresh-token:([^:]+):\d+$/;

function assertSandboxEnabled(): void {
  if (!env.useDevSandbox) {
    throw new ApiClientError(500, 'INTERNAL_ERROR', 'Dev sandbox is disabled.');
  }
}

function getAllSandboxAccounts(): Account[] {
  return [
    ...Object.values(SEEDED_ACCOUNTS_BY_KEY),
    ...Array.from(registeredSandboxAccounts.values()),
  ];
}

function resolveAccountFromPhone(phone: string): Account | null {
  const registered = registeredSandboxAccounts.get(phone);
  if (registered) {
    return registered;
  }
  return (
    Object.values(SEEDED_ACCOUNTS_BY_KEY).find((account) => account.phone === phone) ??
    null
  );
}

function resolveAccountFromToken(
  token: string | null | undefined,
  kind: 'access' | 'refresh' = 'access',
): Account | null {
  if (!token || revokedSandboxTokens.has(token)) {
    return null;
  }
  const pattern = kind === 'access' ? ACCESS_TOKEN_PATTERN : REFRESH_TOKEN_PATTERN;
  const match = token.match(pattern);
  if (!match) {
    return null;
  }
  const accountId = match[1];
  return getAllSandboxAccounts().find((account) => account.id === accountId) ?? null;
}

async function requireAuthenticatedAccount(): Promise<Account> {
  const accessToken = await tokenStorage.getAccessToken();
  const account = resolveAccountFromToken(accessToken, 'access');
  if (!account) {
    throw new ApiClientError(401, 'AUTH_REQUIRED', 'Valid authentication is required.');
  }
  return account;
}

function getMembershipKey(accountId: string, campaignId: string): string {
  return `${accountId}:${campaignId}`;
}

function buildSessionForAccount(account: Account): AuthSession {
  const index = tokenCounter++;
  return {
    accessToken: `dev-access-token:${account.id}:${index}`,
    expiresInSeconds: 900,
    refreshToken: `dev-refresh-token:${account.id}:${index}`,
    user: account,
  };
}

function normalizePath(path: string): string {
  const [pathname] = path.split('?');
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

const sandboxCampaignLaunchIdempotency = new Map<
  string,
  { fingerprint: string; campaign: SandboxMerchantCampaign }
>();

interface SandboxOfferPass {
  passId: string;
  code: string;
  qrToken: string;
  campaignId: string;
  customerId?: string;
  customerName: string;
  status: 'active' | 'redeemed' | 'expired';
}

interface SandboxReferralEntry {
  code: string;
  campaignId: string;
  referringMarketerId: string | null;
  shopDetails: string;
}

interface SandboxCustomerOfferQrPass {
  passId: string;
  campaignId: string;
  campaignType: 'product' | 'store_discount';
  productName: string;
  shopName: string;
  discountPercent: number;
  finalPriceSyp: number | null;
  qrToken: string;
  passCode: string;
  status: 'active' | 'redeemed' | 'expired';
  createdAt: string;
}

interface SandboxCustomerDashboardState {
  verifiedPurchaseCount: number;
  milestonePurchaseCount: number;
  milestonePurchasesRequired: number;
  milestoneSpendSyp: number;
  milestoneSpendRequiredSyp: number;
  lockedCashbackSyp: number;
  availableCashbackSyp: number;
  totalCashbackUnlockedSyp: number;
}

interface SandboxCustomerPurchaseItem {
  saleId: string;
  shopName: string;
  productName: string;
  quantity: number;
  customerPaidCashSyp: number;
  cashbackEarnedSyp: number;
  scannedAt: string;
}

const DEFAULT_MILESTONE_PURCHASES_REQUIRED = 5;
const DEFAULT_MILESTONE_SPEND_REQUIRED_SYP = 50000;

const sandboxReferralCodes = new Map<string, SandboxReferralEntry>([
  [
    'mk-demo01',
    {
      code: 'mk-demo01',
      campaignId: 'aff111a7-e000-4000-8000-000000000040',
      referringMarketerId: 'aff111a7-e000-4000-8000-000000000006',
      shopDetails: 'شارع حماة الرئيسي، مقابل الحديقة العامة - السلمية',
    },
  ],
  [
    'mk-coffee',
    {
      code: 'mk-coffee',
      campaignId: '10000000-0000-4000-8000-000000000002',
      referringMarketerId: 'aff111a7-e000-4000-8000-000000000006',
      shopDetails: 'شارع القوتلي، السلمية',
    },
  ],
  [
    'dir-bakery',
    {
      code: 'dir-bakery',
      campaignId: 'aff111a7-e000-4000-8000-000000000040',
      referringMarketerId: null,
      shopDetails: 'شارع حماة الرئيسي، مقابل الحديقة العامة - السلمية',
    },
  ],
  [
    'mk-self01',
    {
      code: 'mk-self01',
      campaignId: 'aff111a7-e000-4000-8000-000000000040',
      referringMarketerId: DEMO_MULTI_ROLE_ACCOUNT.id,
      shopDetails: 'شارع حماة الرئيسي، مقابل الحديقة العامة - السلمية',
    },
  ],
  [
    'mk-ended',
    {
      code: 'mk-ended',
      campaignId: 'aff111a7-e000-4000-8000-000000000039',
      referringMarketerId: 'aff111a7-e000-4000-8000-000000000006',
      shopDetails: 'شارع حماة الرئيسي، مقابل الحديقة العامة - السلمية',
    },
  ],
]);

const sandboxCustomerOfferQrByKey = new Map<string, SandboxCustomerOfferQrPass>();

const sandboxCustomerDashboards = new Map<string, SandboxCustomerDashboardState>([
  [
    DEMO_CUSTOMER_ACCOUNT.id,
    {
      verifiedPurchaseCount: 2,
      milestonePurchaseCount: 2,
      milestonePurchasesRequired: DEFAULT_MILESTONE_PURCHASES_REQUIRED,
      milestoneSpendSyp: 150000,
      milestoneSpendRequiredSyp: DEFAULT_MILESTONE_SPEND_REQUIRED_SYP,
      lockedCashbackSyp: 3000,
      availableCashbackSyp: 5000,
      totalCashbackUnlockedSyp: 5000,
    },
  ],
  [
    DEMO_SCANNER_CUSTOMER_ACCOUNT.id,
    {
      verifiedPurchaseCount: 0,
      milestonePurchaseCount: 0,
      milestonePurchasesRequired: DEFAULT_MILESTONE_PURCHASES_REQUIRED,
      milestoneSpendSyp: 0,
      milestoneSpendRequiredSyp: DEFAULT_MILESTONE_SPEND_REQUIRED_SYP,
      lockedCashbackSyp: 0,
      availableCashbackSyp: 0,
      totalCashbackUnlockedSyp: 0,
    },
  ],
  [
    DEMO_MULTI_ROLE_ACCOUNT.id,
    {
      verifiedPurchaseCount: 0,
      milestonePurchaseCount: 0,
      milestonePurchasesRequired: DEFAULT_MILESTONE_PURCHASES_REQUIRED,
      milestoneSpendSyp: 0,
      milestoneSpendRequiredSyp: DEFAULT_MILESTONE_SPEND_REQUIRED_SYP,
      lockedCashbackSyp: 0,
      availableCashbackSyp: 0,
      totalCashbackUnlockedSyp: 0,
    },
  ],
]);

const sandboxCustomerPurchasesByUserId = new Map<string, SandboxCustomerPurchaseItem[]>([
  [
    DEMO_CUSTOMER_ACCOUNT.id,
    [
      {
        saleId: 'sale-cust-0002',
        shopName: 'مخبز وحلويات السلمية',
        productName: 'علبة معمول مشكل ١ كغ',
        quantity: 1,
        customerPaidCashSyp: 90000,
        cashbackEarnedSyp: 1800,
        scannedAt: '2026-11-23T08:15:00Z',
      },
      {
        saleId: 'sale-cust-0001',
        shopName: 'محامص الشام',
        productName: 'قهوة عربية محمصة ٥٠٠ غ',
        quantity: 1,
        customerPaidCashSyp: 60000,
        cashbackEarnedSyp: 1200,
        scannedAt: '2026-11-21T16:40:00Z',
      },
    ],
  ],
]);

function getOrCreateCustomerDashboard(userId: string): SandboxCustomerDashboardState {
  const existing = sandboxCustomerDashboards.get(userId);
  if (existing) {
    return existing;
  }
  const initial: SandboxCustomerDashboardState = {
    verifiedPurchaseCount: 0,
    milestonePurchaseCount: 0,
    milestonePurchasesRequired: DEFAULT_MILESTONE_PURCHASES_REQUIRED,
    milestoneSpendSyp: 0,
    milestoneSpendRequiredSyp: DEFAULT_MILESTONE_SPEND_REQUIRED_SYP,
    lockedCashbackSyp: 0,
    availableCashbackSyp: 0,
    totalCashbackUnlockedSyp: 0,
  };
  sandboxCustomerDashboards.set(userId, initial);
  return initial;
}

function findSandboxCampaignById(campaignId: string): SandboxCampaign | undefined {
  return (
    sandboxMerchantCampaigns.find((item) => item.id === campaignId) ??
    SEEDED_CAMPAIGNS.find((item) => item.id === campaignId)
  );
}

function isSandboxCampaignAvailable(campaign: SandboxCampaign): boolean {
  return campaign.status === 'active' && new Date(campaign.endsAt).getTime() > Date.now();
}

function requireEmptySandboxBody(body: unknown): void {
  if (
    body !== undefined &&
    (body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 0)
  ) {
    throw new ApiClientError(
      400,
      'VALIDATION_ERROR',
      'This operation does not accept request fields.',
    );
  }
}

const sandboxOfferPasses = new Map<string, SandboxOfferPass>();
const sandboxOfferPassesByQrToken = new Map<string, SandboxOfferPass>();

function registerSandboxOfferPass(pass: SandboxOfferPass): void {
  sandboxOfferPasses.set(pass.code, pass);
  sandboxOfferPassesByQrToken.set(pass.qrToken, pass);
}

function findSandboxOfferPass(codeOrQrToken: string): SandboxOfferPass | undefined {
  return (
    sandboxOfferPasses.get(codeOrQrToken) ??
    sandboxOfferPassesByQrToken.get(codeOrQrToken)
  );
}

registerSandboxOfferPass({
  passId: 'aff111a7-e000-4000-8000-000000000042',
  code: 'OF-DEMO01',
  qrToken: 'mardood-qr-OF-DEMO01-00000040-000007',
  campaignId: 'aff111a7-e000-4000-8000-000000000040',
  customerId: DEMO_SCANNER_CUSTOMER_ACCOUNT.id,
  customerName: 'ليلى حسن',
  status: 'active',
});

registerSandboxOfferPass({
  passId: 'pass-demo-exp1',
  code: 'OF-EXPIRED',
  qrToken: 'mardood-qr-OF-EXPIRED-00000040-demo',
  campaignId: 'aff111a7-e000-4000-8000-000000000040',
  customerName: 'زبون تجريبي',
  status: 'expired',
});

const sandboxRedeemIdempotency = new Map<
  string,
  { fingerprint: string; result: Record<string, unknown> }
>();

const SCANNER_CODE_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

const MAX_SAFE_MINOR_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const UUID_36_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function computeSandboxProductPreview(params: {
  originalPriceSyp: number;
  discountPercent: number;
  commissionAmountSyp: number;
  maxItems: number;
  availableBalanceSyp: number;
}) {
  if (
    !Number.isSafeInteger(params.originalPriceSyp) ||
    params.originalPriceSyp <= 0 ||
    !Number.isFinite(params.discountPercent) ||
    params.discountPercent < 0 ||
    params.discountPercent > 100 ||
    !Number.isSafeInteger(params.commissionAmountSyp) ||
    params.commissionAmountSyp < 0 ||
    !Number.isSafeInteger(params.maxItems) ||
    params.maxItems < 1
  ) {
    throw new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid campaign preview parameters.');
  }

  const discountBps = BigInt(Math.round(params.discountPercent * 100));
  if (discountBps < 0n || discountBps > 10_000n) {
    throw new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid discount percentage.');
  }

  const original = BigInt(params.originalPriceSyp);
  const commission = BigInt(params.commissionAmountSyp);
  const maxItems = BigInt(params.maxItems);

  const finalPrice = (original * (10_000n - discountBps)) / 10_000n;
  if (finalPrice <= 0n) {
    throw new ApiClientError(400, 'VALIDATION_ERROR', 'Final price must be greater than zero.');
  }

  const platformTotalFee = (finalPrice * 5n) / 100n;
  const customerCashback = (finalPrice * 2n) / 100n;
  const platformNetFee = platformTotalFee - customerCashback;
  const merchantNet = finalPrice - commission - platformTotalFee;
  const worstCaseReserve = (commission + platformTotalFee) * maxItems;

  if (
    finalPrice > MAX_SAFE_MINOR_BIGINT ||
    worstCaseReserve > MAX_SAFE_MINOR_BIGINT
  ) {
    throw new ApiClientError(
      409,
      'AMOUNT_OUT_OF_RANGE',
      'Calculated monetary values exceed safe limits.',
    );
  }

  if (merchantNet <= 0n) {
    throw new ApiClientError(
      400,
      'VALIDATION_ERROR',
      'Discount and commission leave no positive merchant net amount.',
    );
  }

  const available = BigInt(Math.max(0, Math.trunc(params.availableBalanceSyp)));

  return {
    finalPriceSyp: Number(finalPrice),
    sampleSaleAmountSyp: Number(finalPrice),
    commissionPerUnitSyp: Number(commission),
    platformTotalFeeSampleSyp: Number(platformTotalFee),
    customerCashbackSampleSyp: Number(customerCashback),
    platformNetFeeSampleSyp: Number(platformNetFee),
    merchantNetSampleSyp: Number(merchantNet),
    worstCaseReserveSyp: Number(worstCaseReserve),
    isAffordableByMerchant: available >= worstCaseReserve,
    merchantAvailableBalanceSyp: Number(available),
  };
}

export interface SandboxRequestOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
  bearerToken?: string | null;
}

function waitSandboxDelay(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new ApiClientError(0, 'NETWORK_ERROR', 'Request aborted.'));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, 250);

    function onAbort() {
      clearTimeout(timer);
      reject(new ApiClientError(0, 'NETWORK_ERROR', 'Request aborted.'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function handleSandboxRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options?: SandboxRequestOptions,
): Promise<T> {
  assertSandboxEnabled();

  await waitSandboxDelay(options?.signal);
  const pathname = normalizePath(path);

  if (method === 'POST' && pathname === '/auth/login') {
    const payload = (body ?? {}) as { phone?: string; password?: string };
    const phone = payload.phone?.trim() ?? '';
    const password = payload.password ?? '';
    if (!phone || !password) {
      throw new ApiClientError(400, 'VALIDATION_ERROR', 'Missing credentials.');
    }
    const account = resolveAccountFromPhone(phone);
    const expectedPassword = account ? sandboxPasswordsByPhone.get(account.phone) : undefined;
    if (!account || !expectedPassword || password !== expectedPassword) {
      throw new ApiClientError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid phone number or password.',
      );
    }
    return buildSessionForAccount(account) as T;
  }

  if (method === 'POST' && pathname === '/auth/register') {
    const payload = (body ?? {}) as {
      name?: string;
      phone?: string;
      password?: string;
      roles?: ('customer' | 'marketer' | 'merchant')[];
      shop?: { name?: string; details?: string };
    };

    const name = payload.name?.trim() ?? '';
    const phone = payload.phone?.trim() ?? '';
    const password = payload.password ?? '';
    const roles = Array.isArray(payload.roles) ? Array.from(new Set(payload.roles)) : [];
    const includesMerchant = roles.includes('merchant');
    const shopName = payload.shop?.name?.trim() ?? '';
    const shopDetails = payload.shop?.details?.trim() ?? '';

    if (
      !name ||
      !/^09[0-9]{8}$/.test(phone) ||
      password.length === 0 ||
      roles.length === 0 ||
      (includesMerchant && (!shopName || !shopDetails))
    ) {
      throw new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid registration input.');
    }

    const existing = getAllSandboxAccounts().find((acc) => acc.phone === phone);
    if (existing) {
      throw new ApiClientError(
        409,
        'PHONE_ALREADY_REGISTERED',
        'Phone number is already registered.',
      );
    }

    const index = registeredSandboxAccounts.size + 11;
    const suffix = String(index).padStart(12, '0');
    const newAccount: Account = {
      id: `aff111a7-e000-4000-9000-${suffix}`,
      name,
      phone,
      roles,
      createdAt: new Date().toISOString(),
      merchant: includesMerchant
        ? {
            name: shopName,
            details: shopDetails,
            verificationStatus: 'pending',
            contractReference: null,
          }
        : null,
      customer: roles.includes('customer')
        ? {
            verifiedPurchaseCount: 0,
            availableCashbackSyp: 0,
            lockedCashbackSyp: 0,
          }
        : null,
    };

    if (roles.includes('customer')) {
      getOrCreateCustomerDashboard(newAccount.id);
      sandboxCustomerPurchasesByUserId.set(newAccount.id, []);
    }

    registeredSandboxAccounts.set(phone, newAccount);
    sandboxPasswordsByPhone.set(phone, password);
    return buildSessionForAccount(newAccount) as T;
  }

  if (method === 'POST' && pathname === '/auth/refresh') {
    const payload = (body ?? {}) as { refreshToken?: string };
    const refreshToken = payload.refreshToken?.trim() ?? '';
    const account = resolveAccountFromToken(refreshToken, 'refresh');
    if (!account) {
      throw new ApiClientError(401, 'REFRESH_TOKEN_INVALID', 'Invalid refresh token.');
    }
    revokedSandboxTokens.add(refreshToken);
    return buildSessionForAccount(account) as T;
  }

  if (method === 'POST' && pathname === '/auth/logout') {
    const accessToken =
      options?.bearerToken !== undefined
        ? options.bearerToken
        : await tokenStorage.getAccessToken();
    const account = resolveAccountFromToken(accessToken, 'access');
    if (!account) {
      throw new ApiClientError(401, 'AUTH_REQUIRED', 'Valid authentication is required.');
    }
    const payload = (body ?? {}) as { refreshToken?: string };
    const refreshToken = payload.refreshToken?.trim();
    if (refreshToken) {
      const refreshAccount = resolveAccountFromToken(refreshToken, 'refresh');
      if (!refreshAccount || refreshAccount.id !== account.id) {
        throw new ApiClientError(401, 'REFRESH_TOKEN_INVALID', 'Invalid refresh token.');
      }
      revokedSandboxTokens.add(refreshToken);
    }
    if (accessToken) {
      revokedSandboxTokens.add(accessToken);
    }
    return undefined as T;
  }

  if (method === 'GET' && pathname === '/auth/me') {
    const account = await requireAuthenticatedAccount();
    return account as T;
  }

  if (method === 'GET' && pathname === '/campaigns') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;
    const searchQuery = (params.get('q') ?? '').trim().toLowerCase();
    const campaignTypeFilter = params.get('campaignType');
    const joinModeFilter = params.get('joinMode');

    const filtered =
      (campaignTypeFilter && campaignTypeFilter !== 'product') ||
      (joinModeFilter && joinModeFilter !== 'open')
        ? []
        : SEEDED_CAMPAIGNS.filter((item) => {
            if (
              !isSandboxCampaignAvailable(item) ||
              item.campaignType !== 'product' ||
              item.joinMode !== 'open'
            ) {
              return false;
            }
            if (!searchQuery) {
              return true;
            }
            return (
              item.productName.toLowerCase().includes(searchQuery) ||
              item.shopName.toLowerCase().includes(searchQuery)
            );
          });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = page > totalPages ? [] : filtered.slice(start, start + pageSize);

    const response: PaginatedResponse<SandboxCampaign> = {
      items,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: start + pageSize < total ? page + 1 : null,
    };
    return response as T;
  }

  const campaignDetailMatch = pathname.match(/^\/campaigns\/([^/]+)$/);
  if (method === 'GET' && campaignDetailMatch) {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const campaignId = decodeURIComponent(campaignDetailMatch[1]);
    const campaign = SEEDED_CAMPAIGNS.find((item) => item.id === campaignId);
    if (!campaign || !isSandboxCampaignAvailable(campaign)) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Campaign not found.');
    }
    return campaign as T;
  }

  const joinMatch = pathname.match(/^\/marketer\/campaigns\/([^/]+)\/join$/);
  if (method === 'POST' && joinMatch) {
    requireEmptySandboxBody(body);
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const campaignId = decodeURIComponent(joinMatch[1]);
    const campaign = SEEDED_CAMPAIGNS.find((item) => item.id === campaignId);
    if (!campaign) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Campaign not found.');
    }
    if (!isSandboxCampaignAvailable(campaign)) {
      throw new ApiClientError(409, 'CAMPAIGN_ENDED', 'This campaign has ended.');
    }

    const membershipKey = getMembershipKey(account.id, campaign.id);
    const existing = membershipsByAccountAndCampaign.get(membershipKey);
    if (existing) {
      return existing as T;
    }

    const webBase = env.webBaseUrl || 'https://alsalamiyah-offers.example.test';
    const accountSuffix = account.id.slice(-4);
    const shortSuffix = campaign.id.slice(-4);
    const referralCode = `MK-DEV-${accountSuffix}-${shortSuffix}`;
    const membership: SandboxMembership = {
      id: `20000000-${accountSuffix}-4000-8000-00000000${shortSuffix}`,
      status: 'approved',
      requestedAt: new Date().toISOString(),
      campaign,
      referralUrl: `${webBase}/r/${referralCode}`,
      stats: {
        clicks: 0,
        itemsSold: 0,
        earnedSyp: 0,
        conversionRatePercent: 0,
      },
    };
    membershipsByAccountAndCampaign.set(membershipKey, membership);
    sandboxReferralCodes.set(referralCode, {
      code: referralCode,
      campaignId: campaign.id,
      referringMarketerId: account.id,
      shopDetails: 'شارع حماة الرئيسي - السلمية',
    });
    return membership as T;
  }

  const membershipMatch = pathname.match(/^\/marketer\/campaigns\/([^/]+)\/membership$/);
  if (method === 'GET' && membershipMatch) {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }
    const campaignId = decodeURIComponent(membershipMatch[1]);
    return {
      membership:
        membershipsByAccountAndCampaign.get(getMembershipKey(account.id, campaignId)) ?? null,
    } as T;
  }

  if (method === 'GET' && pathname === '/marketer/memberships') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const statusFilter = params.get('status');
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const accountPrefix = `${account.id}:`;
    const scopedItems = Array.from(membershipsByAccountAndCampaign.entries())
      .filter(([key, value]) => {
        if (!key.startsWith(accountPrefix)) {
          return false;
        }
        if (
          statusFilter &&
          ['pending', 'approved', 'rejected'].includes(statusFilter) &&
          value.status !== statusFilter
        ) {
          return false;
        }
        return true;
      })
      .map(([, value]) => value);

    const total = scopedItems.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = page > totalPages ? [] : scopedItems.slice(start, start + pageSize);

    const response: PaginatedResponse<SandboxMembership> = {
      items,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: start + pageSize < total ? page + 1 : null,
    };
    return response as T;
  }

  if (method === 'GET' && pathname === '/marketer/wallet') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const walletState = getOrCreateMarketerWalletState(account.id);
    return {
      availableBalanceSyp: walletState.availableBalanceSyp,
      pendingPayoutSyp: walletState.pendingPayoutSyp,
      totalEarnedSyp: walletState.totalEarnedSyp,
      totalConfirmedPaidOutSyp: walletState.confirmedPaidOutSyp,
    } as T;
  }

  if (method === 'GET' && pathname === '/marketer/stats') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const walletState = getOrCreateMarketerWalletState(account.id);
    const totalItemsSold = walletState.byMerchant.reduce(
      (sum, item) => sum + item.itemsSold,
      0,
    );
    const totalEarned = walletState.byMerchant.reduce(
      (sum, item) => sum + item.totalEarnedSyp,
      0,
    );

    return {
      clicks: walletState.statsClicks,
      itemsSold: totalItemsSold,
      earnedSyp: totalEarned,
      conversionRatePercent: walletState.statsConversionRatePercent,
    } as T;
  }

  if (method === 'GET' && pathname === '/marketer/wallet/by-merchant') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const walletState = getOrCreateMarketerWalletState(account.id);
    const start = (page - 1) * pageSize;
    const sliced = walletState.byMerchant.slice(start, start + pageSize);
    const total = walletState.byMerchant.length;
    const hasNext = start + pageSize < total;

    return {
      items: sliced,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: hasNext ? page + 1 : null,
    } as T;
  }

  if (method === 'GET' && pathname === '/marketer/wallet/transactions') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const walletState = getOrCreateMarketerWalletState(account.id);
    const start = (page - 1) * pageSize;
    const sliced = walletState.transactions.slice(start, start + pageSize);
    const total = walletState.transactions.length;
    const hasNext = start + pageSize < total;

    return {
      items: sliced,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: hasNext ? page + 1 : null,
    } as T;
  }

  if (method === 'POST' && pathname === '/marketer/payouts') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const idempotencyKey = options?.idempotencyKey?.trim() ?? '';
    if (!UUID_36_REGEX.test(idempotencyKey)) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Valid 36-character UUID Idempotency-Key header is required.',
      );
    }

    const payload = (body ?? {}) as { expectedAmountSyp?: unknown };
    const expectedAmountSyp = payload.expectedAmountSyp;
    if (
      typeof expectedAmountSyp !== 'number' ||
      !Number.isSafeInteger(expectedAmountSyp) ||
      expectedAmountSyp < 1 ||
      BigInt(expectedAmountSyp) > MAX_SAFE_MINOR_BIGINT
    ) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'expectedAmountSyp must be a positive safe integer.',
      );
    }

    const fingerprint = JSON.stringify({ expectedAmountSyp });
    const idempotencyCacheKey = `${account.id}:${idempotencyKey.toLowerCase()}`;
    const existingPayout = sandboxPayoutIdempotency.get(idempotencyCacheKey);
    if (existingPayout) {
      if (existingPayout.fingerprint !== fingerprint) {
        throw new ApiClientError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency-Key reused with different request payload.',
        );
      }
      return existingPayout.payout as T;
    }

    const walletState = getOrCreateMarketerWalletState(account.id);
    const hasPendingPayout = walletState.payouts.some(
      (item) => item.status === 'pending_review',
    );
    if (hasPendingPayout || walletState.pendingPayoutSyp > 0) {
      throw new ApiClientError(
        409,
        'PAYOUT_ALREADY_PENDING',
        'A payout request is already pending.',
      );
    }

    if (walletState.availableBalanceSyp <= 0) {
      throw new ApiClientError(
        409,
        'INSUFFICIENT_WALLET_BALANCE',
        'There is no available balance to withdraw.',
      );
    }

    if (walletState.availableBalanceSyp !== expectedAmountSyp) {
      throw new ApiClientError(
        409,
        'PAYOUT_AMOUNT_CHANGED',
        'The available amount has changed. Refresh the wallet and confirm again.',
      );
    }

    const nowIso = new Date().toISOString();
    const amountSyp = walletState.availableBalanceSyp;
    const payoutSerial = String(walletState.payouts.length + 101).padStart(12, '0');
    const createdPayout: SandboxMarketerPayout = {
      id: `40000000-${account.id.slice(-4)}-4000-8000-${payoutSerial}`,
      amountSyp,
      status: 'pending_review',
      createdAt: nowIso,
      decidedAt: null,
      rejectionReason: null,
    };

    walletState.availableBalanceSyp = 0;
    walletState.pendingPayoutSyp = amountSyp;
    walletState.payouts.unshift(createdPayout);
    walletState.transactions.unshift({
      id: `tx-mkt-hold-${Date.now()}`,
      kind: 'payout_hold',
      amountSyp,
      campaignId: null,
      campaignName: null,
      shopName: null,
      createdAt: nowIso,
    });

    sandboxPayoutIdempotency.set(idempotencyCacheKey, {
      fingerprint,
      payout: createdPayout,
    });

    return createdPayout as T;
  }

  if (method === 'GET' && pathname === '/marketer/payouts') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('marketer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Marketer role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const statusParam = params.get('status');

    if (
      statusParam !== null &&
      statusParam !== '' &&
      statusParam !== 'pending_review' &&
      statusParam !== 'confirmed' &&
      statusParam !== 'rejected'
    ) {
      throw new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid payout status filter.');
    }

    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const walletState = getOrCreateMarketerWalletState(account.id);
    const sorted = [...walletState.payouts].sort((a, b) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id.localeCompare(a.id);
    });

    const filtered = statusParam
      ? sorted.filter((item) => item.status === statusParam)
      : sorted;

    const start = (page - 1) * pageSize;
    const sliced = filtered.slice(start, start + pageSize);
    const total = filtered.length;
    const hasNext = start + pageSize < total;

    return {
      items: sliced,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: hasNext ? page + 1 : null,
    } as T;
  }

  if (method === 'GET' && pathname === '/merchant/dashboard') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const verificationStatus = account.merchant?.verificationStatus ?? 'pending';
    const isVerified = verificationStatus === 'verified';

    return {
      verificationStatus,
      wallet: {
        availableBalanceSyp: isVerified ? sandboxMerchantAvailableSyp : 0,
        totalLockedReservesSyp: isVerified ? getSandboxLockedReservesSyp() : 0,
        creditLimitSyp: 0,
      },
      activeCampaignsCount: isVerified
        ? sandboxMerchantCampaigns.filter((item) => item.status === 'active').length
        : 0,
      topCampaign: isVerified
        ? {
            campaignId: 'aff111a7-e000-4000-8000-000000000039',
            productName: 'بقلاوة مشكلة ٥٠٠ غ',
            grossCashSalesSyp: 272000,
            salesCount: 4,
          }
        : null,
      stats: {
        clicks: isVerified
          ? sandboxMerchantCampaigns.reduce((sum, c) => sum + c.stats.clicks, 0)
          : 0,
        salesCount: isVerified
          ? sandboxMerchantCampaigns.reduce((sum, c) => sum + c.stats.salesCount, 0)
          : 0,
        itemsSold: isVerified
          ? sandboxMerchantCampaigns.reduce((sum, c) => sum + c.stats.itemsSold, 0)
          : 0,
        grossCashSalesSyp: isVerified
          ? sandboxMerchantCampaigns.reduce((sum, c) => sum + c.stats.grossCashSalesSyp, 0)
          : 0,
        commissionPaidSyp: isVerified
          ? sandboxMerchantCampaigns.reduce((sum, c) => sum + c.stats.commissionPaidSyp, 0)
          : 0,
        platformFeesPaidSyp: isVerified
          ? sandboxMerchantCampaigns.reduce((sum, c) => sum + c.stats.platformFeesPaidSyp, 0)
          : 0,
        conversionRatePercent: isVerified ? 8.06 : 0,
      },
    } as T;
  }

  if (method === 'GET' && pathname === '/merchant/wallet') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const isVerified = account.merchant?.verificationStatus === 'verified';
    return {
      availableBalanceSyp: isVerified ? sandboxMerchantAvailableSyp : 0,
      totalLockedReservesSyp: isVerified ? getSandboxLockedReservesSyp() : 0,
      creditLimitSyp: 0,
    } as T;
  }

  if (method === 'GET' && pathname === '/merchant/wallet/transactions') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const isVerified = account.merchant?.verificationStatus === 'verified';
    const allTransactions = isVerified ? sandboxMerchantTransactions : [];

    const start = (page - 1) * pageSize;
    const sliced = allTransactions.slice(start, start + pageSize);
    const total = allTransactions.length;
    const hasNext = start + pageSize < total;

    return {
      items: sliced,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: hasNext ? page + 1 : null,
    } as T;
  }

  if (method === 'GET' && pathname === '/merchant/campaigns') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const statusParam = params.get('status');
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const isVerified = account.merchant?.verificationStatus === 'verified';
    const sourceItems = isVerified ? sandboxMerchantCampaigns : [];
    const filtered =
      statusParam === 'active' || statusParam === 'ended'
        ? sourceItems.filter((item) => item.status === statusParam)
        : sourceItems;

    const start = (page - 1) * pageSize;
    const sliced = filtered.slice(start, start + pageSize);
    const total = filtered.length;
    const hasNext = start + pageSize < total;

    return {
      items: sliced,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: hasNext ? page + 1 : null,
    } as T;
  }

  const merchantCampaignDetailMatch = pathname.match(/^\/merchant\/campaigns\/([^/]+)$/);
  if (method === 'GET' && merchantCampaignDetailMatch) {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const isVerified = account.merchant?.verificationStatus === 'verified';
    const targetId = decodeURIComponent(merchantCampaignDetailMatch[1]);
    const found = isVerified
      ? sandboxMerchantCampaigns.find((item) => item.id === targetId)
      : undefined;

    if (!found) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Campaign not found.');
    }
    return found as T;
  }

  const merchantCampaignCloseMatch = pathname.match(
    /^\/merchant\/campaigns\/([^/]+)\/close$/,
  );
  if (method === 'POST' && merchantCampaignCloseMatch) {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const isVerified = account.merchant?.verificationStatus === 'verified';
    const targetId = decodeURIComponent(merchantCampaignCloseMatch[1]);
    const index = isVerified
      ? sandboxMerchantCampaigns.findIndex((item) => item.id === targetId)
      : -1;

    if (index === -1) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Campaign not found.');
    }

    const target = sandboxMerchantCampaigns[index];
    if (target.status === 'active') {
      const releasedSyp = target.usage.lockedBudgetSyp;
      target.status = 'ended';
      target.usage.lockedBudgetSyp = 0;

      if (releasedSyp > 0) {
        sandboxMerchantAvailableSyp += releasedSyp;
        sandboxMerchantTransactions.unshift({
          id: `tx-mer-close-${Date.now()}`,
          kind: 'campaign_reserve_unlock',
          amountSyp: releasedSyp,
          campaignId: target.id,
          campaignName: target.productName,
          referenceNote: 'CAMPAIGN_CLOSE_RELEASE',
          createdAt: new Date().toISOString(),
        });
      }

      const publicSeeded = SEEDED_CAMPAIGNS.find((item) => item.id === target.id);
      if (publicSeeded) {
        publicSeeded.status = 'ended';
      }
    }

    return target as T;
  }

  if (method === 'POST' && pathname === '/merchant/campaigns/preview') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    const payload = (body ?? {}) as {
      campaignType?: string;
      originalPriceSyp?: number;
      discountPercent?: number;
      commission?: { type?: string; amountSyp?: number };
      maxItems?: number;
    };

    if (
      payload.campaignType !== 'product' ||
      payload.commission?.type !== 'fixed'
    ) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Only product campaigns with fixed commission are supported.',
      );
    }

    const isVerified = account.merchant?.verificationStatus === 'verified';
    return computeSandboxProductPreview({
      originalPriceSyp: Number(payload.originalPriceSyp),
      discountPercent: Number(payload.discountPercent),
      commissionAmountSyp: Number(payload.commission?.amountSyp),
      maxItems: Number(payload.maxItems),
      availableBalanceSyp: isVerified ? sandboxMerchantAvailableSyp : 0,
    }) as T;
  }

  if (method === 'POST' && pathname === '/merchant/uploads/image') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }
    if (account.merchant?.verificationStatus !== 'verified') {
      throw new ApiClientError(
        403,
        'MERCHANT_NOT_VERIFIED',
        'A verified merchant profile is required.',
      );
    }

    if (typeof FormData === 'undefined' || !(body instanceof FormData)) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Submit exactly one valid, static image in the file field.',
      );
    }

    const rnFormData = body as {
      getParts?: () => Record<string, unknown>[];
      entries?: () => IterableIterator<[string, unknown]>;
    };

    let fieldName: string | null = null;
    let fileMimeType: string | null = null;
    let fileByteSize: number | null = null;
    let partCount = 0;
    let hasValidFileShape = false;

    if (typeof rnFormData.getParts === 'function') {
      const parts = rnFormData.getParts();
      partCount = parts.length;
      if (parts.length === 1) {
        const part = parts[0];
        fieldName = typeof part.fieldName === 'string' ? part.fieldName : null;
        const headers = part.headers as Record<string, unknown> | undefined;
        const headerMime =
          headers && typeof headers['content-type'] === 'string'
            ? headers['content-type']
            : null;
        fileMimeType =
          typeof part.type === 'string' ? part.type : headerMime;
        hasValidFileShape = typeof part.uri === 'string' && part.uri.trim().length > 0;
      }
    } else if (typeof rnFormData.entries === 'function') {
      const entries = Array.from(rnFormData.entries());
      partCount = entries.length;
      if (entries.length === 1) {
        const [entryKey, entryVal] = entries[0];
        fieldName = entryKey;
        if (entryVal && typeof entryVal === 'object') {
          const valObj = entryVal as {
            uri?: unknown;
            type?: unknown;
            size?: unknown;
          };
          fileMimeType = typeof valObj.type === 'string' ? valObj.type : null;
          fileByteSize = typeof valObj.size === 'number' ? valObj.size : null;
          hasValidFileShape =
            typeof valObj.uri === 'string' || typeof valObj.size === 'number';
        }
      }
    }

    if (partCount !== 1 || fieldName !== 'file' || !hasValidFileShape) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Submit exactly one valid, static image in the file field.',
      );
    }

    if (fileByteSize !== null && fileByteSize > 500_000) {
      throw new ApiClientError(
        413,
        'IMAGE_TOO_LARGE',
        'The image exceeds the supported size or decoded pixel limit.',
      );
    }

    const normalizedMime = (fileMimeType ?? '').toLowerCase();
    if (
      normalizedMime !== 'image/jpeg' &&
      normalizedMime !== 'image/png' &&
      normalizedMime !== 'image/webp'
    ) {
      throw new ApiClientError(
        415,
        'UNSUPPORTED_IMAGE_FORMAT',
        'Only static JPEG, PNG and WebP images are supported.',
      );
    }

    return {
      imageUrl: `https://ik.imagekit.io/mardood-dev/mardood/products/dev-${Date.now()}.webp`,
    } as T;
  }

  if (method === 'POST' && pathname === '/merchant/campaigns') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }

    if (account.merchant?.verificationStatus !== 'verified') {
      throw new ApiClientError(
        403,
        'MERCHANT_NOT_VERIFIED',
        'Merchant account is not verified.',
      );
    }

    const idempotencyKey = options?.idempotencyKey?.trim() ?? '';
    if (!UUID_36_REGEX.test(idempotencyKey)) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Valid 36-character UUID Idempotency-Key header is required.',
      );
    }

    const payload = (body ?? {}) as {
      campaignType?: string;
      productName?: string;
      description?: string;
      imageUrl?: string;
      originalPriceSyp?: number;
      discountPercent?: number;
      commission?: { type?: string; amountSyp?: number };
      maxItems?: number;
      endsAt?: string;
      joinMode?: string;
    };

    const productName = payload.productName?.trim() ?? '';
    const description = payload.description?.trim() ?? '';
    const imageUrl = payload.imageUrl?.trim() ?? '';
    const endsAtDate = payload.endsAt ? new Date(payload.endsAt) : null;

    if (
      payload.campaignType !== 'product' ||
      payload.commission?.type !== 'fixed' ||
      !productName ||
      productName.length > 120 ||
      !description ||
      description.length > 2000 ||
      !/^https?:\/\//i.test(imageUrl) ||
      imageUrl.length > 2048 ||
      !endsAtDate ||
      Number.isNaN(endsAtDate.getTime()) ||
      endsAtDate.getTime() <= Date.now()
    ) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Invalid campaign creation payload.',
      );
    }

    const normalizedFingerprint = JSON.stringify({
      campaignType: payload.campaignType,
      productName,
      description,
      imageUrl,
      originalPriceSyp: payload.originalPriceSyp,
      discountPercent: payload.discountPercent,
      commission: payload.commission,
      maxItems: payload.maxItems,
      endsAt: endsAtDate.toISOString(),
      joinMode: payload.joinMode === 'approval_required' ? 'approval_required' : 'open',
    });

    const idempotencyCacheKey = `${account.id}:${idempotencyKey.toLowerCase()}`;
    const existingLaunch = sandboxCampaignLaunchIdempotency.get(idempotencyCacheKey);
    if (existingLaunch) {
      if (existingLaunch.fingerprint !== normalizedFingerprint) {
        throw new ApiClientError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency-Key reused with different request payload.',
        );
      }
      return existingLaunch.campaign as T;
    }

    const preview = computeSandboxProductPreview({
      originalPriceSyp: Number(payload.originalPriceSyp),
      discountPercent: Number(payload.discountPercent),
      commissionAmountSyp: Number(payload.commission?.amountSyp),
      maxItems: Number(payload.maxItems),
      availableBalanceSyp: sandboxMerchantAvailableSyp,
    });

    if (!preview.isAffordableByMerchant) {
      throw new ApiClientError(
        409,
        'INSUFFICIENT_MERCHANT_BALANCE',
        'Available balance is insufficient for worst-case reserve.',
      );
    }

    sandboxMerchantAvailableSyp -= preview.worstCaseReserveSyp;

    const suffix = String(sandboxMerchantCampaigns.length + 41).padStart(12, '0');
    const createdId = `aff111a7-e000-4000-8000-${suffix}`;
    const shopName = account.merchant?.name ?? 'متجر تجريبي';
    const maxItems = Number(payload.maxItems);
    const commissionAmountSyp = Number(payload.commission?.amountSyp);

    const createdCampaign: SandboxMerchantCampaign = {
      id: createdId,
      campaignType: 'product',
      shopName,
      productName,
      description,
      imageUrl,
      originalPriceSyp: Number(payload.originalPriceSyp),
      discountPercent: Number(payload.discountPercent),
      finalPriceSyp: preview.finalPriceSyp,
      commission: { type: 'fixed', amountSyp: commissionAmountSyp },
      commissionPerItemSyp: commissionAmountSyp,
      joinMode: payload.joinMode === 'approval_required' ? 'approval_required' : 'open',
      status: 'active',
      endsAt: endsAtDate.toISOString(),
      directReferralUrl: null,
      usage: {
        maxItems,
        itemsSold: 0,
        itemsLeft: maxItems,
        maxSalesVolumeSyp: null,
        salesVolumeSyp: 0,
        salesVolumeLeftSyp: null,
        worstCaseReserveSyp: preview.worstCaseReserveSyp,
        lockedBudgetSyp: preview.worstCaseReserveSyp,
        commissionsPaidSyp: 0,
        platformFeesPaidSyp: 0,
      },
      stats: {
        clicks: 0,
        salesCount: 0,
        itemsSold: 0,
        grossCashSalesSyp: 0,
        commissionPaidSyp: 0,
        platformFeesPaidSyp: 0,
        conversionRatePercent: 0,
      },
    };

    sandboxMerchantCampaigns.unshift(createdCampaign);
    SEEDED_CAMPAIGNS.unshift({
      id: createdCampaign.id,
      campaignType: createdCampaign.campaignType,
      shopName: createdCampaign.shopName,
      productName: createdCampaign.productName,
      description: createdCampaign.description,
      imageUrl: createdCampaign.imageUrl,
      originalPriceSyp: createdCampaign.originalPriceSyp,
      discountPercent: createdCampaign.discountPercent,
      finalPriceSyp: createdCampaign.finalPriceSyp,
      commission: createdCampaign.commission,
      commissionPerItemSyp: createdCampaign.commissionPerItemSyp,
      joinMode: createdCampaign.joinMode,
      status: createdCampaign.status,
      endsAt: createdCampaign.endsAt,
    });
    sandboxMerchantTransactions.unshift({
      id: `tx-mer-lock-${Date.now()}`,
      kind: 'campaign_reserve_lock',
      amountSyp: preview.worstCaseReserveSyp,
      campaignId: createdCampaign.id,
      campaignName: createdCampaign.productName,
      referenceNote: null,
      createdAt: new Date().toISOString(),
    });
    sandboxCampaignLaunchIdempotency.set(idempotencyCacheKey, {
      fingerprint: normalizedFingerprint,
      campaign: createdCampaign,
    });

    const livePassCode = `OF-${createdId.slice(-4).toUpperCase()}`;
    const liveQrToken = `mardood-qr-${livePassCode}-${createdId.slice(-8)}-demo`;
    registerSandboxOfferPass({
      passId: `pass-${createdId.slice(-8)}`,
      code: livePassCode,
      qrToken: liveQrToken,
      campaignId: createdCampaign.id,
      customerName: 'عميل السلمية',
      status: 'active',
    });

    return createdCampaign as T;
  }

  if (method === 'POST' && pathname === '/merchant/scanner/lookup') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }
    if (account.merchant?.verificationStatus !== 'verified') {
      throw new ApiClientError(
        403,
        'MERCHANT_NOT_VERIFIED',
        'Merchant account is not verified.',
      );
    }

    const payload = (body ?? {}) as { code?: unknown };
    const code = typeof payload.code === 'string' ? payload.code.trim() : '';
    if (!SCANNER_CODE_REGEX.test(code)) {
      throw new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid scanner code.');
    }

    const pass = findSandboxOfferPass(code);
    if (!pass) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Offer code not found.');
    }

    if (pass.status === 'redeemed') {
      throw new ApiClientError(409, 'QR_ALREADY_REDEEMED', 'Offer pass already redeemed.');
    }
    if (pass.status === 'expired') {
      throw new ApiClientError(409, 'QR_EXPIRED', 'Offer pass expired.');
    }

    const campaign = sandboxMerchantCampaigns.find((item) => item.id === pass.campaignId);
    if (!campaign) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Campaign not found.');
    }

    if (
      campaign.status !== 'active' ||
      new Date(campaign.endsAt).getTime() <= Date.now() ||
      (campaign.usage.itemsLeft !== null && campaign.usage.itemsLeft <= 0)
    ) {
      throw new ApiClientError(409, 'CAMPAIGN_ENDED', 'Campaign has ended.');
    }

    const cashDue = campaign.finalPriceSyp ?? 0;

    return {
      kind: 'offer_qr',
      passId: pass.passId,
      campaignId: campaign.id,
      campaignType: campaign.campaignType,
      productName: campaign.productName,
      customerName: pass.customerName,
      discountPercent: campaign.discountPercent,
      finalPriceSyp: campaign.finalPriceSyp,
      maxQuantity: 1,
      availableQuantityOptions: [{ quantity: 1, customerPaidCashSyp: cashDue }],
      status: 'active',
    } as T;
  }

  if (method === 'POST' && pathname === '/merchant/scanner/redeem-offer') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('merchant')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Merchant role required.');
    }
    if (account.merchant?.verificationStatus !== 'verified') {
      throw new ApiClientError(
        403,
        'MERCHANT_NOT_VERIFIED',
        'Merchant account is not verified.',
      );
    }

    const idempotencyKey = options?.idempotencyKey?.trim() ?? '';
    if (!UUID_36_REGEX.test(idempotencyKey)) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Valid 36-character UUID Idempotency-Key header is required.',
      );
    }

    const payload = (body ?? {}) as {
      code?: unknown;
      quantity?: unknown;
      originalBillSyp?: unknown;
    };
    const code = typeof payload.code === 'string' ? payload.code.trim() : '';
    const quantity = payload.quantity === undefined ? 1 : payload.quantity;

    if (
      !SCANNER_CODE_REGEX.test(code) ||
      quantity !== 1 ||
      payload.originalBillSyp !== undefined
    ) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Invalid offer redemption payload.',
      );
    }

    const fingerprint = JSON.stringify({ code, quantity: 1 });
    const idempotencyCacheKey = `${account.id}:${idempotencyKey.toLowerCase()}`;
    const existingRedeem = sandboxRedeemIdempotency.get(idempotencyCacheKey);
    if (existingRedeem) {
      if (existingRedeem.fingerprint !== fingerprint) {
        throw new ApiClientError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency-Key reused with different request payload.',
        );
      }
      return existingRedeem.result as T;
    }

    const pass = findSandboxOfferPass(code);
    if (!pass) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Offer code not found.');
    }
    if (pass.status === 'redeemed') {
      throw new ApiClientError(409, 'QR_ALREADY_REDEEMED', 'Offer pass already redeemed.');
    }
    if (pass.status === 'expired') {
      throw new ApiClientError(409, 'QR_EXPIRED', 'Offer pass expired.');
    }

    const campaign = sandboxMerchantCampaigns.find((item) => item.id === pass.campaignId);
    if (!campaign) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Campaign not found.');
    }
    if (
      campaign.status !== 'active' ||
      new Date(campaign.endsAt).getTime() <= Date.now()
    ) {
      throw new ApiClientError(409, 'CAMPAIGN_ENDED', 'Campaign has ended.');
    }
    if (campaign.usage.itemsLeft !== null && campaign.usage.itemsLeft <= 0) {
      throw new ApiClientError(
        409,
        'CAMPAIGN_LIMIT_EXCEEDED',
        'Campaign sales limit reached.',
      );
    }

    const finalPrice = BigInt(campaign.finalPriceSyp ?? 0);
    const originalAmount = BigInt(
      campaign.originalPriceSyp ?? campaign.finalPriceSyp ?? 0,
    );
    const marketerCommission = BigInt(
      campaign.commission.type === 'fixed' ? campaign.commission.amountSyp : 0,
    );
    const platformTotalFee = (finalPrice * 5n) / 100n;
    const customerCashback = (finalPrice * 2n) / 100n;
    const platformNetFee = platformTotalFee - customerCashback;
    const reserveDebit = marketerCommission + platformTotalFee;

    if (BigInt(campaign.usage.lockedBudgetSyp) < reserveDebit) {
      throw new ApiClientError(
        409,
        'INSUFFICIENT_LOCKED_BUDGET',
        'Insufficient locked reserve for sale settlement.',
      );
    }

    const nowIso = new Date().toISOString();
    pass.status = 'redeemed';

    if (pass.customerId) {
      const custKey = Array.from(sandboxCustomerOfferQrByKey.keys()).find(
        (key) => sandboxCustomerOfferQrByKey.get(key)?.passId === pass.passId,
      );
      if (custKey) {
        const custPass = sandboxCustomerOfferQrByKey.get(custKey);
        if (custPass) {
          custPass.status = 'redeemed';
        }
      }

      const dashboard = getOrCreateCustomerDashboard(pass.customerId);
      const nextVerifiedCount = dashboard.verifiedPurchaseCount + 1;
      const nextMilestoneCount = dashboard.milestonePurchaseCount + 1;
      const nextMilestoneSpend = BigInt(dashboard.milestoneSpendSyp) + finalPrice;
      const nextLockedCashback = BigInt(dashboard.lockedCashbackSyp) + customerCashback;
      const unlocked =
        nextMilestoneCount >= dashboard.milestonePurchasesRequired &&
        nextMilestoneSpend >= BigInt(dashboard.milestoneSpendRequiredSyp);
      const unlockedSyp = unlocked ? nextLockedCashback : 0n;
      const nextAvailableCashback = BigInt(dashboard.availableCashbackSyp) + unlockedSyp;

      dashboard.verifiedPurchaseCount = nextVerifiedCount;
      dashboard.milestonePurchaseCount = unlocked ? 0 : nextMilestoneCount;
      dashboard.milestoneSpendSyp = unlocked ? 0 : Number(nextMilestoneSpend);
      dashboard.lockedCashbackSyp = unlocked ? 0 : Number(nextLockedCashback);
      dashboard.availableCashbackSyp = Number(nextAvailableCashback);
      dashboard.totalCashbackUnlockedSyp += Number(unlockedSyp);

      const customerAccount = getAllSandboxAccounts().find(
        (acc) => acc.id === pass.customerId,
      );
      if (customerAccount?.customer) {
        customerAccount.customer = {
          verifiedPurchaseCount: dashboard.verifiedPurchaseCount,
          availableCashbackSyp: dashboard.availableCashbackSyp,
          lockedCashbackSyp: dashboard.lockedCashbackSyp,
        };
      }

      const list = sandboxCustomerPurchasesByUserId.get(pass.customerId) ?? [];
      list.unshift({
        saleId: `sale-dev-${Date.now()}`,
        shopName: campaign.shopName,
        productName: campaign.productName,
        quantity: 1,
        customerPaidCashSyp: Number(finalPrice),
        cashbackEarnedSyp: Number(customerCashback),
        scannedAt: nowIso,
      });
      sandboxCustomerPurchasesByUserId.set(pass.customerId, list);
    }

    campaign.usage.itemsSold += 1;
    if (campaign.usage.itemsLeft !== null) {
      campaign.usage.itemsLeft = Math.max(0, campaign.usage.itemsLeft - 1);
    }
    campaign.usage.salesVolumeSyp += Number(finalPrice);
    campaign.usage.lockedBudgetSyp -= Number(reserveDebit);
    campaign.usage.commissionsPaidSyp += Number(marketerCommission);
    campaign.usage.platformFeesPaidSyp += Number(platformTotalFee);

    campaign.stats.salesCount += 1;
    campaign.stats.itemsSold += 1;
    campaign.stats.grossCashSalesSyp += Number(finalPrice);
    campaign.stats.commissionPaidSyp += Number(marketerCommission);
    campaign.stats.platformFeesPaidSyp += Number(platformTotalFee);

    sandboxMerchantTransactions.unshift({
      id: `tx-mer-sale-${Date.now()}`,
      kind: 'sale_reserve_debit',
      amountSyp: Number(reserveDebit),
      campaignId: campaign.id,
      campaignName: campaign.productName,
      referenceNote: pass.code,
      createdAt: nowIso,
    });

    if (campaign.usage.itemsLeft !== null && campaign.usage.itemsLeft <= 0) {
      const surplus = campaign.usage.lockedBudgetSyp;
      campaign.status = 'ended';
      campaign.usage.lockedBudgetSyp = 0;

      const publicSeeded = SEEDED_CAMPAIGNS.find((item) => item.id === campaign.id);
      if (publicSeeded) {
        publicSeeded.status = 'ended';
      }

      if (surplus > 0) {
        sandboxMerchantAvailableSyp += surplus;
        sandboxMerchantTransactions.unshift({
          id: `tx-mer-cap-${Date.now() + 1}`,
          kind: 'campaign_reserve_unlock',
          amountSyp: surplus,
          campaignId: campaign.id,
          campaignName: campaign.productName,
          referenceNote: 'CAMPAIGN_CAP_REACHED_RELEASE',
          createdAt: nowIso,
        });
      }
    }

    const redeemResult = {
      saleId: `sale-dev-${Date.now()}`,
      campaignId: campaign.id,
      productName: campaign.productName,
      quantity: 1,
      originalAmountSyp: Number(originalAmount),
      customerPaidCashSyp: Number(finalPrice),
      marketerCommissionSyp: Number(marketerCommission),
      platformTotalFeeSyp: Number(platformTotalFee),
      customerCashbackSyp: Number(customerCashback),
      platformNetFeeSyp: Number(platformNetFee),
      remainingLockedBudgetSyp: campaign.usage.lockedBudgetSyp,
      campaignStatusAfterSale: campaign.status,
      scannedAt: nowIso,
    };

    sandboxRedeemIdempotency.set(idempotencyCacheKey, {
      fingerprint,
      result: redeemResult,
    });

    return redeemResult as T;
  }

  const publicReferralMatch = pathname.match(/^\/public\/referrals\/([^/]+)$/);
  if (method === 'GET' && publicReferralMatch) {
    const code = decodeURIComponent(publicReferralMatch[1]).trim();
    if (!SCANNER_CODE_REGEX.test(code)) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    const referral = sandboxReferralCodes.get(code);
    if (!referral) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    const campaign = findSandboxCampaignById(referral.campaignId);
    if (!campaign || !isSandboxCampaignAvailable(campaign)) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    return {
      campaignId: campaign.id,
      campaignType: campaign.campaignType,
      shopName: campaign.shopName,
      shopDetails: referral.shopDetails,
      productName: campaign.productName,
      description: campaign.description,
      imageUrl: campaign.imageUrl,
      originalPriceSyp: campaign.originalPriceSyp,
      discountPercent: campaign.discountPercent,
      finalPriceSyp: campaign.finalPriceSyp,
      endsAt: campaign.endsAt,
      status: campaign.status,
      attributionLabel:
        referral.referringMarketerId === null
          ? 'Merchant direct'
          : 'Marketer referral',
    } as T;
  }

  const publicClickMatch = pathname.match(/^\/public\/referrals\/([^/]+)\/clicks$/);
  if (method === 'POST' && publicClickMatch) {
    requireEmptySandboxBody(body);
    const code = decodeURIComponent(publicClickMatch[1]).trim();
    if (!SCANNER_CODE_REGEX.test(code)) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    const referral = sandboxReferralCodes.get(code);
    if (!referral) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    const campaign = findSandboxCampaignById(referral.campaignId);
    if (!campaign) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }
    if (!isSandboxCampaignAvailable(campaign)) {
      throw new ApiClientError(409, 'CAMPAIGN_ENDED', 'This campaign has ended.');
    }

    const merchantCampaign = sandboxMerchantCampaigns.find(
      (item) => item.id === campaign.id,
    );
    if (merchantCampaign) {
      merchantCampaign.stats.clicks += 1;
    }

    return undefined as T;
  }

  const issueOfferQrMatch = pathname.match(/^\/customer\/referrals\/([^/]+)\/offer-qr$/);
  if (method === 'POST' && issueOfferQrMatch) {
    requireEmptySandboxBody(body);
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('customer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Customer role required.');
    }

    const code = decodeURIComponent(issueOfferQrMatch[1]).trim();
    if (!SCANNER_CODE_REGEX.test(code)) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    const referral = sandboxReferralCodes.get(code);
    if (!referral) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    const campaign = findSandboxCampaignById(referral.campaignId);
    if (!campaign) {
      throw new ApiClientError(404, 'NOT_FOUND', 'Referral offer not found.');
    }

    if (referral.referringMarketerId === account.id) {
      throw new ApiClientError(
        403,
        'SELF_PROMOTION_FORBIDDEN',
        'You cannot use your own marketer referral for a purchase.',
      );
    }

    if (!isSandboxCampaignAvailable(campaign)) {
      throw new ApiClientError(409, 'CAMPAIGN_ENDED', 'This campaign has ended.');
    }

    const cacheKey = `${account.id}:${code}`;
    const existing = sandboxCustomerOfferQrByKey.get(cacheKey);
    if (existing && existing.status === 'active') {
      return existing as T;
    }

    const serial = sandboxOfferPasses.size + 1;
    const canReuseDemoPass =
      code === 'mk-demo01' &&
      account.id === DEMO_SCANNER_CUSTOMER_ACCOUNT.id &&
      sandboxOfferPasses.get('OF-DEMO01')?.status !== 'redeemed';
    const passCode = canReuseDemoPass
      ? 'OF-DEMO01'
      : `OF-${String(serial).padStart(4, '0')}`;
    const passId =
      passCode === 'OF-DEMO01'
        ? 'aff111a7-e000-4000-8000-000000000042'
        : `pass-cust-${String(serial).padStart(4, '0')}-${Date.now()}`;
    const qrToken = `mardood-qr-${passCode}-${campaign.id.slice(-8)}-${account.id.slice(-6)}`;

    const createdPass: SandboxCustomerOfferQrPass = {
      passId,
      campaignId: campaign.id,
      campaignType: campaign.campaignType,
      productName: campaign.productName,
      shopName: campaign.shopName,
      discountPercent: campaign.discountPercent,
      finalPriceSyp: campaign.finalPriceSyp,
      qrToken,
      passCode,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    sandboxCustomerOfferQrByKey.set(cacheKey, createdPass);
    registerSandboxOfferPass({
      passId,
      code: passCode,
      qrToken,
      campaignId: campaign.id,
      customerId: account.id,
      customerName: account.name,
      status: 'active',
    });

    return createdPass as T;
  }

  if (method === 'GET' && pathname === '/customer/dashboard') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('customer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Customer role required.');
    }

    return getOrCreateCustomerDashboard(account.id) as T;
  }

  if (method === 'GET' && pathname === '/customer/purchases') {
    const account = await requireAuthenticatedAccount();
    if (!account.roles.includes('customer')) {
      throw new ApiClientError(403, 'FORBIDDEN', 'Customer role required.');
    }

    const [, queryString = ''] = path.split('?');
    const params = new URLSearchParams(queryString);
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(100, parsedPageSize)
        : 20;

    const allPurchases = sandboxCustomerPurchasesByUserId.get(account.id) ?? [];
    const start = (page - 1) * pageSize;
    const sliced = allPurchases.slice(start, start + pageSize);
    const total = allPurchases.length;
    const hasNext = start + pageSize < total;

    return {
      items: sliced,
      page,
      pageSize,
      total,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: hasNext ? page + 1 : null,
    } as T;
  }

  throw new ApiClientError(404, 'NOT_FOUND', 'Unknown sandbox route.');
}

export function incrementSandboxWalletForDevTest(deltaSyp: number): void {
  if (env.useDevSandbox) {
    const walletState = getOrCreateMarketerWalletState(DEMO_MARKETER_ACCOUNT.id);
    walletState.availableBalanceSyp += deltaSyp;
    walletState.totalEarnedSyp += deltaSyp;
  }
}
