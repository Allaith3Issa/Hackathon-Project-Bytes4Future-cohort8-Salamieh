# Mardood | مردود

**Team 3 · Bytes4Future Hackathon · Salamiyah**

<img src="web/public/brand/mardood-logo.png" alt="Mardood logo" width="180">

## Overview

Mardood connects small shops, local marketers, and shoppers in Salamiyah. Merchants can measure which promotions bring customers into the shop even when payments happen in cash. A marketer shares an offer link, the customer issues a discount QR, and the merchant verifies it at checkout. Once the sale is confirmed, Mardood records the marketer's commission, the customer's cashback, and the campaign's remaining reserve.

## Team members

| Member | Role | Main contribution | GitHub |
| --- | --- | --- | --- |
| Allaith Issa | Team lead and backend | API contract, authentication, campaigns, referrals, migrations, and simulated payouts | [Allaith3Issa](https://github.com/Allaith3Issa) |
| Laith Alhaj Husain | Backend | Merchant top-ups, sale settlement, and financial records | [LaithHajHosin](https://github.com/LaithHajHosin) |
| Alaa Esmail | Web frontend | Public and customer experience, authentication, referral return, Arabic and English localization, and marketer Web flows | [AlaaIsmaiel04](https://github.com/AlaaIsmaiel04) |
| Tayma Watfa | Web frontend | Merchant and admin screens, campaign management, merchant wallet, and scanner recovery | [Tayma19](https://github.com/Tayma19) |
| Esmail Mahfoud | Android app | Marketer and merchant workspaces, scanner, and mobile API integration | [Esmaeel-Mahfoud](https://github.com/Esmaeel-Mahfoud) |

## Main features

| Role | What the app supports |
| --- | --- |
| Customer | Open a public referral offer, sign in or register, issue a QR discount card with a manual fallback code, and track cashback and purchases on Web. |
| Marketer | Discover and join open campaigns, share referral links, and view campaign performance and wallet activity on Web or Android. Submit simulated withdrawals and review their status on Web. |
| Merchant | Preview and launch product campaigns, upload product images, monitor wallet balances, settle cash sales using an Offer QR, and close campaigns to release unused reserves. |
| Admin | Verify merchants, top up merchant balances, review revenue and commissions, and approve or reject simulated withdrawals on Web. |

## Tech stack and project structure

| Directory | Responsibility | Technology |
| --- | --- | --- |
| [`api/`](api/) | REST API, authorization, financial rules and database migrations | NestJS, TypeScript, Prisma, PostgreSQL, Swagger, ImageKit |
| [`web/`](web/) | Public offers and role-specific dashboards in Arabic and English | Next.js App Router, React, TypeScript, Tailwind CSS |
| [`mobile/`](mobile/) | Android workspaces for merchants and marketers | Expo, React Native, Expo Router, TypeScript, Expo Camera |
| [`docs/`](docs/) | API contract, database design and team handoff | Markdown |

Web and mobile call the same NestJS API. The API owns pricing, permissions, campaign reserves and the financial ledger. Monetary amounts cross the API as integers in hundredths of one new Syrian pound. The Web app formats those values for the active language.

The source of truth for the API and data model is the [API contract](docs/handoff/API_CONTRACT.md) and [database ERD](docs/handoff/DATABASE_ERD.md). See the [Web design guide](web/design.md) and [Android handoff](mobile/HANDOVER.md) for each client.

## Prerequisites

- Git, npm, and a supported Node.js release. Use Node.js 24 for these instructions.
- PostgreSQL with a local database and a user who can create the project's tables.
- For Android, use an emulator or a physical device. Building locally with `expo run:android` also requires Android Studio, the Android SDK, and a JDK.
- An ImageKit account is needed to launch campaigns with uploaded images. The seeded offer and QR rehearsal can run without an ImageKit account.

## Environment variables

| File | Settings |
| --- | --- |
| [`api/.env.example`](api/.env.example) → `api/.env` | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` and `WEB_BASE_URL`. Set `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` for image uploads. The two `CASHBACK_MILESTONE_*` settings are optional. |
| [`web/.env.example`](web/.env.example) → `web/.env.local` | `API_BASE_URL` is server-only and includes `/api/v1`. Use `http://127.0.0.1:3000/api/v1` for the local API. |
| [`mobile/.env.example`](mobile/.env.example) → `mobile/.env` | `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` are origins without `/api/v1`. Keep `EXPO_PUBLIC_USE_DEV_SANDBOX=false` when testing against NestJS. |

For the setup below, use `PORT=3000` and `WEB_BASE_URL=http://localhost:3002` in the API environment. The API uses `WEB_BASE_URL` to build shareable offer links. Keep database credentials, signing secrets, and ImageKit private keys in local environment files or the host's secret store.

## Installation

The commands use Bash or Git Bash. Install dependencies separately in each app.

```bash
git clone https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh.git
cd Hackathon-Project-Bytes4Future-cohort8-Salamieh
(cd api && npm ci && cp -n .env.example .env)
(cd web && npm ci && cp -n .env.example .env.local)
(cd mobile && npm ci && cp -n .env.example .env)
```

## Database migration and seed

Complete this required step after installation and before starting the backend. The seed populates the database; it does not create the database schema or replace migrations.

### 1. Create and configure the database

Create an empty local PostgreSQL database named `affiliate_marketing_demo` using pgAdmin or another PostgreSQL client. Set `DEMO_DB_URL` in the commands below to its connection URL. Replace `DB_USER` and `DB_PASSWORD` with your local PostgreSQL credentials and URL-encode special characters in the password.

### 2. Apply database migrations

From the repository root, run the following in Bash or Git Bash:

```bash
cd api
DEMO_DB_URL='postgresql://DB_USER:DB_PASSWORD@127.0.0.1:5432/affiliate_marketing_demo'
DATABASE_URL="$DEMO_DB_URL" npx --no prisma migrate deploy --config prisma7.config.ts
DATABASE_URL="$DEMO_DB_URL" npx --no prisma migrate status --config prisma7.config.ts
DATABASE_URL="$DEMO_DB_URL" npx --no prisma generate --config prisma7.config.ts
```

`migrate deploy` applies all committed pending migrations in order, including `0003_payout_movement_kinds` and `0004_simulated_marketer_payouts`, which are required for simulated withdrawals. Confirm that the migration status is up to date before proceeding. For an existing database, back up the data and verify that there are no unexplained nonzero pending payout balances before applying the payout migrations. Do not use `migrate reset` or `db push` for evaluator setup.

### 3. Seed the demo database

Continue in the same Bash terminal inside `api/`. The standalone seed uses `DEMO_SEED_DATABASE_URL`. The empty process-scoped `DATABASE_URL` on the seed command keeps it separate from the normal development database.

```bash
NODE_ENV=development DATABASE_URL= ALLOW_DEV_DEMO_SEED= \
  DEMO_SEED_DATABASE_URL="$DEMO_DB_URL" \
  DEMO_ADMIN_PASSWORD='B4F-Local-Admin-53!' \
  DEMO_ACCOUNT_PASSWORD='B4F-Local-User-53!' \
  npm run db:seed
```

The seed creates a scanner fixture and separate accounts for a complete campaign rehearsal. Rerunning it preserves existing demo data and passwords. Start with a fresh demo database to reproduce the initial state. Use these demo credentials only in a local evaluation environment. [Seed details and fixtures](api/prisma/DEMO_SEED.md)

## Backend setup and run

After migration and seeding, set `DATABASE_URL` in `api/.env` to the demo database URL. Set a local `JWT_SECRET` using the output of `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Confirm that `WEB_BASE_URL` matches the actual Web origin.

```bash
cd api
npm run start:dev
```

The API base URL is `http://127.0.0.1:3000/api/v1`. Check readiness at [`/api/v1/health`](http://127.0.0.1:3000/api/v1/health). For release builds, run `npm run build` followed by `npm start`. Apply the available migrations before starting the release, including `0003_payout_movement_kinds` and `0004_simulated_marketer_payouts` for withdrawals. [Backend deployment guide](api/DEPLOYMENT.md)

## Frontend setup and run

Set `API_BASE_URL=http://127.0.0.1:3000/api/v1` in `web/.env.local` and start Next.js in another terminal.

```bash
cd web
npm run dev -- --port 3002
```

Open [Mardood in Arabic](http://localhost:3002/ar) or [Mardood in English](http://localhost:3002/en). The main entry points are [customer and marketer sign-in](http://localhost:3002/ar/login), [merchant sign-in](http://localhost:3002/ar/merchant/login), and [admin sign-in](http://localhost:3002/ar/admin).

## Mobile setup and run

For an Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` and `EXPO_PUBLIC_WEB_URL=http://10.0.2.2:3002` in `mobile/.env`. For a physical device, use the computer's reachable LAN address or hosted HTTPS origins. Use the same public-facing Web origin in the API's `WEB_BASE_URL` so a referral shared from Android opens on the recipient's device. When testing over the LAN, start the Web app with `--hostname 0.0.0.0` and make both ports reachable from the device.

```bash
cd mobile
npx expo run:android
# Start Metro on subsequent sessions after installing the development build.
npx expo start --dev-client -c
```

Allow camera access in the merchant scanner to scan a QR, or enter the manual code. For an installable Android preview build, configure the reachable API and Web origins in the EAS build environment and run `npx eas-cli build --profile preview --platform android`. [Android build instructions](mobile/README.md)

## Backend API overview

The paths below are relative to `/api/v1`. Protected routes use bearer authentication and enforce the required role on the API. Use a new UUID `Idempotency-Key` for each new supported financial operation and reuse that same key when retrying the same request.

| Area | Key routes |
| --- | --- |
| Health and authentication | `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/admin/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` |
| Campaign discovery and referrals | `GET /campaigns`, `GET /campaigns/{campaignId}`, `POST /marketer/campaigns/{campaignId}/join`, `GET /marketer/memberships`, `GET /public/referrals/{code}` |
| Merchant campaigns and scanner | `POST /merchant/uploads/image`, `POST /merchant/campaigns/preview`, `POST /merchant/campaigns`, `POST /merchant/campaigns/{campaignId}/close`, `POST /merchant/scanner/lookup`, `POST /merchant/scanner/redeem-offer` |
| Customer and wallets | `POST /customer/referrals/{code}/offer-qr`, `GET /customer/dashboard`, `GET /customer/purchases`, `GET /merchant/wallet`, `GET /marketer/wallet`, `GET /marketer/wallet/transactions` |
| Admin and payouts | `PATCH /admin/merchants/{merchantId}/verification`, `POST /admin/merchants/{merchantId}/topups`, `GET /admin/revenue/summary`, `GET /admin/revenue/marketers`, `GET` and `POST /marketer/payouts`, `GET /admin/payouts`, `PATCH /admin/payouts/{payoutId}/approve`, `PATCH /admin/payouts/{payoutId}/reject` |

### Swagger documentation

Open [Swagger UI](http://127.0.0.1:3000/api/docs) for request and response schemas, authentication, and errors. To try a protected operation, sign in using its role's login endpoint and use the returned access token in **Authorize**.

### Postman collection

Import the running API's [OpenAPI JSON](http://127.0.0.1:3000/api/docs-json) into Postman to generate a collection with the operations served by that build. For requests whose path includes `/api/v1`, set `baseUrl` to `http://127.0.0.1:3000`. Keep access tokens in a private `token` environment variable and use `{{token}}` for Bearer authorization. Export as **Collection v2.1** without tokens or passwords. A standalone collection export is not tracked in this repository.

## Demo accounts

These credentials are for a fresh local database seeded with the exact command above.

| Scenario | Account | Phone | Password |
| --- | --- | --- | --- |
| Both | Demo Admin | `0999100001` | `B4F-Local-Admin-53!` |
| Full campaign | Live Merchant | `0999100002` | `B4F-Local-User-53!` |
| Full campaign | Live Marketer | `0999100003` | `B4F-Local-User-53!` |
| Full campaign | Live Customer | `0999100004` | `B4F-Local-User-53!` |
| Scanner | Scanner Merchant | `0999100005` | `B4F-Local-User-53!` |
| Scanner | Scanner Marketer | `0999100006` | `B4F-Local-User-53!` |
| Scanner | Scanner Customer | `0999100007` | `B4F-Local-User-53!` |

### Demo URL and walkthrough

The local demo is available at [`http://localhost:3002`](http://localhost:3002) after starting both services. A public hosted demo URL has not been verified.

1. Open the [seeded Maamoul offer](http://localhost:3002/r/mk-demo01) as **Scanner Customer** and issue the discount card. The seeded manual code is `OF-DEMO01`.
2. In a separate session, sign in as **Scanner Merchant** and open [Merchant Scanner](http://localhost:3002/ar/merchant/scanner). Look up the QR or manual code, verify the cash amount, and confirm the sale.
3. Review the purchase and cashback in [Customer Dashboard](http://localhost:3002/ar/customer). Sign in as **Scanner Marketer** to see the commission and request a simulated withdrawal in [Marketer Earnings](http://localhost:3002/ar/marketer/earnings).
4. Sign in as **Demo Admin** to review the request in [Admin Payouts](http://localhost:3002/ar/admin/payouts).
5. To rehearse from the beginning with different accounts, use the Live fixtures for admin top-up, merchant launch, marketer join and referral share, customer discount card, settlement, and campaign closure.

### Mobile APK or Expo link

Use the Android development build or the EAS preview build above. A public APK download or Expo preview link has not been verified.

## Verification

```bash
(cd api && npm run lint && npm test)
(cd web && npm run build && npm run typecheck)
(cd mobile && npx tsc --noEmit && npm run lint)
```

Database integration tests require suite-specific URLs for fresh loopback databases. See the [backend test and readiness notes](api/DEPLOYMENT.md#verification-and-recovery) and the [Web feature coverage](web/FEATURE-COVERAGE.md).

## Known limitations

- The demo supports product campaigns with open joining, fixed commission, and in-store cash checkout. Cashback voucher redemption and real-money payouts are outside this release.
- Payout requests and admin decisions are Web flows. The app needs a backend build with the payout endpoints and both payout migrations. See [PR #53](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/pull/53) for the integration status.
- The mobile app supports the marketer and merchant workspaces. Customer discount cards and admin workflows use Web.
- New campaign image uploads require the API's ImageKit configuration. The clean seed uses a placeholder image for its built-in offer.
