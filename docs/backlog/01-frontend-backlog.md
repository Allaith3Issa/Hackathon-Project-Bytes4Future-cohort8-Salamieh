# Frontend backlog · Alaa and Tayma

Next.js and Tailwind CSS

## When to start

Start backlog implementation after the [live Android and web rehearsal and backend integration checks](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/HACKATHON_TASKS.md#demo-checks) both pass. The core rehearsal covers top-up, campaign launch, Expo join and share, customer QR issuance, merchant redemption, commission and cashback updates, and reserve release. The backend checks cover retries, concurrent QR issuance and redemption, final-sale closure, and monetary limits.

## First · Cashback vouchers

**Intentionally deferred.** The merchant scanner has partial voucher UI. Customer voucher operations and the scanner's voucher API integration remain pending.

| Owner | Task |
| --- | --- |
| **Alaa Esmail** | Add customer voucher issuance and cancellation. Show the voucher QR, copyable manual code, active status, and the API’s available cashback balance. |
| **Tayma Watfa** | Extend the merchant scanner to look up a voucher, collect the bill total, and confirm redemption. Display the API’s cash due and merchant credit. Show a clear error if the bill is smaller than the voucher. |

Build both screens from the contract examples while Laith implements the endpoints. Test the two screens together once the API is ready.

**Acceptance check:** Issue a **50.00 new SYP** voucher and redeem it on a **200.00 new SYP** bill. The merchant receives **50.00 new SYP** and the screen shows **150.00 new SYP cash due**. Confirm that cancelling an unused voucher restores the available balance.

## Alaa · Remaining tasks

- Public registration is implemented and has reached main. Its browser-to-backend rehearsal is pending. See [implementation status](../handoff/IMPLEMENTATION_STATUS.md) for Web follow-ups.
- Continue the public web improvements and build the full marketer web workspace for campaigns, wallet, statistics, and payouts.
- Build the public leaderboard using Laith’s backend data.

## Tayma · Remaining tasks

- Admin merchant verification and revenue reporting screens are implemented. The separately prepared Merchant Dashboard, Wallet, and Scanner Recovery handoff still needs publication and verification on a shared branch.
- Add campaign approval controls and store-discount campaign and checkout screens when their API contracts are ready.
- Add camera scanning alongside the existing manual code entry.
- Build the deferred admin payout, receipt, and broader overview screens when the related APIs are ready.

**Suggested order after vouchers:** Coordinate deferred campaign and scanner work, then payouts and broader reporting as the API becomes available.

[API contract](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/API_CONTRACT.md) · [Frontend ownership](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/tasks/02-frontend.md)
