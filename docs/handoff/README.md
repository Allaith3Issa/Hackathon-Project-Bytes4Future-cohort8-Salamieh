# Affiliate Marketing Platform — Team 3 (Salamiyah Launch)

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo.

Local affiliate marketing and cashback platform connecting small businesses in Salamiyah with local micro-influencers and everyday shoppers.

## Core Architecture & Tech Stack

- **Web Frontend (`web/`)**: Next.js + TypeScript (Arabic RTL)
- **Backend API (`api/`)**: NestJS + TypeScript + Swagger (`/api/v1`)
- **Database**: PostgreSQL (single source of truth; no direct DB access from web or mobile)
- **Mobile App (separate repo)**: React Native with Expo + TypeScript (Marketer Android app)
- **Payments Model**: Cash-in-store at checkout + Prepaid Merchant Platform Balance (SYP) + Closed-loop Customer Cashback Vouchers + Admin-verified Sham Cash / manual payouts for marketers
- **Demo access**: Agree on the API and public web URLs on Day 1 and verify both on the Android device.

## Day 1 handoff

Use the [shared demo seed and API examples](API_CONTRACT.md#shared-demo-seed-and-api-examples). Rehearse the normal flow on [Android and web](HACKATHON_TASKS.md#live-android-and-web-rehearsal) and run the [backend integration tests](HACKATHON_TASKS.md#backend-integration-tests) for retries, concurrency and monetary limits.

## Documentation Index

- [Project Specification](Affiliate%20Marketing%20Platform.md) — Full product overview, roles, scenarios, business rules, screens, flows, and formulas
- [Database ERD](DATABASE_ERD.md) — PostgreSQL schema, ledger buckets, and consistency invariants
- [API Contract](API_CONTRACT.md) — Shared REST v1 contract for Next.js and React Native (Expo)
- [Team Task Split](HACKATHON_TASKS.md) — Responsibilities across backend, web, and mobile
- [Three-Day Roadmap](HACKATHON_ROADMAP.md) — Parallel build plan and checkpoints
- [Backend Agent Instructions](backend/AGENTS.md) — NestJS implementation and security rules
- [Frontend Agent Instructions](frontend/AGENTS.md) — Next.js implementation and Arabic RTL rules
- [Frontend Design Guide](../../web/design.md) — Color tokens, typography, and screen layouts
