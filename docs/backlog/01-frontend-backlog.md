# Frontend backlog · Alaa and Tayma

Next.js and Tailwind CSS

## When to start

Start backlog implementation after the [live Android and web rehearsal and backend integration checks](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/HACKATHON_TASKS.md#demo-checks) both pass. The core rehearsal covers top-up, campaign launch, Expo join and share, customer QR issuance, merchant redemption, commission and cashback updates, and reserve release. The backend checks cover retries, concurrent QR issuance and redemption, final-sale closure, and monetary limits.

## First · Cashback vouchers

| Owner | Task |
| --- | --- |
| **Alaa Esmail** | Add customer voucher issuance and cancellation. Show the voucher QR, copyable manual code, active status, and the API’s available cashback balance. |
| **Tayma Watfa** | Extend the merchant scanner to look up a voucher, collect the bill total, and confirm redemption. Display the API’s cash due and merchant credit. Show a clear error if the bill is smaller than the voucher. |

Build both screens from the contract examples while Laith implements the endpoints. Test the two screens together once the API is ready.

**Acceptance check:** Issue a **5,000 SYP** voucher and redeem it on a **20,000 SYP** bill. The merchant receives **5,000 SYP** and the screen shows **15,000 SYP cash due**. Confirm that cancelling an unused voucher restores the available balance.

## Alaa · Remaining tasks

- Build the public customer registration form once Allaith publishes the registration contract.
- Continue the public web improvements and build the full marketer web workspace for campaigns, wallet, statistics, and payouts.
- Build the public leaderboard using Laith’s backend data.

## Tayma · Remaining tasks

- Build the admin merchant verification views with Allaith.
- Add campaign approval controls and store-discount campaign and checkout screens when their API contracts are ready.
- Add camera scanning alongside the existing manual code entry.
- Build the admin payout, receipt, and reporting pages using Laith’s API.

**Suggested order after vouchers:** Registration and verification first. Then coordinate campaign and scanner work. Build payout and reporting screens once the corresponding API examples are available.

[API contract](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/API_CONTRACT.md) · [Frontend ownership](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/tasks/02-frontend.md)
