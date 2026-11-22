# Three-day hackathon roadmap
**Team 3 · Affiliate Marketing Platform**

## Day 1 · Freeze the contract and work in parallel

In the first hour, Allaith and Laith agree on the pricing and close operations, lock order and replay behavior. Allaith publishes the [shared demo seed and API examples](API_CONTRACT.md#shared-demo-seed-and-api-examples) for the backend, web and Expo. Include the verified merchant, marketer, customer and a pre-issued Offer QR for the scanner team. Decide the public web and API URLs and exercise both from the Android demo device.

| Member | Build and handoff |
| --- | --- |
| Allaith Issa | Migrations, seed, login, campaign preview and launch, open join, referral and Offer QR issuance. Share the campaign-close operation with Laith early. |
| Laith Alhaj Husain | Top-up and atomic lookup/redemption using a seeded pass. Share normal and error responses with Alaa and Tayma. |
| Alaa Esmail | Build the Arabic web shell, login and offer/customer screens against fixtures. Hand the web session interface to Tayma. |
| Tayma Watfa | Build top-up, campaign preview/launch and manual scanner against fixtures. |
| Esmail Mahfoud | Build Expo login, browse/join/share and wallet balance. Confirm the shared link opens the actual web offer from Android. |

**Checkpoint.** All apps run and Android reaches both URLs. A seeded redemption credits commission and accrues cashback.

## Day 2 · Run the core demo live

Connect the live sequence from top-up through campaign launch, Expo share, web QR issuance, manual settlement, balance updates and reserve release. Allaith and Laith pair on transaction boundaries and replay behavior. Alaa and Tayma confirm the same code works from issuance through redemption. Esmail confirms the wallet refreshes against the live API.

**Checkpoint.** Pass the [live Android and web rehearsal](HACKATHON_TASKS.md#live-android-and-web-rehearsal) on the real clients. Run the [backend integration tests](HACKATHON_TASKS.md#backend-integration-tests) against an isolated database to verify retries, concurrency, final-sale closure, and the monetary boundary. Begin the voucher extension after both pass.

## Day 3 · Verify, freeze and rehearse

Rerun the backend integration tests after merging. Cover wrong-merchant rejection and expiry closure. Check Arabic error states and rehearse the normal flow with the Android build, web client, final URLs and clean seed data. Use the final two hours for critical fixes only. Include the voucher segment only if its issue, cancellation and redemption checks pass.

## How to hand work over

Share focused PRs with working routes or screens, sample IDs and test steps. Raise mismatches with Allaith before adapting clients independently.

## Hosting & deployment checkpoint

Choose a reachable API and public Next.js URL on Day 1. Configure the backend's public web base URL for referral generation. Verify Android and the Next.js server can reach the API, and verify a clean demo seed before the rehearsal.
