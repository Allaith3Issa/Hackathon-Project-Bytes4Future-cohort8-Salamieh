"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState, useEffect, useId, useRef } from "react";
import { staffSignIn } from "@/app/staff-actions";
import { Field } from "./field";
import { fieldClass } from "@/lib/staff-ui";

export function StaffSignIn({ kind }: { kind: "admin" | "merchant" }) {
  const { t } = useI18n();
  const phoneId = useId();
  const passwordId = useId();
  const [state, submit, pending] = useActionState(staffSignIn.bind(null, kind), {});
  const phone = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const formError = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.phoneError) phone.current?.focus();
    else if (state.passwordError) password.current?.focus();
    else if (state.error) formError.current?.focus();
  }, [state]);
  return (
    <form action={submit} aria-busy={pending} className="grid gap-4">
      <Field id={phoneId} label={t("auth.phoneNumber")} error={state.phoneError} hint={t("auth.a10DigitSyrianPhoneNumber")}>
        <input ref={phone} id={phoneId} name="phone" type="tel" dir="ltr" inputMode="tel" maxLength={10} required
          autoComplete="username" aria-invalid={Boolean(state.phoneError)}
          aria-describedby={`${phoneId}-${state.phoneError ? "error" : "hint"}`} className={fieldClass} />
      </Field>
      <Field id={passwordId} label={t("auth.password")} error={state.passwordError}>
        <input ref={password} id={passwordId} name="password" type="password" required autoComplete="current-password"
          aria-invalid={Boolean(state.passwordError)} aria-describedby={state.passwordError ? `${passwordId}-error` : undefined}
          className={fieldClass} />
      </Field>
      {state.error && <p ref={formError} tabIndex={-1} role="alert" className="notice-error">{state.error}</p>}
      <button type="submit" className="button-primary w-full" disabled={pending}>
        {pending ? t("auth.signingIn") : t("common.signIn")}
      </button>
    </form>
  );
}
