export type Role = 'admin' | 'customer' | 'marketer' | 'merchant';
export type MobileWorkspaceRole = 'customer' | 'marketer' | 'merchant';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Account {
  id: string;
  name: string;
  phone: string;
  roles: Role[];
  createdAt: string;
  merchant: {
    name: string;
    details: string;
    verificationStatus: VerificationStatus;
    contractReference: string | null;
  } | null;
  customer: {
    verifiedPurchaseCount: number;
    availableCashbackSyp: number;
    lockedCashbackSyp: number;
  } | null;
}

export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  user: Account;
}

export function hasCustomerRole(account: Pick<Account, 'roles'> | null | undefined): boolean {
  return Boolean(account?.roles.includes('customer'));
}

export function hasMarketerRole(account: Pick<Account, 'roles'> | null | undefined): boolean {
  return Boolean(account?.roles.includes('marketer'));
}

export function hasMerchantRole(account: Pick<Account, 'roles'> | null | undefined): boolean {
  return Boolean(account?.roles.includes('merchant'));
}

export function getAvailableMobileRoles(
  account: Pick<Account, 'roles'> | null | undefined,
): MobileWorkspaceRole[] {
  if (!account) {
    return [];
  }
  const roles: MobileWorkspaceRole[] = [];
  if (account.roles.includes('customer')) {
    roles.push('customer');
  }
  if (account.roles.includes('marketer')) {
    roles.push('marketer');
  }
  if (account.roles.includes('merchant')) {
    roles.push('merchant');
  }
  return roles;
}

export function hasSupportedMobileRole(
  account: Pick<Account, 'roles'> | null | undefined,
): boolean {
  return (
    hasCustomerRole(account) ||
    hasMarketerRole(account) ||
    hasMerchantRole(account)
  );
}
