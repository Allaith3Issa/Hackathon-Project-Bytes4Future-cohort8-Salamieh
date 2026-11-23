# Mardood frontend review

Reviewed `main` at `059888d` on November 23, 2026. For Alaa and Tayma. [Reviewed commit](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/commit/059888d)

## Coordinate first · Shared authentication rate limit

The Next.js API client sends login and session refresh requests from the web server. NestJS applies its per-IP limit to the address it sees. Separate users going through the same Next.js instance can therefore share the allowance for each route. Agree with Allaith and Laith on where the limit belongs and how clients are identified, then verify with two independent web sessions. This was found in code. Hosted impact was outside the review. [Web API client](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/lib/api.ts#L18) · [Auth module](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/api/src/auth/auth.module.ts#L12)

## Fix next · Preserve the scanner route during session recovery

**Reproduced in Edge.** Reloading the merchant scanner with an expired access cookie and a valid refresh cookie restored the session and opened **Create Campaign**. This interrupts checkout. [Staff route guard](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/lib/staff.ts#L6)

**Acceptance check.** After a successful refresh, the scanner reloads at the same route and in the same language. If the refresh token is invalid or expired, the merchant is sent to sign-in.

## Then · Keep language switches from counting as referral clicks

**Reproduced in Edge and checked in PostgreSQL.** One referral offer visit followed by an Arabic-to-English switch created two click records. The language switch reloads the offer and runs the click tracker again. [Referral tracker](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/app/%5Blocale%5D/r/%5Bcode%5D/offer-pass.tsx#L7)

**Acceptance check.** Opening a referral link records one click. Switching languages on that offer adds zero clicks and keeps the referral code. A genuine new visit still records one click.

## Verification

- The web production dependency audit reported zero known advisories.
- Frontend TypeScript and the production build passed in the preceding check on this same commit.
- Both browser findings were reproduced on a local build against the NestJS API and PostgreSQL.
