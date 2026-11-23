# Backend tasks

NestJS and PostgreSQL · Allaith Issa and Laith Alhaj Husain

All backend monetary amounts are integer hundredths of one new Syrian Pound. Use the [API monetary limits](../handoff/API_CONTRACT.md#monetary-limits-and-precision) for pricing, settlement, fixtures and client handoff. Existing `...Syp` fields retain their names and JSON integer types.

## Allaith Issa · API foundation, accounts and campaigns

- **Start on Day 1.** Set up NestJS, PostgreSQL, migrations and Swagger. Publish the shared demo seed and API examples from `API_CONTRACT.md`, including a funded campaign and pre-issued pass so the scanner work can start in parallel.
- **Build for the demo.** Own login, session refresh and role guards, seeded accounts, campaign browse, pricing preview, launch and reserve locking, open joining, referral resolution, and Offer QR issuance. Own the shared idempotency implementation and its database constraint.
- **Hand off to Laith.** Provide the campaign pricing, close and reserve-release operations and agree on lock order. Laith calls the close operation inside the settlement transaction when a sale reaches the cap.
- **Verify.** Cover lost-response launch retry, concurrent Offer QR issuance, the monetary boundary, manual closure and expiry. Coordinate API contract changes and backend migration order.

## Laith Alhaj Husain · Top-ups, checkout and financial records

- **Start on Day 1.** Build the admin top-up endpoint and merchant scanner lookup and redemption against the seeded pass. Send lookup, settlement and error examples to Tayma.
- **Build for the demo.** Own transaction and ledger migrations for top-ups, sales and wallet movements. In one sale transaction, validate the pass, debit the campaign reserve, post commission, accrue cashback and update milestone progress. Provide the marketer wallet and customer cashback dashboard data to Esmaeel and Alaa. Call Allaith's close operation when the cap is reached.
- **Verify.** Cover wrong-merchant rejection, concurrent or repeated redemption, lost-response retries, final-sale closure and balance reconciliation. Use the shared idempotency implementation for top-ups and settlement.
- **First extension.** Own cashback voucher issuance, cancellation and redemption once the core flow passes.

## Backlog ownership

- **Allaith** owns Backend registration, merchant verification, approval-based joining, merchant direct referrals, store-discount campaign pricing and configuration |.
- **Laith** owns Backend voucher and store-discount checkout, payout and receipt workflows, wallet reporting, statistics and leaderboard data |.

The shared rehearsal and integration checks are in `HACKATHON_TASKS.md`.
