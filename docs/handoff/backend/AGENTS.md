# Backend agent instructions

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

These instructions apply to work under the repository-root `api/` application directory.

## Stay within the request

- Implement only the feature or fix requested and the changes directly required to make it work. The [API contract](../API_CONTRACT.md), [ERD](../DATABASE_ERD.md), and [team task split](../HACKATHON_TASKS.md) describe the project. They do not authorize implementing their entire contents in one task.
- Reuse existing code and dependencies. Do not add unrelated endpoints, tables, dependencies, auth flows, background jobs, infrastructure, broad refactors, or documentation changes. Surface a genuine cross-team dependency or contract conflict before changing public behavior.
- Keep changes on the assigned branch and use a pull request when asked to submit them. Do not push to `main` or create commits, deployments, or PRs unless requested.

## NestJS and PostgreSQL

- Use NestJS and TypeScript with PostgreSQL. Organize related controllers, DTOs, services, and persistence code in feature modules. Keep controllers thin. Put business rules and transaction boundaries in services. Use the project’s existing persistence layer and migrations.
- Define request DTOs, validate them, and map database records to explicit response DTOs. Keep Swagger and the API contract aligned for any requested interface change. Use the same status, pricing, reserve, cashback, and payout rules across web and Expo Android endpoints.
- Treat NestJS as the authority for permissions, pricing, worst-case campaign reserves, 5% fee / 2% cashback splits, balances, and state transitions. Use database constraints for uniqueness and invariants where practical. Handle concurrent writes and retries with `Idempotency-Key`, DB transactions, explicit row locks (`FOR UPDATE`) on wallets, campaigns, Offer QRs, and Cashback Vouchers, and conditional state updates for single-use redemptions and payout confirmations.
- Return all computed values the frontend and mobile app need, including worst-case reserve previews, sale splits, cashback milestone progress, per-merchant marketer earnings, separated admin accounting buckets, and pagination. Keep these calculations in the owning feature module and reuse them across endpoints. Return stable error codes with plain-language messages and field-level guidance when available.

## Financial & ledger invariants

- Use one shared product pricing implementation for preview, launch and settlement. The campaign service owns closing and reserve release. The scanner calls it within the settlement transaction when the sale reaches the cap.
- Store successful idempotency responses atomically with their financial mutations, including campaign creation and reserve locking. Claim or replay the key before mutable state checks. For Offer QR issuance, lock the campaign before reusing or creating the pass and enforce the active-pass indexes in the ERD. On voucher issuance lock the customer balance and reserve available cashback. At redemption, validate the bill total and consume the reservation once. Cancellation and redemption serialize on the voucher row.

- Store money in integer hundredths of one new Syrian Pound using `bigint`. Existing verified old-SYP integers carry over unchanged. Keep existing `...Syp` fields as safe JSON integers at the API boundary. Convert percentage rates to integer basis points and use `bigint` for monetary arithmetic, flooring to one minor unit at the contract boundaries. Apply the [API monetary limits](../API_CONTRACT.md#monetary-limits-and-precision) before committing a change or converting a response value to a number. Always enforce `platformNetFeeSyp = platformTotalFeeSyp - customerCashbackSyp` so the platform fee split reconciles to the exact minor unit and cashback never exceeds collected platform fees.
- Never allow negative wallet balances (`availableBalanceSyp >= 0`, `pendingPayoutSyp >= 0`, `lockedBudgetSyp >= 0`, `availableCashbackSyp >= 0`).
- Record every top-up, campaign reserve lock/unlock, sale deduction, marketer commission credit, cashback accrual/unlock, voucher reservation/release/redemption, and payout state transition in `MONEY_MOVEMENTS`.
- Never execute real credit-card charges or third-party payment gateway calls. Top-ups and Sham Cash payouts are ledger-backed operational workflows verified by Admin with reference IDs and transfer receipt images.

## Extend the backend when requested

- Keep feature boundaries clear. Each module owns its business rules and writes. Other modules should use its exported service methods instead of reaching into its repositories or duplicating rules. Keep exports small and avoid circular dependencies.
- Preserve existing clients and data as features grow. Prefer additive API changes, keep database migrations compatible with existing records, and coordinate breaking changes across web, Expo Android, Swagger, and the Markdown contract.

## Security

- Deny access by default. Explicitly designate public routes (`/auth/*`, `/public/*`), verify bearer tokens, and enforce both role (`admin`, `merchant`, `marketer`, `customer`) and resource ownership in the backend. Never let public input create an admin, set verification status, credit a top-up, modify a wallet balance, or alter a payout status. Return only fields the caller is allowed to see.
- Validate request bodies, route parameters, and query parameters. Reject unknown fields, bound input lengths and pagination, validate uploaded receipt image MIME/size limits, use parameterized database queries, and use generic login failures. Apply rate limits to login, referral clicks, QR generation, and scanner lookups. Restrict CORS to configured origins where browser access is needed.
- Use bcrypt with 10 salt rounds for demo credentials and verify them with `bcrypt.compare()`, following B4F Board. Enforce bcrypt's 72-byte UTF-8 password limit before hashing. Argon2id is also an accepted password-hashing algorithm when the verifier supports it. Keep credentials and signing keys in server-side environment variables. Never commit `.env`, expose stack traces, or log passwords, password hashes, access tokens, refresh tokens, or QR tokens.

## Session refresh and admin sign-in

- Issue a 30-minute access JWT and an opaque refresh token at sign-in. Store only the refresh token hash and rotate it atomically on successful refresh. Reject reuse. The [API contract](../API_CONTRACT.md#authentication-and-sessions) applies to both Next.js and Expo clients.
- Give every session, including admin sessions, a fixed 30-day lifetime from creation. Refresh changes neither expiry nor the activity timestamp. Logout requires a valid access JWT for the session. If the caller includes a refresh token, it must match that session's current token.
- Public signup supports multiple public roles and cannot assign `admin`. Provision the first administrator manually with the [bootstrap CLI](../../../api/ADMIN_BOOTSTRAP.md) after migrations. Use `/auth/admin/login` for admin sign-in and enforce the `admin` role on every `/admin/*` endpoint.

## Keep the implementation simple and efficient

- Start with the simplest readable implementation that meets the requested behavior. Use SQL filtering, pagination, and aggregation for database-backed data (`GET /marketer/wallet/by-merchant`, `GET /admin/overview`). Avoid per-row queries and unbounded reads.
- Add an index when a constraint or concrete query needs it (`qr_token`, `pass_code`, `voucher_code`, `referral_code`). Prefer conditional updates for single-record transitions and transactions with explicit locks when enforcing invariants across related records.
- Verify the requested flow and its failure paths. Cover insufficient merchant balance, lost-response launch retry, concurrent issuance, double QR scan, final-sale replay, excessive monetary values, insufficient locked budget and repeated payout requests when enabled.
