"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getI18nFor } from "@/lib/i18n";
import { defaultLocale, type Locale } from "@/lib/locale";

const LocaleContext = createContext<Locale>(defaultLocale);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useI18n = () => getI18nFor(useContext(LocaleContext));
