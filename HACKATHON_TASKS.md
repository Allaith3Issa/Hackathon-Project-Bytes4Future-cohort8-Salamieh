# Affiliate Marketing Platform

**Team 3 · Three-day hackathon task split**

Build the web app and Android app against one NestJS REST API backed by PostgreSQL. Use `backend/` and `frontend/` in the web repo and the separate React Native repo for Android. All payments are simulated. Keep secrets in `.env` and use branches and pull requests for changes to `main`.

## Backend · NestJS and PostgreSQL

### Allaith Issa · Accounts, campaigns and integration

- **Accounts and verification.** Set up NestJS, PostgreSQL and Swagger. Build phone/password registration and login with a unique Syrian mobile number (`09` plus eight digits). Support merchant, marketer or both on the same account. Build admin verification and rejection, user and campaign lists, and enforce that only verified merchants can create campaigns.
- **Campaigns and plans.** Build campaign creation, browsing and details. Handle product data, image, price, discount, fixed or percentage commission, a future end date, optional item and budget limits, and join mode. Require commission plus fee to be below the final price. Lock price terms after launch. Enforce Free (three campaigns in the first month), Basic (10 per 30 days) and Pro (unlimited per 30 days), with simulated upgrades. Let active campaigns run after plan expiry.
- **Joining and attribution.** Handle join requests and merchant decisions, block self-promotion and duplicate pending requests, and issue one referral link per approved marketer per campaign. Resolve public links, record each opening and expose the offer or ended state.
- **Team lead.** Publish Swagger examples and seed demo accounts and a campaign. Agree on the payment and campaign data shared with Laith, review PRs and lead web and Android integration.

### Laith Alhaj Husain · Checkout, orders and reporting

- **Simulated checkout and limits.** Validate quantities from 1 to 10 and reject any purchase that exceeds the remaining limits. Count items and commission at payment and end the offer at expiry or when a limit is reached. Prevent duplicate sales and overselling when payments retry or overlap. Use whole SYP, round down the platform fee (3% of payment) and percentage commission as specified, and credit the remainder to the merchant.
- **In-store sale.** Credit wallets immediately and return receipt details and a QR token. Let the campaign owner look up a receipt and confirm handover once. Reject reuse.
- **Online orders.** Hold payment on Pending orders. Split funds on Accept, allow accepted orders to be marked Delivered, and issue a full simulated refund on Reject while restoring reserved items and commission budget.
- **Wallets and reporting.** Record every money movement and prevent negative wallet balances. Provide wallet histories, dashboard totals, campaign and marketer performance (including conversion rate), the earnings leaderboard with registration dates, and admin platform totals. Use shared click and payment records so both apps show consistent figures.

## Web and Android

### Alaa Esmail · Public and marketer web · Next.js

- **Web setup and sign-in.** Set up `frontend/`, the shared API client, public home, phone/password registration and login, and navigation for merchant, marketer and dual-role accounts. Share the authentication and navigation setup with Tayma.
- **Customer referral and checkout.** Build the public offer page with pricing, discount, end date and ended state. Add quantity selection, the simulated card form and success/failure states, the in-store receipt with QR, and the online order form with customer name, phone and address.
- **Marketer web.** Build campaign browse with search and filters, campaign details and join/request status, My Campaigns with copy/share and performance figures, wallet history, statistics, and the public leaderboard with the signed-in marketer’s rank highlighted.

### Tayma Watfa · Merchant and admin web · Next.js

- **Merchant campaigns and verification.** Build the dashboard with verification status, plan usage, wallet balance and performance totals. Build the campaign list, create form with pricing and payout preview, details with items and budget used, and marketer approval or rejection.
- **Merchant sales and plans.** Build receipt lookup with a camera QR scan or receipt-number entry and a handover confirmation. Build Orders with Accept, Reject and Mark as Delivered, wallet history, and the plan page with usage, upgrade and simulated payment.
- **Admin web.** Build merchant verification with shop details and approve/reject actions, lists of users and campaigns, and the platform overview with merchants, marketers, active campaigns, sales and fee income.

### Esmail Mahfoud · Marketer Android app · React Native

- **Account and navigation.** Build marketer registration and login, session handling and navigation to all marketer screens. Use the same backend API as the web app.
- **Campaigns and sharing.** Build browse with search and filters, campaign details with join or request and its status, and My Campaigns with copy and native share of the public web link. Show campaign status, clicks, sales and earnings.
- **Earnings and Android demo.** Build wallet history, statistics and the leaderboard with the marketer’s rank highlighted. Verify sign-in, link sharing and earnings updates on an Android emulator or device, and prepare a build for the demo.

## Three-day build and handoff

**Day 1 · Agree on data and build in parallel.** Allaith shares endpoint names, example responses, statuses and errors for sign-in, campaigns, joining, referrals, checkout, receipts, orders and wallets. Agree how rejected orders affect campaign reopening and how discounted prices round to whole SYP. Confirm the Basic and Pro demo prices. Alaa, Tayma and Esmail start screens against those examples while Allaith and Laith build the API.

**Day 2 · Run the first complete sale.** Verify a merchant, publish the demo campaign, approve a marketer, share the referral link from Android, pay on the website and confirm handover by receipt number. Check the same earnings on web and Android. Then connect online order acceptance and rejection, camera scan, plans and reporting.

**Day 3 · Finish, test and rehearse.** Complete all required screens and link them through navigation. Use focused PRs, review generated changes and have each owner run their flow against the shared API before merging. Rehearse the English demo with every member presenting their part.

### Demo checks

- **Verify and join.** A pending merchant cannot create a campaign. A verified merchant can publish one. Open joining gives a link immediately. Approval-required joining gives a link after approval.
- **Show one correct payout.** A 100,000 SYP item with a 10% discount costs 90,000 SYP. The marketer gets 10,000 SYP, the platform gets 2,700 SYP and the merchant gets 77,300 SYP. The owner can redeem the receipt once.
- **Test both order outcomes.** Pending payment leaves both wallets unchanged. An accepted order credits each wallet once. A rejected order refunds the full amount and releases the item and commission reservations.
- **Test limits and consistency.** An over-limit payment is rejected. An ended offer blocks checkout. The fourth Free-plan campaign is blocked. Wallets, sales totals and campaign status agree across web and Android wherever shown.

Source · *Affiliate Marketing Platform*, B4F Hackathon Team 3 project specification.
