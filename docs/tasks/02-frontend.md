# Web frontend tasks

Next.js and Tailwind CSS · Alaa Esmail and Tayma Watfa

## Alaa Esmail · Shared web foundation, public offer and customer pages

- **Start on Day 1.** Set up the Next.js app, Tailwind CSS, Arabic RTL layout and shared UI components. Own the typed API client, web session boundary and customer sign-in. Give Tayma the app shell and session interface.
- **Build for the demo.** Implement the referral offer page, customer sign-in and return to the offer, Offer QR and copyable code, and the cashback progress view. Use the API's prices, balances and milestone values.
- **Verify.** Open the link shared from Expo, generate the pass, and confirm the customer dashboard reflects the sale. Add the customer voucher UI only when the extension is ready.

## Tayma Watfa · Merchant and admin pages

- **Start on Day 1.** Build the admin top-up form, merchant campaign form and manual scanner against the shared examples. Use Alaa's app shell, API client and session interface.
- **Build for the demo.** Own admin sign-in and top-up, merchant pricing and reserve preview, campaign launch and closure, and manual code lookup and confirmation. Show the cash due before confirmation and the settlement breakdown afterward. Preserve the original request and key when retrying a campaign launch, top-up or scan.
- **Verify.** From the web, top up the merchant, launch the campaign, redeem Alaa's pass and confirm the unused reserve returns on closure. Add the merchant voucher flow only when the extension is ready.

## Implementation status and backlog ownership

- **Implemented but not fully verified:** Alaa's public and customer flows, including registration, and Tayma's admin verification, top-up, campaign, manual scanner, and revenue screens. See [implementation status](../handoff/IMPLEMENTATION_STATUS.md) for Tayma's separately prepared handoff and WEB-02.
- **Alaa's deferred work:** Customer vouchers, full marketer Web, and leaderboard. The current Web earnings screen remains available.
- **Tayma's deferred work:** Merchant voucher settlement, camera scanning, store-discount and approval controls, payouts and receipts, and broader admin reporting. Keep the existing partial voucher scanner UI.

The shared rehearsal and integration checks are in [HACKATHON_TASKS.md](../handoff/HACKATHON_TASKS.md#demo-checks).
