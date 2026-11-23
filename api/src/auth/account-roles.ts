import type { Role } from './auth-session.dto';

export function accountRoles(record: {
  isAdmin: boolean;
  isCustomer: boolean;
  isMarketer: boolean;
  merchantProfile: object | null;
}): Role[] {
  const roles: Role[] = [];
  if (record.isAdmin) roles.push('admin');
  if (record.isCustomer) roles.push('customer');
  if (record.isMarketer) roles.push('marketer');
  if (record.merchantProfile) roles.push('merchant');
  return roles;
}
