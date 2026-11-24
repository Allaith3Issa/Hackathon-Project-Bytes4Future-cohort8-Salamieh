import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { isLocaleRtl, syncNativeDirection } from '../rtl/direction';
import { ar } from './ar';
import { en } from './en';
import type { AppLocale, TranslationDictionary } from './types';

const LOCALE_STORAGE_KEY = 'alsalamiyah_app_locale';
const DEFAULT_LOCALE: AppLocale = 'ar';

const DICTIONARIES: Record<AppLocale, TranslationDictionary> = {
  ar,
  en,
};

interface LocaleContextValue {
  locale: AppLocale;
  isRtl: boolean;
  isLocaleReady: boolean;
  t: TranslationDictionary;
  setLocale: (nextLocale: AppLocale) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isAppLocale(value: string | null): value is AppLocale {
  return value === 'ar' || value === 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [isLocaleReady, setIsLocaleReady] = useState(false);
  const localeEpochRef = useRef(0);

  useEffect(() => {
    let active = true;
    const bootEpoch = localeEpochRef.current;

    async function hydrateLocale() {
      let resolvedLocale: AppLocale = DEFAULT_LOCALE;
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        if (isAppLocale(stored)) {
          resolvedLocale = stored;
        }
      } catch {
        resolvedLocale = DEFAULT_LOCALE;
      }

      if (!active || localeEpochRef.current !== bootEpoch) {
        if (active) {
          setIsLocaleReady(true);
        }
        return;
      }

      syncNativeDirection(resolvedLocale);
      setLocaleState(resolvedLocale);
      setIsLocaleReady(true);
    }

    void hydrateLocale();

    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: AppLocale) => {
    localeEpochRef.current += 1;
    syncNativeDirection(nextLocale);
    setLocaleState(nextLocale);
    setIsLocaleReady(true);
    try {
      await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Non-sensitive preference persistence failure should not block UI state.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isRtl: isLocaleRtl(locale),
      isLocaleReady,
      t: DICTIONARIES[locale],
      setLocale,
    }),
    [locale, isLocaleReady, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return context;
}

export function getDictionary(locale: AppLocale): TranslationDictionary {
  return DICTIONARIES[locale];
}
