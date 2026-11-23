"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { signIn } from "@/app/actions";

import { CustomerPasswordField, customerFieldFocus } from "./customer-password-field";

export function SignInForm({ returnTo = "/customer" }: { returnTo?: string }) {
  const phoneId = useId();
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
    <>
      <form action={submit} aria-busy={pending} className="grid gap-4">
        <div className="grid gap-1">
          <label htmlFor={phoneId}>رقم الجوال</label>
          <input
            ref={phoneInput} id={phoneId} name="phone" type="tel" autoComplete="username" dir="ltr"
            inputMode="tel" maxLength={10} required value={phone}
            className={customerFieldFocus}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(state.phoneError)}
            aria-describedby={state.phoneError ? `${phoneId}-error` : `${phoneId}-hint`}
          />
          {state.phoneError
            ? <p id={`${phoneId}-error`} className="text-sm leading-6 text-danger">{state.phoneError}</p>
            : <p id={`${phoneId}-hint`} className="text-sm leading-6 text-muted">رقم سوري من ١٠ أرقام. مثال <bdi dir="ltr">09XXXXXXXX</bdi></p>}
        </div>
        <CustomerPasswordField inputRef={passwordInput} autoComplete="current-password" error={state.passwordError} />
        {state.error && <p ref={formError} tabIndex={-1} role="alert" className="notice-error">{state.error}</p>}
        <button type="submit" className="button-primary w-full" disabled={pending}>
          {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
        </button>
      </form>
      <span className="sr-only" role="status">{pending ? "جارٍ تسجيل الدخول…" : ""}</span>
    </>
  );
}
