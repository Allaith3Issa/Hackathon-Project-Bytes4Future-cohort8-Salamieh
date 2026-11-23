# Backend backlog · Allaith and Laith

NestJS and PostgreSQL

## When to start

Start backlog implementation after the [live Android and web rehearsal and backend integration checks](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/HACKATHON_TASKS.md#demo-checks) both pass. The core rehearsal covers top-up, campaign launch, Expo join and share, customer QR issuance, merchant redemption, commission and cashback updates, and reserve release. The backend checks cover retries, concurrent QR issuance and redemption, final-sale closure, and monetary limits.

## First · Cashback vouchers

- **Laith Alhaj Husain** owns issuance, cancellation, and redemption. Reserve cashback once at issuance, release it on cancellation, and credit the redeeming merchant once. Keep the voucher active if the bill is smaller than its value.
- **Allaith Issa** coordinates the voucher contract and demo seed with Laith. Publish the request and response examples so Alaa and Tayma can build in parallel, then help run the live rehearsal.

**Acceptance check:** A customer issues a **50.00 new SYP** voucher and a second verified merchant redeems it on a **200.00 new SYP** bill. In minor units, the API returns `customerPaidCashSyp: 15000` and credits the merchant once for `5000` (50.00 new SYP). Integration tests cover issuance retries, rejected redemption, duplicate redemption, and cancellation restoring the reservation once.

## Allaith · Remaining tasks

- Implement registration and merchant verification. Hand their API examples to Alaa and Tayma.
- Implement approval-based joining and merchant direct referrals.
- Own store-discount campaign pricing, configuration, and preview. Agree on the discounted cash cap and reserve calculations with Laith before checkout integration.

## Laith · Remaining tasks

- Implement store-discount checkout using the agreed pricing and cap rules.
- Implement payout requests, transfer receipts, and dispute resolution before the web and Expo payout integrations.
- Provide wallet reporting, statistics, and leaderboard data for web and mobile.

**Suggested order after vouchers:** Registration and verification first, then campaign and checkout extensions, then payouts and reporting. Each team can start UI work from agreed examples while the backend work is underway.

[API contract](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/API_CONTRACT.md) · [Backend ownership](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/tasks/01-backend.md)
