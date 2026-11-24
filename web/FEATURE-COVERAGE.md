# Mardood web feature coverage

The operation inventory comes from Swagger on the isolated NestJS instance built from `origin/allaith-backend` at `d1c5b2f`. Fetched `origin/main` was `8395d72`. Paths in the first column use the `/api/v1` prefix unless otherwise stated. Web paths accept an `/ar` or `/en` locale prefix. Integration files are relative to `web/`. Campaign image tests use the real controller and database with an isolated ImageKit provider.

| API operation | Required role | Expected web behavior and actual route | Integration file | Status and gap |
| --- | --- | --- | --- | --- |
| `GET /health` | Public | Service health | NestJS | INTERNAL_OR_INFRASTRUCTURE |
| `POST /auth/register` | Public | Role-based registration at `/register` | `app/register/actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `GET /auth/me` | Authenticated | Account and role checks across protected routes | `lib/session.ts` | IMPLEMENTED_AND_CONNECTED |
| `POST /auth/login` | Public | Shared `/login`, merchant `/merchant/login`, referral sign-in | `app/actions.ts`, `app/staff-actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `POST /auth/admin/login` | Public | Dedicated admin sign-in at `/admin` | `app/staff-actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `POST /auth/refresh` | Refresh session | Session rotation through `/session/refresh` | `lib/session-rotation.ts` | INTERNAL_OR_INFRASTRUCTURE |
| `POST /auth/logout` | Authenticated | Shared menu sign-out with backend revocation | `lib/session-logout.ts`, `app/actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `POST /merchant/campaigns/preview` | Merchant | Price and reserve review at `/merchant/campaigns/new` | `app/staff-actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `POST /merchant/campaigns` | Verified merchant | Launch after preview and image upload at `/merchant/campaigns/new` | `app/staff-actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `GET /merchant/campaigns` | Merchant | Campaign list at `/merchant/campaigns` | `app/[locale]/merchant/campaigns/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /merchant/campaigns/{campaignId}` | Merchant owner | Campaign details and product image at `/merchant/campaigns/[id]` | `app/[locale]/merchant/campaigns/[id]/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /merchant/campaigns/{campaignId}/close` | Merchant owner | Confirm closure and show resulting reserve information | `app/staff-actions.ts`, `components/close-campaign.tsx` | IMPLEMENTED_AND_CONNECTED. The closure receipt lookup reads the first wallet transaction page. |
| `GET /campaigns` | Marketer | Search, filters and pagination at `/marketer/campaigns` | `components/marketer-campaigns-page.tsx` | IMPLEMENTED_AND_CONNECTED. Card membership hints use one bounded snapshot. Details check the exact membership. |
| `GET /campaigns/{campaignId}` | Marketer | Product image, prices, discount and commission at `/marketer/campaigns/[id]` | `app/[locale]/marketer/campaigns/[id]/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /marketer/campaigns/{campaignId}/join` | Marketer | Join eligible campaigns or resubmit rejected memberships at the details page | `app/marketer-actions.ts` | IMPLEMENTED_AND_CONNECTED |
| `GET /marketer/campaigns/{campaignId}/membership` | Marketer | Authoritative status and returned referral at the details page | `app/[locale]/marketer/campaigns/[id]/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /marketer/memberships` | Marketer | Paginated `/marketer/memberships` with approved, pending, rejected, and all filters. Approved referrals support copy and share. | `components/marketer-campaigns-page.tsx`, `components/referral-actions.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /public/referrals/{code}` | Public | Offer, image, price and checkout entry at `/r/[code]` | `app/[locale]/r/[code]/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /public/referrals/{code}/clicks` | Public | Attribute offer visit from `/r/[code]` | `app/actions.ts`, `app/[locale]/r/[code]/offer-pass.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /customer/referrals/{code}/offer-qr` | Customer | Issue QR and manual code at `/r/[code]` | `app/actions.ts`, `app/[locale]/r/[code]/offer-pass.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /merchant/scanner/lookup` | Merchant | Resolve code at `/merchant/scanner` | `app/staff-actions.ts`, `components/scanner-flow.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /merchant/scanner/redeem-offer` | Merchant | Confirm the sale, retain the exact idempotent retry, and show settlement | `app/staff-actions.ts`, `components/scanner-flow.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /admin/merchants` | Admin | Verification queue and verified merchant selection at `/admin/merchants` and `/admin/topups` | Page files for both routes | IMPLEMENTED_AND_CONNECTED |
| `PATCH /admin/merchants/{merchantId}/verification` | Admin | Approve or reject merchant at `/admin/merchants` | `app/staff-actions.ts`, `components/merchant-verification-list.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /admin/merchants/{merchantId}/topups` | Admin | Confirm top-up and read resulting balance at `/admin/topups` | `app/staff-actions.ts`, `components/topup-form.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /admin/topups` | Admin | Paginated top-up history | — | MISSING_WEB_UI. The current top-up screen records a top-up and displays its result. Add history for audit and reconciliation. |
| `GET /admin/revenue` | Admin | Compatibility alias for revenue summary | `app/[locale]/admin/revenue/page.tsx` uses `/summary` | INTERNAL_OR_INFRASTRUCTURE |
| `GET /admin/revenue/summary` | Admin | Platform fees and total marketer commissions at `/admin/revenue` | `app/[locale]/admin/revenue/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /admin/revenue/marketers` | Admin | Paginated marketer earnings by person at `/admin/revenue` | `app/[locale]/admin/revenue/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /merchant/wallet` | Merchant | Available and locked balances at `/merchant/wallet` | `app/[locale]/merchant/wallet/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /merchant/wallet/transactions` | Merchant | Paginated ledger at `/merchant/wallet` | `app/[locale]/merchant/wallet/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /merchant/dashboard` | Merchant | Business performance and balance at `/merchant` | `app/[locale]/merchant/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /marketer/wallet` | Marketer | Available, pending, lifetime earned, and completed simulated amounts at `/marketer/earnings` | `app/[locale]/marketer/earnings/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /marketer/wallet/by-merchant` | Marketer | Earnings aggregated by merchant | Expo wallet API, `mobile/src/features/marketer/wallet/api.ts` | MISSING_WEB_UI. Per-campaign stats are already visible in My Campaigns. |
| `GET /marketer/wallet/transactions` | Marketer | Paginated commission and payout movements at `/marketer/earnings#wallet-activity` | `app/[locale]/marketer/earnings/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /marketer/stats` | Marketer | Account-wide campaign performance | Expo wallet API, `mobile/src/features/marketer/wallet/api.ts` | MISSING_WEB_UI. Web renders per-campaign stats from membership data. |
| `GET /customer/dashboard` | Customer | Cashback balances and milestones at `/customer` | `app/[locale]/customer/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /customer/purchases` | Customer | Purchase history and pagination at `/customer` | `app/[locale]/customer/page.tsx` | IMPLEMENTED_AND_CONNECTED |
| `POST /merchant/uploads/image` | Verified merchant | Browser compression, preview, and multipart upload on launch | `components/product-image-picker.tsx`, `app/staff-actions.ts`, `lib/campaign-upload.ts` | IMPLEMENTED_AND_CONNECTED against real NestJS with the provider isolated. Live ImageKit acceptance remains unverified. |
| `POST /marketer/payouts` | Marketer | Submit the confirmed full balance at `/marketer/earnings` | `app/payout-actions.ts`, `components/withdrawal-request.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /marketer/payouts` | Marketer | Filterable, paginated history at `/marketer/earnings#payout-history` | `app/[locale]/marketer/earnings/page.tsx`, `components/payout-list.tsx` | IMPLEMENTED_AND_CONNECTED |
| `GET /admin/payouts` | Admin | Filterable, paginated queue at `/admin/payouts` | `app/[locale]/admin/payouts/page.tsx`, `components/payout-list.tsx` | IMPLEMENTED_AND_CONNECTED |
| `PATCH /admin/payouts/{payoutId}/approve` | Admin | Confirm amount and approve the simulated payout | `app/payout-actions.ts`, `components/admin-payout-decision.tsx` | IMPLEMENTED_AND_CONNECTED |
| `PATCH /admin/payouts/{payoutId}/reject` | Admin | Reject with a trimmed reason and show the result | `app/payout-actions.ts`, `components/admin-payout-decision.tsx` | IMPLEMENTED_AND_CONNECTED |

## Contract gaps outside this change

- **High priority if voucher redemption is enabled in the demo.** The scanner retains its existing voucher branch, but `POST /merchant/scanner/redeem-voucher` and customer voucher lifecycle operations are absent from this backend’s Swagger. Status `DEFERRED`.
- **Medium priority.** Add admin top-up history for audit review. Per-merchant earnings and aggregate marketer performance are the other reporting gaps.
- **Deferred.** Real fund transfers, campaign image editing, broader administration, and automatic removal of uploaded images are outside this scope. The fetched Swagger contains no campaign image update operation.

## Integration notes

- The UI uses browser Canvas and ImageBitmap for compression, with a 1,200-pixel maximum side, an initial quality of 0.8, bounded fallback passes, and a hard cap of 500,000 bytes. Small uniform files may finish well below the 150–300 KB target.
- The Next.js action uses the existing HttpOnly session and forwards standard multipart data without a manually generated boundary. A receipt tied to the file bytes and backend session allows campaign retry to reuse the uploaded URL through token rotation. Across a full sign-out or reload, the form must be restarted.
- Image URLs render directly in the browser with a fallback, retaining HTTP and HTTPS support for existing campaign images. ImageKit IDs and keys remain server-side.

## Baseline and validation

- Started on `alaa-frontend` at `6f1b779`. Fetched `origin/main` was `8395d72` and includes ImageKit from `deeb6ca`. Fetched `origin/allaith-backend` was `d1c5b2f` and is the verified payout contract. The existing branch includes Tayma’s squash merge `475e463` and Alaa’s logout fix `241d266`. Local Web work and Git history were preserved.
- All 44 Swagger operations on the payout backend are listed. Fetched `main` does not contain the payout controller or migrations `0003_payout_movement_kinds` and `0004_simulated_marketer_payouts`. Deploy the payout-capable backend and apply its migrations before enabling this Web workflow. The developer API on port 3000 was observed in the previous review without the upload route. The current tests used isolated processes on separate ports.
- Production build, TypeScript, Git whitespace check, and the scoped Impeccable scan passed. The Web package has no ESLint configuration or script and no project test script.
- Eleven media tests and sixteen auth, scanner, campaign-closure and MVP regression tests passed with the fetched backend. All database mutations used fresh test databases on loopback.
- The Edge run exercised verified merchant image selection, replacement and removal, invalid and oversized files, compression failure, launch preview, multipart size, provider failure, retry after an upload succeeded and campaign creation failed, and duplicate submission. The high-entropy inputs reached NestJS at 600 × 563 and under 484,000 bytes. The pending merchant upload returned forbidden.
- The Edge run exercised protected marketer discovery, search, empty results, pagination, joining, updated membership, referral copy and share fallback, image rendering, and the public referral-to-customer-QR flow. It verified the exact URL passed to Web Share using a browser test double. It also checked Arabic at 320 px and expired-session recovery.
- Live ImageKit delivery and the operating-system camera and share chooser remain unverified. The browser used the real NestJS controller, Prisma and PostgreSQL with a provider double and isolated image responses. No real ImageKit assets were uploaded. The developer database was not used for the tests.

## Files changed for this task

- Campaign actions and transport: `app/marketer-actions.ts`, `app/staff-actions.ts`, `lib/api.ts`, `lib/campaign-upload.ts`, `lib/marketer-campaigns.ts`, `lib/product-image.ts`, `lib/compress-product-image.ts`.
- Marketer UI: `app/[locale]/marketer/campaigns/[id]/page.tsx`, `components/marketer-campaign-list.tsx`, `components/marketer-campaigns-page.tsx`, `components/join-marketer-campaign.tsx`, `components/referral-actions.tsx`.
- Merchant and public UI: `app/[locale]/merchant/campaigns/new/page.tsx`, `app/[locale]/merchant/campaigns/page.tsx`, `app/[locale]/merchant/campaigns/[id]/page.tsx`, `app/[locale]/r/[code]/page.tsx`, `components/campaign-form.tsx`, `components/product-image-picker.tsx`, `components/campaign-image.tsx`.
- Locales and audit: `messages/ar.json`, `messages/en.json`, `FEATURE-COVERAGE.md`.
- Existing local marketer routes retained: `app/[locale]/marketer/campaigns/page.tsx`, `app/[locale]/marketer/memberships/page.tsx`, `app/[locale]/marketer/layout.tsx`, `app/[locale]/marketer/loading.tsx`.

No dependency was added.

## Combined Web tasks on the payout backend

| Task | Web feature and route or component | API | Implementation | Verified |
| --- | --- | --- | --- | --- |
| WEB-03 | Discovery at `/marketer/campaigns` | `GET /campaigns` | Connected | Search, pagination, empty results and campaign images in Edge |
| WEB-04 | Joined campaigns at `/marketer/memberships` | `GET /marketer/memberships` | Connected | Joined campaign appears in Edge. Status filters exercised previously |
| WEB-05 | Details and referral controls at `/marketer/campaigns/[id]` | Campaign detail, membership lookup, join | Connected | Join, authoritative membership, exact copy and share argument, Web referral and customer QR |
| WEB-06 | Image selection at `/merchant/campaigns/new` | `POST /merchant/uploads/image`, campaign launch | Connected | Real NestJS multipart, preview, replacement, provider failure and retry tested with a provider double |
| WEB-07 | Browser compression in `lib/compress-product-image.ts` | Upload size and format contract | Connected | Actual multipart stayed at or below 500,000 bytes. Invalid, corrupt and oversized inputs tested |
| WEB-08 | Merchant, marketer and public offer images in `components/campaign-image.tsx` | DTOs’ `imageUrl` | Connected | Browser rendering and referral flow with an isolated provider |
| WEB-09 | Full-balance withdrawal at `/marketer/earnings` | `GET /marketer/wallet`, `POST /marketer/payouts` | Connected | Exact minor-unit amount, stale balance reconfirmation, lost-response replay and account isolation |
| WEB-10 | Withdrawal history and ledger at `/marketer/earnings` | `GET /marketer/payouts`, `GET /marketer/wallet/transactions` | Connected | Pending, completed and rejected records, decision reason, ledger changes and balances |
| WEB-11 | Admin queue at `/admin/payouts` | `GET /admin/payouts`, approve/reject PATCH routes | Connected | Admin-only access, approval, reason validation, rejection and concurrent terminal decision |
| WEB-12 | Operation inventory in this document | Swagger from `d1c5b2f` | Complete | 44 paths and methods matched against the live isolated Swagger |
| WEB-13 | Static, browser and backend regression checks | Published NestJS and PostgreSQL | Complete for the tested scope | 38 backend tests passed. Edge tested the payout flows and reran campaign and image workflows. |

The payout form stores only the confirmed amount and UUID in tab-scoped storage keyed by marketer account. Access and refresh tokens stay in server-managed cookies. Network ambiguity retains the exact key and body, including across reload. Definitive payout conflicts refresh the wallet and history before another confirmation. Admin retries keep the same decision and trimmed reason. All money values and terminal statuses are read from the backend.

### Files changed for the payout follow-up

- `app/[locale]/admin/layout.tsx`, `app/[locale]/admin/payouts/page.tsx`, `app/[locale]/admin/payouts/loading.tsx`, `app/[locale]/marketer/earnings/page.tsx`, `app/payout-actions.ts`
- `components/admin-payout-decision.tsx`, `components/language-switcher.tsx`, `components/payout-list.tsx`, `components/withdrawal-request.tsx`
- `lib/payouts.ts`, `messages/ar.json`, `messages/en.json`, `FEATURE-COVERAGE.md`

No dependency or environment-file change. Live ImageKit, hardware camera capture, and the native operating-system share chooser were outside the isolated checks.
