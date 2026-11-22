# Affiliate Marketing Platform
**Team 3 · Three-day hackathon task split**

## Required demo

Use seeded accounts and one NestJS API with PostgreSQL. Admin tops up a verified merchant. The merchant launches an open product campaign with fixed commission and one item per sale. The marketer joins and shares from Expo. The customer obtains an Offer QR from the web. The merchant enters the human-readable code, confirms cash payment and sees settlement. Expo shows the credited commission and web shows customer cashback. Closing releases the remaining reserve.

## Backend · NestJS and PostgreSQL

### Allaith Issa · Accounts, campaigns, reserves and referrals
- Own the shared API contract, migrations and demo seed. Supply login, campaign preview and launch, open join, referral resolution and Offer QR issuance.
- Own campaign close and reserve release. Give Laith the shared operation for calling from settlement on cap exhaustion.
- Publish the [shared demo seed and API examples](API_CONTRACT.md#shared-demo-seed-and-api-examples) on Day 1. Coordinate integration and lead the rehearsal.

### Laith Alhaj Husain · QR settlement, top-ups and ledger
- Implement admin top-up and merchant lookup/redemption. Start against a seeded pass while issuance is in progress.
- Own the atomic sale, reserve debit, commission credit, cashback accrual and ledger. Persist replay keys and results with the mutation.
- After the core flow passes, implement voucher issue, cancellation and redemption as the first extension. Core settlement still updates milestone counters and unlocks when the fixed threshold is reached.

## Web and Android

- **Alaa Esmail** owns the Next.js session boundary and shared typed client, public offer, customer sign-in, QR plus selectable code, and cashback progress. Hand off the session interface to Tayma on Day 1.
- **Tayma Watfa** owns admin top-up and merchant campaign creation, preview, manual scanner and closure. Reuse the campaign launch key after a lost response. Show cash before confirmation and the settlement breakdown after success.
- **Esmail Mahfoud** owns Expo login, browse/join, native sharing and the commission balance. Validate the API and web URLs from the Android demo device on Day 1.

## Three-day build and handoff

Use the [roadmap](HACKATHON_ROADMAP.md) for checkpoints and the [contract](API_CONTRACT.md#demo-operation-rules-and-shared-examples) for shared fixtures. Work on feature branches and integrate via focused pull requests. Keep secrets out of source control.

## Backlog and first extension

After the core demo is green, rehearse a voucher using the customer in the shared seed who is one purchase away from unlocking 5,000 SYP. Future work includes store-wide discounts, approval mode, camera scanning, merchant direct referrals, full marketer web, payout receipt workflows, leaderboards and broad reporting.

### Demo checks

#### Live Android and web rehearsal

1. Start with 100,000 SYP. Launch fails because the reserve is 435,000 SYP. Top up 400,000 SYP, launch, and verify 65,000 SYP available.
2. Join and share from Expo. Open the link on the customer web flow, issue a pass, enter the code on the merchant web scanner, and confirm the 90,000 SYP sale. Verify commission 10,000, cashback 1,800, net platform fee 2,700 and reserve 420,500 SYP. Confirm the updated marketer balance in Expo and the cashback progress on the customer page.
3. Close the campaign from merchant web and verify 485,500 SYP available and zero locked.

#### Backend integration tests

4. Simulate a lost redemption response by committing the sale and discarding its response. Retry with the same key and payload and get the original result. Submit the same code with a fresh key and get `QR_ALREADY_REDEEMED`. Verify two concurrent redemption requests with different keys settle only one sale. Close the campaign twice and check that the second close adds no wallet credit.
5. In an independent fixture with funds for two reserves, retry a successful launch with the same request and key. Verify one campaign and one reserve debit. A changed valid payload with the same key returns `IDEMPOTENCY_KEY_REUSED`.
6. Request the same customer’s Offer QR twice concurrently before redemption. Verify both responses return the same pass ID and code.
7. Use a separate campaign capped at one item. Verify the final sale returns `ended` and zero remaining reserve. Retry the sale with the original key and verify the original response and unchanged balances. Explicitly close it and verify that the close adds no wallet credit.
8. Run the [monetary boundary example](API_CONTRACT.md#demo-operation-rules-and-shared-examples). Verify the rejected launch writes no financial state.

#### Voucher extension

9. In the live extension, redeem the customer's fifth qualifying Offer QR to unlock 5,000 SYP. Issue a 5,000 SYP voucher, redeem it at the second verified merchant on a 20,000 SYP bill, and show 15,000 SYP cash due and the merchant's 5,000 SYP credit. In an independent backend fixture, issue a 5,000 SYP voucher from 10,000 SYP available. Retry issuance with the same key and verify the same voucher and 5,000 SYP still available. Try a 3,000 SYP bill and verify the voucher stays active. Redeem against a 20,000 SYP bill and verify 15,000 SYP cash due and one 5,000 SYP credit to the second merchant. With a separate unused voucher, verify cancellation restores its reservation once.
