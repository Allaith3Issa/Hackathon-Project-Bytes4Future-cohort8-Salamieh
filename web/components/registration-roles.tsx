"use client";

import { useI18n } from "@/components/i18n-provider";
import { DEFAULT_ROLES, type RegistrationRole } from "@/lib/registration";

const roleInfo = {
  customer: {
    title: "roles.customer",
    description: "roles.findOffersSaveWithDiscountsAnd",
    selected: "border-action bg-[#fff2e8]",
    badge: "bg-[#fff2e8] text-action-hover",
    check: "border-action bg-action text-white",
    icon: "M5 8h14l1 13H4L5 8Zm4 1V6a3 3 0 0 1 6 0v3",
  },
  marketer: {
    title: "roles.marketer",
    description: "roles.shareOfferLinksAndEarnCommissions",
    selected: "border-dusty-mauve bg-mauve",
    badge: "bg-mauve text-ink",
    check: "border-dusty-mauve bg-dusty-mauve text-ink",
    icon: "M3 10v4h4l11 4V6L7 10H3Zm4 4 2 6h3l-2-5m8-4 3-2m-3 5 3 2",
  },
  merchant: {
    title: "roles.merchant",
    description: "roles.createStoreCampaignsAndTrackSales",
    selected: "border-success bg-success-bg",
    badge: "bg-success-bg text-success",
    check: "border-success bg-success text-white",
    icon: "M3 9l2-5h14l2 5M3 9v2a2 2 0 0 0 4 0 2 2 0 0 0 5 0 2 2 0 0 0 5 0 2 2 0 0 0 4 0V9M5 13v7h14v-7m-9 7v-5h4v5",
  },
} as const satisfies Record<RegistrationRole, Record<string, string>>;

export function RegistrationRoleCards({ roles, onToggle }: {
  roles: RegistrationRole[];
  onToggle: (role: RegistrationRole) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="grid min-w-0 gap-2.5 sm:grid-cols-3" aria-describedby={roles.length ? undefined : "registration-role-error"}>
      <legend className="sr-only">{t("roles.availableRoles")}</legend>
      {DEFAULT_ROLES.map((role) => {
        const info = roleInfo[role];
        const checked = roles.includes(role);
        return (
          <label key={role} className={`grid cursor-pointer items-start gap-x-3 gap-y-1 rounded-xl border p-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action motion-safe:transition-colors sm:gap-y-2 sm:p-4 ${checked ? info.selected : "border-rule bg-white hover:border-control"} grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto]`}>
            <input type="checkbox" value={role} checked={checked} onChange={() => onToggle(role)} className="sr-only"
              aria-labelledby={`registration-role-${role}`} aria-describedby={`registration-description-${role}`} />
            <span className={`row-span-2 grid size-9 place-items-center rounded-lg sm:col-start-1 sm:row-span-1 ${info.badge}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d={info.icon} />
              </svg>
            </span>
            <span id={`registration-role-${role}`} className="text-base font-bold sm:col-start-1 sm:col-end-3 sm:row-start-2">{t(info.title)}</span>
            <span aria-hidden="true" className={`col-start-3 row-start-1 grid size-5 place-items-center rounded-md border sm:col-start-2 ${checked ? info.check : "border-control bg-white"}`}>
              {checked && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5"><path d="m3 8 3 3 7-7" /></svg>}
            </span>
            <span id={`registration-description-${role}`} className="col-start-2 text-sm leading-6 font-normal text-muted sm:col-start-1 sm:col-end-3">{t(info.description)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function RegistrationRoleBadges({ roles }: { roles: RegistrationRole[] }) {
  const { t } = useI18n();
  if (!roles.length) return null;
  return (
    <ul role="list" aria-label={t("roles.selectedRoles")} className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <li key={role} className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${roleInfo[role].badge}`}>{t(roleInfo[role].title)}</li>
      ))}
    </ul>
  );
}
