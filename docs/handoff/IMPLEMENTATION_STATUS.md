# Mardood implementation status

Verified against `allaith-backend` at `d290cd8` and fetched `origin/main` at `ff27b8d` on 2026-11-24. This status records evidence at those revisions. The [API contract](API_CONTRACT.md) defines the shared request and response shapes. The [team tasks](HACKATHON_TASKS.md) define the required demo.

| Area | Status | Evidence |
| --- | --- | --- |
| Core backend | **Implemented and verified** | Isolated PostgreSQL tests covered authentication and authorization, top-ups, campaign pricing and launch, open join, referral and Offer QR issuance, scanner settlement, cashback and commission, closure, financial reconciliation, and idempotent replay. The final audit reported no confirmed P0 or P1 backend defect. [MVP E2E test](../../api/test/mvp-e2e.integration.test.cjs) |
| Additional backend features | **Implemented extra feature** | Public registration, admin merchant verification and top-up history, merchant and marketer wallet reports, customer purchase history, and admin revenue totals and marketer earnings reports are available. A broader admin overview is deferred. [Contract](API_CONTRACT.md#administration) |
| BE-02 cashback startup validation | **Implemented and verified, merged into main** | `0351001` validates both milestone settings before listening in development, test, and production. Defaults remain five purchases and 50,000 new SYP minor units. [Startup tests](../../api/test/health.test.cjs) |
| TG-01 closure and settlement race | **Committed but not merged into main** | `d290cd8` is on the pushed `allaith-backend` branch. See [TG-01 verification](#tg-01-verification). |
| Alaa's Web integration | **Implemented but not fully verified** | `4a4d9bf` is on main. It includes updated auth, route protection, and referral returns. Full browser-to-backend rehearsal remains pending. |
| Tayma's Web integration | **Implemented but not fully verified** | Merchant/admin pages, manual settlement, and revenue reporting are present. The team reported a prepared Merchant Dashboard, Wallet, and Scanner Recovery handoff. It was not visible on the fetched `main` or `tayma-frontend` (`c65e222`) source. Its publication and integration are unverified. |
| Expo and deployment | **Pending** | Audit the separate Expo repository last, after Web and Backend integration. Deploy after system integration is complete. |

## TG-01 verification

[The dedicated PostgreSQL regression test](../../api/test/campaign-close-settlement.integration.test.cjs) queued real HTTP requests behind a PostgreSQL campaign-row lock. It checked settlement-first and closure-first ordering plus four additional races with independent fixtures. The tested cases reconciled exactly one reserve release per campaign and zero locked reserve after closure. Settlement-first committed one sale, the expected commission, cashback, and revenue, and replayed the original receipt on the original key. Closure-first rejected settlement with `409 QR_EXPIRED`, released the full unused reserve, and left sale, commission, cashback, and revenue unchanged.

## Pending and deferred audit items

| ID | Status | Finding |
| --- | --- | --- |
| BE-01 | **Implemented and tested in isolated handoff, awaiting Laith's pull request** | Top-ups lock the merchant wallet and include all positive remaining campaign reserves before crediting. Regression coverage includes exact limits, overflow rollback, expiry, partial settlement, idempotency, and concurrent top-ups, launch, closure and settlement. |
| BE-03 | **Implemented and tested in isolated handoff, awaiting Laith's pull request** | Admin top-up history returns sanitized `500 INTERNAL_ERROR` for unexpected failures and preserves existing HTTP exceptions. HTTP regression tests inject both cases and retain coverage of pagination, filtering, ordering and legacy nulls. |
| WEB-02 | **Pending** | When the Web has only a refresh cookie or logout cannot reach the API, Web may clear local cookies while the backend session remains active. The [approved access-JWT logout policy](API_CONTRACT.md#authentication-and-sessions) still applies. |
| Referral expiry copy | **Pending integration decision** | The API returns `404 NOT_FOUND` for ended or expired offers. Web presents the same missing-link view as for an unknown code. Agree on the message or a separate response contract before changing API behavior. |
| Step 13D | **Intentionally deferred** | Web callers behind the same Next.js server IP can share an authentication quota. The existing limits remain active. |
| OP-01 | **Intentionally deferred** | The PostgreSQL warning investigation is complete. See [OP-01 compatibility note](#op-01-compatibility-note). |

The [backend](../backlog/02-backend-backlog.md), [Web](../backlog/01-frontend-backlog.md), and [mobile](../backlog/03-mobile-backlog.md) backlogs retain the deferred extensions and ownership.

## OP-01 compatibility note

**OP-01 DEPENDENCY ISSUE SAFE TO DEFER**

The investigation used Node.js 26.5.0 and `pg` 8.23.1, with Prisma Client, Prisma CLI, and `@prisma/adapter-pg` all at 7.10.1. The warning began with `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.`

Prisma's internal relation loader submits multiple reads on a single transaction client. The installed `pg` driver queues and executes them serially. The traced call sites were [scanner lookup and the initial redemption pass read](../../api/src/scanner/scanner.service.ts#L85), plus the [post-lock redemption re-read](../../api/src/scanner/scanner.service.ts#L142). The tests observed no financial integrity failure, duplicate settlement, transaction ordering failure, deadlock, or timeout from the warning. The installed versions need no production change on this evidence. Before adopting a driver version that removes queueing, repeat the traced scanner, settlement, idempotency, and TG-01 regressions. `pg` 9 compatibility has not been tested.
