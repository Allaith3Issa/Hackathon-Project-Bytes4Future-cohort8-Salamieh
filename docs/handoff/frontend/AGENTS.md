# Frontend agent instructions

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

These instructions apply to work under `web/`.

## Stay within the request

- Implement only the screens, states, and interactions requested, plus what is directly required to make them work. The [API contract](../API_CONTRACT.md) and [team task split](../HACKATHON_TASKS.md) are references. They do not authorize implementing unrelated screens or completing the entire project.
- Reuse existing components and dependencies. Do not add unrequested pages, redesigns, features, animations, libraries, broad refactors, or backend changes. Surface a real API mismatch instead of inventing a route or response shape.
- Keep changes on the assigned branch and use a pull request when asked to submit them. Do not push to `main` or create commits, deployments, or PRs unless requested.

## Demo scanner

- Pass the same `code` from lookup to confirmation, show the API cash preview before confirmation and render the returned settlement breakdown after success. Preserve the request body and idempotency key on uncertain retries.

## Follow `design.md`

- Read `web/design.md` before UI work. Follow it for layouts, tokens, typography, component behavior, and responsive rules.

## Next.js and TypeScript

- Use Next.js with the App Router and TypeScript. Keep route files focused on composition, use Server Components by default, and use Client Components for interactions, camera QR scanning, and browser APIs. Keep feature-specific parts close to their routes and extract shared components only when there is real reuse.
- Use the shared typed API client and documented endpoints. Next.js handles the web session boundary and forwards authenticated requests to NestJS. All product rules and database access belong in NestJS. Keep web and Expo Android values consistent with the API.

## Arabic and English

- Arabic is the default (`lang="ar"`, `dir="rtl"`). English routes use `lang="en"` and `dir="ltr"`. Localize interface text, validation, errors, empty states, and accessible names in both sets of messages.
- Use logical spacing and alignment. Isolate phone numbers, links, referral codes, QR fallback codes (`OF-...`, `CB-...`), and transfer references so they read LTR cleanly inside Arabic text. Keep transport field names and route paths as defined by the API contract.

## Backend-owned calculations

- Use NestJS results for pricing, reserves, settlement splits, balances, milestones, conversion rates, and ranks. Format money and parse monetary input using the [minor-unit rules](../API_CONTRACT.md#monetary-limits-and-precision). Use `previousPage` and `nextPage` for navigation.

## Clear, readable errors

- Map API error codes to short, plain-language messages in the current locale. Translate field errors and provide a localized fallback for unknown errors.
- Show validation messages beside the relevant fields and preserve user inputs when correctable. Never expose raw JSON or stack traces. Reuse the original `Idempotency-Key` and request body when retrying an uncertain campaign launch, voucher issuance, QR redemption, top-up, or payout submission.

## Security

- Keep access and refresh tokens in server-managed `HttpOnly` cookies. Use `Secure` in production and an appropriate `SameSite` policy. Keep tokens out of browser storage, client props, URLs, and logs. Check origin on cookie-authenticated mutations at the server boundary.
- Keep secrets in server-only environment variables. Avoid shared caching on authenticated views. Render API data as text and validate external URLs (product images, uploaded transfer receipt images) before rendering them.
- Never collect real credit-card numbers or payment credentials anywhere in the UI.

## Session refresh and admin sign-in

- While signed in, request a refresh every 15 minutes through the same-origin Next.js server boundary. Coordinate refreshes across tabs to avoid reusing a rotated token. The access JWT lasts 30 minutes, and refresh leaves the database session's fixed 30-day expiry and activity timestamp unchanged.
- On expiry or revocation, clear both cookies and show a localized sign-in message. API logout requires a valid access JWT. Web logout without an access cookie remains pending under [WEB-02](../IMPLEMENTATION_STATUS.md#pending-and-deferred-audit-items).
- At `/admin`, show the localized admin sign-in form when there is no valid admin session. Submit credentials to `/auth/admin/login` through the server boundary and rely on NestJS to enforce roles and ownership.

## Keep the implementation simple and efficient

- Prefer local state and direct rendering of API data. Wait for backend confirmation for campaign reserve locks, QR redemptions, voucher creations, admin top-ups, and payout confirmations. Disable duplicate submissions while pending.
- Verify the requested screen, loading/error states, permissions, and responsive behavior (320 / 390 / 768 / 1,440 px) before finishing.
