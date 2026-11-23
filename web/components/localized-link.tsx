"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "./i18n-provider";
import { localizedPath } from "@/lib/locale";

export default function LocalizedLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { locale } = useI18n();
  return <Link {...props} href={typeof href === "string" ? localizedPath(href, locale) : href} />;
}
