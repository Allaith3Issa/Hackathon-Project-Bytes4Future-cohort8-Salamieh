/**
 * Dev-only quick-login demo credentials, strictly isolated under src/core/dev/
 * so production builds tree-shake them out via __DEV__ guards.
 */
export const DEV_SANDBOX_CREDENTIALS = {
  marketer: {
    phone: '0999100003',
    password: 'dev-sandbox-marketer',
  },
  customer: {
    phone: '0999100004',
    password: 'dev-sandbox-customer',
  },
  merchant: {
    phone: '0999100002',
    password: 'dev-sandbox-merchant',
  },
} as const;
