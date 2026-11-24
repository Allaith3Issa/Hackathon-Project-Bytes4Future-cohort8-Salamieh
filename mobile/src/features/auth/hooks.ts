import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';

import { extractFieldErrors, mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { env } from '@/core/config';
import { useLocale } from '@/core/i18n';
import { fetchCurrentAccount, loginWithPassword, registerAccount } from './api';
import { hasSupportedMobileRole } from './types';
import type {
  Account,
  LoginFieldErrors,
  MobileWorkspaceRole,
  RegisterFieldErrors,
} from './types';
import {
  normalizePhoneInput,
  validateLoginInput,
  validateRegisterInput,
} from './validation';

type DevModule = typeof import('@/core/dev');
type LoginOperation = 'login' | 'sandbox' | 'sandbox-customer' | 'sandbox-merchant';

export function useLoginForm() {
  const { locale, t } = useLocale();
  const { establishSession, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();

  const [phone, setPhoneState] = useState('');
  const [password, setPasswordState] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<LoginOperation | null>(null);

  // Deduplicates concurrent submissions per AGENTS.md Set<string> discipline.
  const inFlightOpsRef = useRef(new Set<string>());

  const setPhone = useCallback((nextPhone: string) => {
    setPhoneState(nextPhone);
    setFieldErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
    setFormError(null);
  }, []);

  const setPassword = useCallback((nextPassword: string) => {
    setPasswordState(nextPassword);
    setFieldErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
    setFormError(null);
  }, []);

  const performLogin = useCallback(
    async (
      operationKey: LoginOperation,
      normalizedPhone: string,
      secret: string,
    ): Promise<boolean> => {
      if (inFlightOpsRef.current.size > 0) {
        return false;
      }

      inFlightOpsRef.current.add(operationKey);
      setActiveOperation(operationKey);
      setFormError(null);

      try {
        const session = await loginWithPassword({
          phone: normalizedPhone,
          password: secret,
        });

        if (!hasSupportedMobileRole(session.user)) {
          setFormError(t.auth.unsupportedRoleError);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
            () => undefined,
          );
          return false;
        }

        const established = await establishSession(session);
        if (!established) {
          setFormError(t.auth.unsupportedRoleError);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
            () => undefined,
          );
          return false;
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        return true;
      } catch (error: unknown) {
        const serverFields = extractFieldErrors(error);
        const mappedPhoneError = serverFields.phone?.[0];
        const mappedPasswordError = serverFields.password?.[0];

        if (mappedPhoneError || mappedPasswordError) {
          setFieldErrors({
            phone: mappedPhoneError,
            password: mappedPasswordError,
          });
        }

        setFormError(mapApiErrorToMessage(error, locale));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return false;
      } finally {
        inFlightOpsRef.current.delete(operationKey);
        setActiveOperation(null);
      }
    },
    [establishSession, locale, t.auth.unsupportedRoleError],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (inFlightOpsRef.current.size > 0) {
      return false;
    }

    clearSessionExpiredNotice();
    const validation = validateLoginInput(phone, password, t);

    if (validation.normalizedPhone !== phone) {
      setPhoneState(validation.normalizedPhone);
    }

    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setFormError(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    }

    setFieldErrors({});
    return performLogin('login', normalizePhoneInput(validation.normalizedPhone), password);
  }, [clearSessionExpiredNotice, password, performLogin, phone, t]);

  const submitDevSandbox = useCallback(async (): Promise<boolean> => {
    if (!__DEV__ || !env.useDevSandbox || inFlightOpsRef.current.size > 0) {
      return false;
    }
    const { DEV_SANDBOX_CREDENTIALS } = require('@/core/dev') as DevModule;
    clearSessionExpiredNotice();
    setFieldErrors({});
    return performLogin(
      'sandbox',
      DEV_SANDBOX_CREDENTIALS.marketer.phone,
      DEV_SANDBOX_CREDENTIALS.marketer.password,
    );
  }, [clearSessionExpiredNotice, performLogin]);

  const submitDevCustomerSandbox = useCallback(async (): Promise<boolean> => {
    if (!__DEV__ || !env.useDevSandbox || inFlightOpsRef.current.size > 0) {
      return false;
    }
    const { DEV_SANDBOX_CREDENTIALS } = require('@/core/dev') as DevModule;
    clearSessionExpiredNotice();
    setFieldErrors({});
    return performLogin(
      'sandbox-customer',
      DEV_SANDBOX_CREDENTIALS.customer.phone,
      DEV_SANDBOX_CREDENTIALS.customer.password,
    );
  }, [clearSessionExpiredNotice, performLogin]);

  const submitDevMerchantSandbox = useCallback(async (): Promise<boolean> => {
    if (!__DEV__ || !env.useDevSandbox || inFlightOpsRef.current.size > 0) {
      return false;
    }
    const { DEV_SANDBOX_CREDENTIALS } = require('@/core/dev') as DevModule;
    clearSessionExpiredNotice();
    setFieldErrors({});
    return performLogin(
      'sandbox-merchant',
      DEV_SANDBOX_CREDENTIALS.merchant.phone,
      DEV_SANDBOX_CREDENTIALS.merchant.password,
    );
  }, [clearSessionExpiredNotice, performLogin]);

  return {
    phone,
    password,
    setPhone,
    setPassword,
    fieldErrors,
    formError,
    isSubmitting: activeOperation === 'login',
    isSandboxSubmitting: activeOperation === 'sandbox',
    isCustomerSandboxSubmitting: activeOperation === 'sandbox-customer',
    isMerchantSandboxSubmitting: activeOperation === 'sandbox-merchant',
    isAnySubmitting: activeOperation !== null,
    sessionExpiredNotice,
    submit,
    submitDevSandbox,
    submitDevCustomerSandbox,
    submitDevMerchantSandbox,
  };
}

export function useRegisterForm() {
  const { locale, t } = useLocale();
  const { establishSession, clearSessionExpiredNotice } = useAuth();

  const [name, setNameState] = useState('');
  const [phone, setPhoneState] = useState('');
  const [password, setPasswordState] = useState('');
  const [roles, setRolesState] = useState<MobileWorkspaceRole[]>(['marketer']);
  const [shopName, setShopNameState] = useState('');
  const [shopDetails, setShopDetailsState] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inFlightRef = useRef(false);

  const setName = useCallback((nextName: string) => {
    setNameState(nextName);
    setFieldErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
    setFormError(null);
  }, []);

  const setPhone = useCallback((nextPhone: string) => {
    setPhoneState(nextPhone);
    setFieldErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
    setFormError(null);
  }, []);

  const setPassword = useCallback((nextPassword: string) => {
    setPasswordState(nextPassword);
    setFieldErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
    setFormError(null);
  }, []);

  const setShopName = useCallback((nextShopName: string) => {
    setShopNameState(nextShopName);
    setFieldErrors((prev) => (prev.shopName ? { ...prev, shopName: undefined } : prev));
    setFormError(null);
  }, []);

  const setShopDetails = useCallback((nextShopDetails: string) => {
    setShopDetailsState(nextShopDetails);
    setFieldErrors((prev) =>
      prev.shopDetails ? { ...prev, shopDetails: undefined } : prev,
    );
    setFormError(null);
  }, []);

  const toggleRole = useCallback(
    (role: MobileWorkspaceRole) => {
      const nextRoles = roles.includes(role)
        ? roles.filter((item) => item !== role)
        : [...roles, role];

      setRolesState(nextRoles);
      setFieldErrors((prevErrors) => {
        const nextErrors: RegisterFieldErrors = {
          ...prevErrors,
          roles: undefined,
        };
        if (!nextRoles.includes('merchant')) {
          nextErrors.shopName = undefined;
          nextErrors.shopDetails = undefined;
        }
        return nextErrors;
      });
      setFormError(null);
    },
    [roles],
  );

  const includesCustomer = roles.includes('customer');
  const includesMerchant = roles.includes('merchant');
  const includesMarketer = roles.includes('marketer');

  const submit = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) {
      return false;
    }

    clearSessionExpiredNotice();
    const validation = validateRegisterInput(
      {
        name,
        phone,
        password,
        roles,
        shopName,
        shopDetails,
      },
      t,
    );

    if (validation.normalizedPhone !== phone) {
      setPhoneState(validation.normalizedPhone);
    }

    if (!validation.isValid || !validation.payload) {
      setFieldErrors(validation.fieldErrors);
      setFormError(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const session = await registerAccount(validation.payload);

      if (!hasSupportedMobileRole(session.user)) {
        setFormError(t.auth.unsupportedRoleError);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return false;
      }

      const established = await establishSession(session);
      if (!established) {
        setFormError(t.auth.unsupportedRoleError);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return false;
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      return true;
    } catch (error: unknown) {
      const serverFields = extractFieldErrors(error);
      const mappedErrors: RegisterFieldErrors = {
        name: serverFields.name?.[0],
        phone: serverFields.phone?.[0],
        password: serverFields.password?.[0],
        roles: serverFields.roles?.[0],
        shopName: serverFields['shop.name']?.[0] ?? serverFields.shopName?.[0],
        shopDetails:
          serverFields['shop.details']?.[0] ?? serverFields.shopDetails?.[0],
      };

      if (Object.values(mappedErrors).some(Boolean)) {
        setFieldErrors(mappedErrors);
      }

      setFormError(mapApiErrorToMessage(error, locale));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    clearSessionExpiredNotice,
    establishSession,
    locale,
    name,
    password,
    phone,
    roles,
    shopDetails,
    shopName,
    t,
  ]);

  return {
    name,
    phone,
    password,
    roles,
    includesCustomer,
    includesMarketer,
    includesMerchant,
    shopName,
    shopDetails,
    setName,
    setPhone,
    setPassword,
    toggleRole,
    setShopName,
    setShopDetails,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
  };
}

export function useSignOut() {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const inFlightRef = useRef(false);

  const handleSignOut = useCallback(async () => {
    if (inFlightRef.current) {
      return { serverLogoutFailed: false };
    }
    inFlightRef.current = true;
    setIsSigningOut(true);
    try {
      return await signOut();
    } finally {
      inFlightRef.current = false;
      setIsSigningOut(false);
    }
  }, [signOut]);

  return {
    isSigningOut,
    signOut: handleSignOut,
  };
}

export function useAccountRefresh() {
  const { locale } = useLocale();
  const { syncAccount } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refreshAccount = useCallback(async (): Promise<Account | null> => {
    if (inFlightRef.current) {
      return null;
    }
    inFlightRef.current = true;
    setIsRefreshing(true);
    setError(null);
    try {
      const fresh = await fetchCurrentAccount();
      syncAccount(fresh);
      return fresh;
    } catch (err: unknown) {
      setError(mapApiErrorToMessage(err, locale));
      return null;
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [locale, syncAccount]);

  return {
    isRefreshing,
    error,
    refreshAccount,
  };
}
