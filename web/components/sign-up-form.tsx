"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "@/components/localized-link";
import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { signUp } from "@/app/register/actions";
import { DEFAULT_ROLES, validateRegistration, type RegistrationErrors, type RegistrationRole } from "@/lib/registration";
import { CustomerAuthCard } from "./customer-auth-card";
import { CustomerPasswordField, customerFieldFocus } from "./customer-password-field";
import { Field } from "./field";
import { RegistrationRoleBadges, RegistrationRoleCards } from "./registration-roles";
import { languageSwitchEvent } from "./language-switcher";

const draftKey = "mardood-registration-language-draft";
const subscribe = () => () => {};

function readDraft() {
  try { return sessionStorage.getItem(draftKey); } catch { return null; }
}

type RegistrationStep = { step: 1 | 2; roles: RegistrationRole[] };

export function SignUpForm({ offer }: { offer?: string }) {
  const { t, locale } = useI18n();
  const pendingMessage = t("registration.creatingYourAccount");
  const id = useId();
  const draft = useSyncExternalStore(subscribe, readDraft, () => null);
  const [seenDraft, setSeenDraft] = useState<string | null>(null);
  const [progress, setProgress] = useState<RegistrationStep>({ step: 1, roles: [...DEFAULT_ROLES] });
  const { step, roles } = progress;
  if (draft && draft !== seenDraft) {
    setSeenDraft(draft);
    try {
      const saved = JSON.parse(draft);
      if (saved?.locale === locale && saved?.offer === (offer ?? "") && Array.isArray(saved.roles)) {
        const picked = DEFAULT_ROLES.filter((role) => saved.roles.includes(role));
        setProgress({ step: saved.step === 2 && picked.length ? 2 : 1, roles: picked });
      }
    } catch { /* A malformed draft leaves the initial selection in place. */ }
  }
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopDetails, setShopDetails] = useState("");
  const [clientErrors, setClientErrors] = useState<RegistrationErrors | null>(null);
  const [serverErrors, submit, pending] = useActionState(signUp.bind(null, offer), {});
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const stepChanged = useRef(false);
  const errors = clientErrors ?? serverErrors;
  const merchant = roles.includes("merchant");
  const finishedChoosing = step === 2;
  const loginHref = offer ? `/login?offer=${offer}` : "/login";

  useEffect(() => {
    if (seenDraft && readDraft() === seenDraft) {
      try { sessionStorage.removeItem(draftKey); } catch { /* Storage may be disabled. */ }
    }
    function preserveStep(event: Event) {
      const target = (event as CustomEvent<unknown>).detail;
      if (target !== "ar" && target !== "en") return;
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ locale: target, offer: offer ?? "", step, roles }));
      } catch { /* Language switching still works without storage. */ }
    }
    window.addEventListener(languageSwitchEvent, preserveStep);
    return () => window.removeEventListener(languageSwitchEvent, preserveStep);
  }, [offer, roles, seenDraft, step]);

  useEffect(() => {
    if (stepChanged.current) {
      stepChanged.current = false;
      heading.current?.focus();
      return;
    }
    if (step !== 2 || pending) return;
    const target = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? form.current?.querySelector<HTMLElement>('[role="alert"]');
    target?.focus();
  }, [errors, step, pending]);

  function changeStep(next: 1 | 2) {
    stepChanged.current = true;
    setProgress((current) => ({ ...current, step: next }));
  }

  function toggleRole(role: RegistrationRole) {
    setProgress((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : DEFAULT_ROLES.filter((item) => item === role || current.roles.includes(item)),
    }));
  }

  function validate(event: FormEvent<HTMLFormElement>) {
    if (pending || step !== 2) {
      event.preventDefault();
      return;
    }
    const { errors } = validateRegistration(new FormData(event.currentTarget), t);
    if (Object.keys(errors).length) {
      event.preventDefault();
      setClientErrors(errors);
    } else {
      setClientErrors(null);
    }
  }

  const fieldError = (field: keyof RegistrationErrors) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
  });

  return (
    <CustomerAuthCard
      title={finishedChoosing ? t("registration.completeYourAccountDetails") : t("registration.howWillYouUseMardood")}
      description={finishedChoosing ? t("registration.stepTwoOfTwo") : t("registration.useMardoodAsACustomerMarketer")}
      width={finishedChoosing ? "max-w-[34rem]" : "max-w-[44rem]"}
      headingRef={heading}
    >
      {!finishedChoosing && (
        <div className="mt-4 space-y-4">
          <RegistrationRoleCards roles={roles} onToggle={toggleRole} />
          <RegistrationRoleBadges roles={roles} />
          {!roles.length && <p id="registration-role-error" role="status" className="text-sm text-danger">{t("registration.selectAtLeastOneRoleTo")}</p>}
          {merchant && <p className="text-sm leading-6 text-success">{t("registration.youLlEnterYourStoreDetails")}</p>}
          <button type="button" className="button-primary w-full" disabled={!roles.length} onClick={() => changeStep(2)}>{t("registration.continue")}</button>
        </div>
      )}

      <div hidden={!finishedChoosing} className="mt-4">
        <RegistrationRoleBadges roles={roles} />
        {offer && roles.includes("customer") && <p className="notice mt-3">{t("registration.afterCreatingYourAccountYouLl")}</p>}
        <form ref={form} action={submit} onSubmit={validate} noValidate aria-busy={pending} className="mt-4 grid gap-3.5">
          {roles.map((role) => <input key={role} type="hidden" name="roles" value={role} />)}
          <Field id={`${id}-name`} label={t("registration.fullName")} error={errors.name}>
            <input id={`${id}-name`} name="name" type="text" autoComplete="name" dir="auto"
              required maxLength={120} value={name} onChange={(event) => setName(event.target.value)}
              className={customerFieldFocus} {...fieldError("name")} />
          </Field>
          <div className="grid gap-1">
            <label htmlFor={`${id}-phone`}>{t("auth.phoneNumber")}</label>
            <input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr"
              required maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value)}
              className={customerFieldFocus} aria-invalid={Boolean(errors.phone)}
              aria-describedby={`${id}-phone-${errors.phone ? "error" : "hint"}`} />
            {errors.phone
              ? <p id={`${id}-phone-error`} className="text-sm leading-6 text-danger">{errors.phone}</p>
              : <p id={`${id}-phone-hint`} className="text-sm leading-6 text-muted">{t("auth.10DigitSyrianPhoneNumberExample")}{" "}<bdi dir="ltr">09XXXXXXXX</bdi></p>}
          </div>
          <CustomerPasswordField inputRef={passwordInput} autoComplete="new-password" error={errors.password} />
          <CustomerPasswordField inputRef={confirmationInput} name="confirmation" label={t("registration.confirmPassword")} autoComplete="new-password" error={errors.confirmation} />
          {merchant && (
            <fieldset className="grid min-w-0 gap-3 rounded-xl border border-success/40 bg-success-bg px-3 pb-3 sm:px-4 sm:pb-4">
              <legend className="px-1.5 text-base font-bold text-success">{t("registration.storeDetails")}</legend>
              <Field id={`${id}-shopName`} label={t("registration.storeName")} error={errors.shopName}>
                <input id={`${id}-shopName`} name="shopName" autoComplete="organization" dir="auto" required maxLength={120}
                  value={shopName} onChange={(event) => setShopName(event.target.value)} className={customerFieldFocus} {...fieldError("shopName")} />
              </Field>
              <Field id={`${id}-shopDetails`} label={t("registration.storeDescription")} error={errors.shopDetails}>
                <textarea id={`${id}-shopDetails`} name="shopDetails" rows={3} dir="auto" required maxLength={2000}
                  value={shopDetails} onChange={(event) => setShopDetails(event.target.value)} {...fieldError("shopDetails")}
                  className={`w-full rounded-lg border border-control bg-white px-3 py-2 caret-action aria-invalid:border-danger ${customerFieldFocus}`} />
              </Field>
            </fieldset>
          )}
          {(errors.roles || errors.error) && <p tabIndex={-1} role="alert" className="notice-error">{errors.roles ?? errors.error}</p>}
          <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <button type="button" className="button-secondary disabled:opacity-65" disabled={pending} onClick={() => changeStep(1)}>{t("registration.back")}</button>
            <button type="submit" className="button-primary w-full" disabled={pending}>{pending ? pendingMessage : t("auth.createAccount")}</button>
          </div>
        </form>
        <span role="status" className="sr-only">{pending ? pendingMessage : ""}</span>
      </div>
      <p className="mt-4 text-center text-sm leading-6 text-muted">
        {t("registration.alreadyHaveAnAccount")}{" "}<Link className="text-link" href={loginHref}>{t("common.signIn")}</Link>
      </p>
    </CustomerAuthCard>
  );
}
