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

## Arabic only

- Set `lang="ar"` and `dir="rtl"` on the root HTML element. Use Arabic for every user-facing string, including the admin sign-in, navigation, field labels, validation, errors, empty states, and accessible names.
- Use logical spacing and alignment. Isolate phone numbers, links, referral codes, QR fallback codes (`OF-...`, `CB-...`), and transfer references so they read LTR cleanly inside Arabic text. Keep transport field names and route paths as defined by the API contract.

## No frontend arithmetic

- Frontend application code must not perform arithmetic. This covers browser code, Next.js server code, and UI helpers. NestJS supplies every calculated value the interface needs, including worst-case campaign reserves, per-sale fee/cashback previews, balances, milestone progress counts, conversion rates, ranks, and pagination.
- Render API values directly. Formatting may add thousand separators, `ل.س.` for Syrian pounds, or the Arabic percent sign `٪` without changing numeric values. For pagination, use `previousPage` and `nextPage` returned by the API. If a value is missing, flag the contract gap and resolve it with the backend.

## Clear, readable errors

- Map API error codes to short, plain-language Arabic that explains what happened and what the user can do next (for example: «الرصيد المتاح لا يكفي لتغطية الحد الأقصى لتكلفة الحملة» or «تم استخدام رمز العرض هذا من قبل»). Translate field errors before displaying them and use a clear Arabic fallback for unknown errors.
- Show validation messages beside the relevant fields and preserve user inputs when correctable. Never expose raw JSON or stack traces. Reuse the original `Idempotency-Key` and request body when retrying an uncertain campaign launch, voucher issuance, QR redemption, top-up, or payout submission.

## Security

- Keep access and refresh tokens in server-managed `HttpOnly` cookies. Use `Secure` in production and an appropriate `SameSite` policy. Keep tokens out of browser storage, client props, URLs, and logs. Check origin on cookie-authenticated mutations at the server boundary.
- Keep secrets in server-only environment variables. Avoid shared caching on authenticated views. Render API data as text and validate external URLs (product images, uploaded transfer receipt images) before rendering them.
- Never collect real credit-card numbers or payment credentials anywhere in the UI.

## Session refresh and admin sign-in

- While signed in, request a refresh every 15 minutes through the same-origin Next.js server boundary, coordinating refreshes across tabs so parallel requests do not reuse a rotated refresh token.
- Report deliberate authenticated user activity through the server boundary (not timers or background refresh calls). If the session expires or is revoked, clear both cookies and show «انتهت جلستك. سجّل الدخول مرة أخرى.»
- At `/admin`, show the Arabic admin sign-in form when there is no valid admin session and submit credentials to `/auth/admin/login` through the server boundary.

## Keep the implementation simple and efficient

- Prefer local state and direct rendering of API data. Wait for backend confirmation for campaign reserve locks, QR redemptions, voucher creations, admin top-ups, and payout confirmations. Disable duplicate submissions while pending.
- Verify the requested screen, loading/error states, permissions, and responsive behavior (320 / 390 / 768 / 1,440 px) before finishing.
