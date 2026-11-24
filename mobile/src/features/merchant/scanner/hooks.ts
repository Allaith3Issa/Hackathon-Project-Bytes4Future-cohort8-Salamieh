import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createIdempotencyKey,
  isApiClientError,
  mapApiErrorToMessage,
} from '@/core/api';
import { useAuth } from '@/core/auth';
import { swrCache } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import { getMerchantDashboardCacheKey } from '../dashboard';
import { lookupOfferCode, redeemOfferCode } from './api';
import { normalizeScannerCode } from './types';
import type {
  MerchantScannerSource,
  MerchantScannerStatus,
  OfferRedeemResult,
  ScannerOfferLookupResult,
} from './types';

const CAMERA_DUPLICATE_COOLDOWN_MS = 1800;

export function invalidateMerchantPostRedeemCaches(userId: string): void {
  swrCache.markStalePrefix(`${userId}:merchant:wallet:`);
  swrCache.markStale(getMerchantDashboardCacheKey(userId));
  swrCache.markStalePrefix(`${userId}:merchant:campaigns:`);
}

export function useMerchantScanner() {
  const { user, activeRole } = useAuth();
  const { locale, t } = useLocale();

  const [status, setStatus] = useState<MerchantScannerStatus>('idle');
  const [manualCode, setManualCode] = useState('');
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<MerchantScannerSource | null>(null);
  const [lookupResult, setLookupResult] = useState<ScannerOfferLookupResult | null>(null);
  const [redeemResult, setRedeemResult] = useState<OfferRedeemResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusRef = useRef<MerchantScannerStatus>('idle');
  const activeCodeRef = useRef<string | null>(null);
  const lookupResultRef = useRef<ScannerOfferLookupResult | null>(null);
  const inFlightKeysRef = useRef<Set<string>>(new Set());
  const idempotencySlotRef = useRef<{ code: string; key: string } | null>(null);
  const requestSeqRef = useRef(0);
  const lastCameraScanRef = useRef<{ raw: string; at: number } | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    activeCodeRef.current = activeCode;
  }, [activeCode]);

  useEffect(() => {
    lookupResultRef.current = lookupResult;
  }, [lookupResult]);

  const setManualCodeInput = useCallback((value: string) => {
    setManualCode(value);
    if (statusRef.current === 'error' && !lookupResultRef.current) {
      setErrorMessage(null);
      statusRef.current = 'idle';
      setStatus('idle');
    }
  }, []);

  const resetScanner = useCallback(() => {
    requestSeqRef.current += 1;
    inFlightKeysRef.current.clear();
    idempotencySlotRef.current = null;
    lastCameraScanRef.current = null;
    statusRef.current = 'idle';
    activeCodeRef.current = null;
    lookupResultRef.current = null;

    setStatus('idle');
    setManualCode('');
    setActiveCode(null);
    setActiveSource(null);
    setLookupResult(null);
    setRedeemResult(null);
    setErrorMessage(null);
  }, []);

  const lookupCode = useCallback(
    async (
      rawCode: string,
      source: MerchantScannerSource = 'manual',
    ): Promise<boolean> => {
      if (!user || activeRole !== 'merchant') {
        return false;
      }

      if (
        statusRef.current === 'looking_up' ||
        statusRef.current === 'redeeming'
      ) {
        return false;
      }

      if (source === 'camera') {
        if (
          statusRef.current === 'preview_ready' ||
          statusRef.current === 'redeemed'
        ) {
          return false;
        }

        const now = Date.now();
        const lastScan = lastCameraScanRef.current;
        if (
          lastScan &&
          lastScan.raw === rawCode &&
          now - lastScan.at < CAMERA_DUPLICATE_COOLDOWN_MS
        ) {
          return false;
        }
        lastCameraScanRef.current = { raw: rawCode, at: now };
      }

      const normalized = normalizeScannerCode(rawCode);
      if (!normalized) {
        statusRef.current = 'error';
        activeCodeRef.current = null;
        lookupResultRef.current = null;
        setStatus('error');
        setActiveCode(null);
        setActiveSource(source);
        setLookupResult(null);
        setRedeemResult(null);
        setErrorMessage(t.merchant.scanner.invalidCodeError);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return false;
      }

      const lookupLockKey = `lookup:${normalized}`;
      if (inFlightKeysRef.current.has(lookupLockKey)) {
        return false;
      }

      if (
        statusRef.current === 'redeemed' ||
        idempotencySlotRef.current?.code !== normalized
      ) {
        idempotencySlotRef.current = {
          code: normalized,
          key: createIdempotencyKey(),
        };
      }

      const requestId = ++requestSeqRef.current;
      inFlightKeysRef.current.add(lookupLockKey);
      statusRef.current = 'looking_up';
      activeCodeRef.current = normalized;
      lookupResultRef.current = null;

      setStatus('looking_up');
      setManualCode(normalized);
      setActiveCode(normalized);
      setActiveSource(source);
      setLookupResult(null);
      setRedeemResult(null);
      setErrorMessage(null);

      try {
        const result = await lookupOfferCode(normalized);
        if (requestSeqRef.current !== requestId) {
          return false;
        }

        if (result.kind !== 'offer_qr') {
          statusRef.current = 'error';
          setStatus('error');
          setErrorMessage(t.merchant.scanner.unsupportedVoucherNotice);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
            () => undefined,
          );
          return false;
        }

        statusRef.current = 'preview_ready';
        lookupResultRef.current = result;
        setLookupResult(result);
        setStatus('preview_ready');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined,
        );
        return true;
      } catch (err) {
        if (requestSeqRef.current !== requestId) {
          return false;
        }
        statusRef.current = 'error';
        setStatus('error');
        setErrorMessage(mapApiErrorToMessage(err, locale));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return false;
      } finally {
        inFlightKeysRef.current.delete(lookupLockKey);
      }
    },
    [
      activeRole,
      locale,
      t.merchant.scanner.invalidCodeError,
      t.merchant.scanner.unsupportedVoucherNotice,
      user,
    ],
  );

  const confirmRedeem = useCallback(async (): Promise<boolean> => {
    const code = activeCodeRef.current;
    if (!user || activeRole !== 'merchant' || !code || !lookupResultRef.current) {
      return false;
    }

    if (
      statusRef.current !== 'preview_ready' &&
      statusRef.current !== 'error'
    ) {
      return false;
    }

    const redeemLockKey = `redeem:${code}`;
    if (inFlightKeysRef.current.has(redeemLockKey)) {
      return false;
    }

    const existingSlot = idempotencySlotRef.current;
    const idempotencyKey =
      existingSlot && existingSlot.code === code
        ? existingSlot.key
        : createIdempotencyKey();
    idempotencySlotRef.current = { code, key: idempotencyKey };

    const requestId = ++requestSeqRef.current;
    inFlightKeysRef.current.add(redeemLockKey);
    statusRef.current = 'redeeming';
    setStatus('redeeming');
    setErrorMessage(null);

    try {
      const result = await redeemOfferCode(code, idempotencyKey);
      if (requestSeqRef.current !== requestId) {
        return false;
      }

      statusRef.current = 'redeemed';
      setRedeemResult(result);
      setManualCode('');
      setStatus('redeemed');

      invalidateMerchantPostRedeemCaches(user.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      return true;
    } catch (err) {
      if (requestSeqRef.current !== requestId) {
        return false;
      }

      if (isApiClientError(err) && err.code === 'IDEMPOTENCY_KEY_REUSED') {
        idempotencySlotRef.current = {
          code,
          key: createIdempotencyKey(),
        };
      }

      statusRef.current = 'error';
      setStatus('error');
      setErrorMessage(mapApiErrorToMessage(err, locale));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    } finally {
      inFlightKeysRef.current.delete(redeemLockKey);
    }
  }, [activeRole, locale, user]);

  return {
    status,
    manualCode,
    activeCode,
    activeSource,
    lookupResult,
    redeemResult,
    errorMessage,
    isBusy: status === 'looking_up' || status === 'redeeming',
    setManualCodeInput,
    lookupCode,
    confirmRedeem,
    resetScanner,
  };
}
