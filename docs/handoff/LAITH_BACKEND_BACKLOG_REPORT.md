# Laith Backend Backlog Implementation

## Scope

Implemented Laith-owned backend backlog items described by `docs/tasks/01-backend.md` and the API contract:

- Cashback voucher issue, list, cancel, lookup, and redemption.
- Store-discount checkout preview and atomic settlement.
- Marketer payout requests, receipt upload/retrieval, transfer, rejection, confirmation, dispute, and dispute resolution.
- Merchant and marketer wallet reporting, customer purchase history, statistics, public leaderboard, and admin accounting overview.

Allaith-owned account, campaign setup, and approval workflows were not changed. The checkout does not contain a `docs/backlog/` directory, so ownership and acceptance details were taken from the backend task split and handoff documents.

## Implementation

- Added `003_laith_backlog_financial_flows.sql` for voucher and payout records, private receipt bytes, ledger references, status constraints, and indexes.
- Voucher issuance reserves available cashback and stores the idempotent response in the same transaction. Cancellation releases the reservation once; voucher redemption validates the bill and credits a verified merchant atomically.
- Store-discount previews and redemptions calculate all fees using integer SYP arithmetic. Settlement rechecks the volume cap and locked reserve under the campaign lock and closes the campaign in the sale transaction when the cap is reached.
- Payout requests atomically move funds from available to pending. Transfers, pre-transfer rejection, receipt confirmation, disputes, and verified transfer reversals use locked state transitions and ledger entries. Transfers auto-confirm after 72 hours.
- Receipt images are restricted to JPEG, PNG, or WebP, capped at 5 MB, stored in PostgreSQL, and served only to the payout owner or an Admin.
- Added paginated wallet transactions, merchant dashboard, marketer earnings by merchant and statistics, customer purchase history, the public leaderboard, and separated admin financial totals.
- Updated the API contract and ERD for the private receipt route and receipt storage.

## Validation

From `api/`:

- `npm run lint` — passed.
- `npm test` — passed; includes a clean TypeScript build and 7 tests covering financial routes' authentication boundary, store-discount fee arithmetic, voucher checkout amounts and rejection when the bill is too small, and public leaderboard pagination.
- `git diff --check` — passed.

PostgreSQL integration tests were not run because `DATABASE_URL` is not configured in this environment. Apply the shared/base schema and migrations, including migration `003`, then verify voucher cancellation/redemption races, store-discount cap settlement, payout transitions, and accounting reconciliation against an isolated database.

## Integration dependency

Protected routes use the existing `AuthenticatedActorGuard` seam, which expects shared authentication middleware to populate `request.user`. This checkout does not include the bearer-token provider; the new endpoints follow the existing guard and do not replace or implement Allaith-owned authentication.
