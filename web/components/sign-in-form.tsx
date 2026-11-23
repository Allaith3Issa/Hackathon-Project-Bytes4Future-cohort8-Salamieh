"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { signIn } from "@/app/actions";

export function SignInForm({ returnTo = "/customer" }: { returnTo?: string }) {
  const phoneId = useId();
  const passwordId = useId();
  const [phone, setPhone] = useState("");
  const [state, submit, pending] = useActionState(signIn.bind(null, returnTo), {});
  const phoneInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const formError = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.phoneError) phoneInput.current?.focus();
    else if (state.passwordError) passwordInput.current?.focus();
    else if (state.error) formError.current?.focus();
  }, [state]);

  return (
    <form action={submit} aria-busy={pending} className="grid gap-4">
      <div className="grid gap-1">
        <label htmlFor={phoneId}>رقم الجوال</label>
        <input
          ref={phoneInput} id={phoneId} name="phone" type="tel" autoComplete="username" dir="ltr"
          inputMode="tel" maxLength={10} required value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={Boolean(state.phoneError)}
          aria-describedby={state.phoneError ? `${phoneId}-error` : `${phoneId}-hint`}
        />
        {state.phoneError
          ? <p id={`${phoneId}-error`} className="text-sm text-danger">{state.phoneError}</p>
          : <p id={`${phoneId}-hint`} className="text-sm text-muted">رقم سوري من ١٠ أرقام يبدأ بـ <bdi dir="ltr">09</bdi>.</p>}
      </div>
      <div className="grid gap-1">
        <label htmlFor={passwordId}>كلمة المرور</label>
        <input
          ref={passwordInput} id={passwordId} name="password" type="password" autoComplete="current-password" required
          aria-invalid={Boolean(state.passwordError)}
          aria-describedby={state.passwordError ? `${passwordId}-error` : undefined}
        />
        {state.passwordError && <p id={`${passwordId}-error`} className="text-sm text-danger">{state.passwordError}</p>}
      </div>
      {state.error && <p ref={formError} tabIndex={-1} role="alert" className="notice-error">{state.error}</p>}
      <button type="submit" className="button-primary w-full" disabled={pending}>
        {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
