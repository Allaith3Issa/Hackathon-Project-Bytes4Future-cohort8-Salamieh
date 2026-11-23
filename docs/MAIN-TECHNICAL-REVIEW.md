# Mardood technical review

Reviewed `main` at [`059888d`](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/commit/059888d) on November 23, 2026. The review covered web and API security, code behavior, and database query performance. Two user-facing bugs were reproduced in Edge. The code review identified a shared authentication rate limit, and PostgreSQL confirmed two scans of the sales table on the merchant dashboard.

## 1. Web users share an authentication rate limit

**Evidence.** NestJS allows 10 requests per minute per IP on each authentication route. The Next.js server sends these requests to NestJS without passing a trusted browser identity. Users reaching the API through the same web server IP therefore share the allowance for each route, including login and token refresh. The hosted impact was not measured. [Auth limit](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/api/src/auth/auth.module.ts#L12) · [Web API client](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/lib/api.ts#L18)

**Next step.** Review the rate-limit boundary for web traffic. Keep abuse protection and verify that separate users going through the same Next.js instance have independent login and refresh allowances.

## 2. Session recovery sends merchants away from the scanner

**Evidence.** In Edge, reloading the scanner with only the valid refresh cookie restored the session and opened **Create Campaign**. A merchant resuming checkout should return to the scanner. [Staff route guard](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/lib/staff.ts#L6)

**Next step.** Preserve the current staff route through session recovery. Verify that the scanner reloads on the same route after a successful refresh and that an expired session still goes to sign-in.

## 3. Switching languages records another referral click

**Evidence.** One visit to a referral offer followed by a switch from Arabic to English produced two click records in PostgreSQL. The language switch reloads the offer and runs the click tracker again. [Referral tracker](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/app/%5Blocale%5D/r/%5Bcode%5D/offer-pass.tsx#L7)

**Next step.** Keep the existing visit through a language switch. Verify that switching languages adds zero clicks and that a genuine new referral visit still adds one.

## 4. Merchant dashboard scans sales twice

**Evidence.** PostgreSQL query plans showed one sales scan for dashboard totals and another for the top campaign. Both queries took under 1 ms on the local test fixture. No user-visible slowdown was observed. [Reporting queries](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/api/src/reporting/reporting.service.ts#L90)

**Next step.** Treat this as lower priority. Measure with representative sales volume before changing the queries or adding an index.

## Verification

- The production dependency audit reported zero known advisories for the API and web app.
- All 145 PostgreSQL-backed backend tests, backend lint, frontend TypeScript, and the production build passed in the preceding check on the same commit.
- The targeted browser checks and query plans ran locally. Hosted rate-limit behavior and dashboard performance under production load were outside this check.

**Suggested fix order:** shared authentication rate limit, merchant session recovery, then referral analytics.
