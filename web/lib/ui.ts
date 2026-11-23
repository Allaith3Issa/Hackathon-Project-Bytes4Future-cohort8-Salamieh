import type { MessageKey, Translate } from "./i18n";

export function validReferral(code: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(code);
}

const messages: Record<string, MessageKey> = {
  "API_UNAVAILABLE": "errors.apiUnavailable",
  "AUTH_REQUIRED": "errors.authRequired",
  "SESSION_EXPIRED": "auth.yourSessionHasExpiredPleaseSign",
  "INVALID_CREDENTIALS": "errors.invalidCredentials",
  "PHONE_ALREADY_REGISTERED": "registration.thisPhoneNumberIsAlreadyRegistered",
  "CAMPAIGN_ENDED": "offers.thisOfferHasEnded",
  "CAMPAIGN_LIMIT_EXCEEDED": "errors.thisOfferHasReachedItsLimit",
  "QR_ALREADY_REDEEMED": "errors.thisCodeHasAlreadyBeenUsed2",
  "QR_EXPIRED": "errors.thisCodeHasExpired",
  "RATE_LIMITED": "errors.rateLimited"
};

export function errorMessage(error: unknown, t: Translate) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return t(typeof code === "string" && Object.hasOwn(messages, code) ? messages[code] : "errors.unexpected");
}
