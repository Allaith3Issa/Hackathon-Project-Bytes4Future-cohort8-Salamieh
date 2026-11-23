import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import type { Locale } from "./locale";

type Dictionary = typeof ar;
type Namespace = keyof Dictionary;
export type MessageKey = {
  [N in Namespace]: `${N}.${Extract<keyof Dictionary[N], string>}`;
}[Namespace];
const messages: Record<Locale, Dictionary> = { ar, en };
type Values = Record<string, string | number>;
export type Translate = (key: MessageKey, values?: Values) => string;

function makeI18n(locale: Locale) {
  const formats = locale === "ar" ? "ar-SY" : "en";
  const number = new Intl.NumberFormat(formats);
  const syp = new Intl.NumberFormat(formats, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(formats, { dateStyle: "medium", timeZone: "Asia/Damascus" });
  const percent = new Intl.NumberFormat(formats, { style: "percent", maximumFractionDigits: 2 });
  const t: Translate = (key, values) => {
    const dot = key.indexOf(".");
    const namespace = key.slice(0, dot) as Namespace;
    const group: Record<string, string> = messages[locale][namespace];
    return group[key.slice(dot + 1)].replace(/\{(\w+)\}/g, (match, key) => String(values?.[key] ?? match));
  };
  return {
    locale, t,
    formatNumber: (value: number) => number.format(value),
    formatDate: (value: string) => date.format(new Date(value)),
    formatPercent: (value: number) => percent.format(value / 100),
    formatSyp: (minor: number) => {
      const digits = String(Math.abs(minor)).padStart(3, "0");
      const amount = `${minor < 0 ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}` as `${number}`;
      return `${syp.format(amount)} ${locale === "ar" ? "ل.س." : "SYP"}`;
    },
  };
}

const locales = { ar: makeI18n("ar"), en: makeI18n("en") };
export const getI18nFor = (locale: Locale) => locales[locale];
