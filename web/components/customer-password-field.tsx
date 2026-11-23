"use client";

import { useId, useState, type Ref } from "react";

export const customerFieldFocus = "focus-visible:outline-offset-1 aria-invalid:bg-danger/5 aria-invalid:focus-visible:outline-danger";

interface CustomerPasswordFieldProps {
  inputRef: Ref<HTMLInputElement>;
  name?: string;
  label?: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
}

export function CustomerPasswordField({ inputRef, name = "password", label = "كلمة المرور", autoComplete, error }: CustomerPasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggle = visible ? "إخفاء" : "إظهار";

  return (
    <div className="grid gap-1">
      <label htmlFor={id}>{label}</label>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <input
          ref={inputRef} id={id} name={name} type={visible ? "text" : "password"}
          autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} required
          className={`${customerFieldFocus} [&::-ms-reveal]:hidden`}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button" aria-controls={id} aria-label={`${toggle} ${label}`}
          onClick={() => setVisible((shown) => !shown)} data-visible={visible}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dusty-mauve bg-mauve text-sm font-semibold text-ink hover:border-ink focus-visible:outline-offset-1 data-[visible=true]:border-ink data-[visible=true]:bg-ink data-[visible=true]:text-white"
        >
          <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {visible
              ? <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.3A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.5 17.5 0 0 1-3.2 3.8M6.2 6.2C3.5 8.3 2 12 2 12s4 7 10 7a9.5 9.5 0 0 0 4.1-.9" />
              : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></>}
          </svg>
          {toggle}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-sm leading-6 text-danger">{error}</p>}
    </div>
  );
}
