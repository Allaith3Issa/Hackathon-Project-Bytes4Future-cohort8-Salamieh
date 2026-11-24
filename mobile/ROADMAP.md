# Mobile App Development Roadmap (`hackathon-mobile/`)

> **Canonical Sources**: `../Hacjathon file/docs/tasks/03-mobile.md`, `../Hacjathon file/docs/handoff/API_CONTRACT.md`, `../Hacjathon file/docs/handoff/frontend/design.md`, and `AGENTS.md`.
> **Rule**: Build strictly in order (`Phase 0` → `Phase 1` → `Phase 1.5` → `Phase 2` → `Phase 3.1` → `Phase 3.2` → `Phase 4`). Do not modify code outside the current step.

---

## Phase 0 — Engineering Foundation & Design System (Completed)

- [x] **0.1 — Project Audit & Expo SDK 58 Alignment**: Verified SDK 58 configuration, `IBM Plex Sans Arabic`, warm palette (`#FBF7F2` / `#B54718` / `#503C44`), `predictiveBackGestureEnabled`, and Mardood brand splash/icon assets.
- [x] **0.2 — Packages & Fonts**: Installed `expo-secure-store`, `expo-haptics`, `expo-clipboard`, `expo-dev-client`, and loaded `IBMPlexSansArabic-{Regular,SemiBold,Bold}.ttf`.
- [x] **0.3 — Engineering Core (`src/core/`)**: `theme/`, `i18n/`, `rtl/`, `config/`, `auth/`, `api/` (single-flight refresh mutex), `cache/` (SWR), `navigation/` (`useAndroidBack`), `dev/` (isolated Dev Sandbox).
- [x] **0.4 — Reusable UI Primitives (`src/components/ui/`)**: `AppButton`, `AppInput`, `BalanceCard`, `CampaignCard`, `StatusBadge`, `SkeletonBlock`, `BrandMark`, `BrandSplashOverlay`.

---

## Phase 1 — Marketer MVP (Completed)

- [x] **1.1 — Marketer Sign-In & Session Protection**: `(auth)/login.tsx`, `(auth)/index.tsx`, `(auth)/_layout.tsx`, `SecureStore` tokens, automatic session restore via `/auth/me` or `/auth/refresh`.
- [x] **1.2 — Marketer Tab Shell & Active Campaigns Browse**: 3-tab bottom bar (`Campaigns`, `Wallet`, `Profile`), merged `GET /campaigns` + `GET /marketer/memberships` via `Map`, skeletons, empty/error states, pull-to-refresh.
- [x] **1.3 — Campaign Details, Open Join & Native Share**: `GET /campaigns/:id`, `POST /marketer/campaigns/:id/join` with `Set` dedupe, optimistic rollback, native `Share.share` + clipboard copy.
- [x] **1.4 — Marketer Wallet & Balance Refresh**: `#503C44` balance card from `GET /marketer/wallet` with focus, pull-to-refresh, and `AppState` resume refresh.
- [x] **1.5 — Marketer Profile, Settings & Language Switcher**: Account summary, AR (RTL) ↔ EN (LTR) switcher, clean sign-out (`POST /auth/logout` + `SecureStore` & SWR wipe).

---

## Phase 1.5 — Shared Foundation Upgrade: Minor Units, Idempotency & Strict Role Isolation

**Goal**: Align shared currency formatting/parsing with the backend's Minor Units update (`100 = 1.00 new SYP`), add `Idempotency-Key` support and full API error localization, and physically separate `(marketer)` and `(merchant)` routes/features without breaking existing Marketer MVP screens.

- [x] **1.5.1 — Minor Units, Idempotency & Error Dictionary**:
  - Update `formatSyp` in `src/core/rtl/format.ts` to format backend Minor Units (`scale 100`, integer quotient & remainder, up to 2 fractional digits) and add `parseNewSypToMinorUnits` (pure integer parsing for Merchant inputs).
  - Add `src/core/api/idempotency.ts` (`createIdempotencyKey()` generating 36-char UUID v4).
  - Expand `src/core/api/errors.ts` and `src/core/i18n/{types,ar,en}.ts` with all Merchant/Scanner/Registration error codes (`MERCHANT_NOT_VERIFIED`, `INSUFFICIENT_MERCHANT_BALANCE`, `INSUFFICIENT_LOCKED_BUDGET`, `QR_ALREADY_REDEEMED`, `QR_EXPIRED`, `AMOUNT_OUT_OF_RANGE`, `IDEMPOTENCY_KEY_REUSED`, `PHONE_ALREADY_REGISTERED`, `VOUCHER_EXCEEDS_BILL`, `INSUFFICIENT_WALLET_BALANCE`, `INSUFFICIENT_CASHBACK_BALANCE`).
  - Sync `src/core/dev/sandboxAdapter.ts` seed values to Minor Units (`90000`, `10000`, `100000`, `OF-DEMO01`).
- [x] **1.5.2 — Dual-Role Auth Guard & Strict Route/Feature Isolation**:
  - Upgrade `src/core/auth/` (`hasMarketerRole`, `hasMerchantRole`, `hasSupportedMobileRole`, `activeRole` state, `switchWorkspaceRole` for dual-role users, rejecting `customer`-only or `admin`-only accounts).
  - Namespace SWR cache keys by `${userId}:${role}:...` and clear cache on role switch/logout.
  - Refactor Marketer routes into `src/app/(marketer)/` and Marketer domain logic into `src/features/marketer/{campaigns,wallet}/`.
  - Enforce 3 isolated `Stack.Protected` groups in `src/app/_layout.tsx`: `(auth)`, `(marketer)`, `(merchant)` (with initial `(merchant)/_layout.tsx` entry shell).
  - Add isolated Merchant demo account (`0999100002`) to `Dev Sandbox`.

---

## Phase 2 — Unified Auth Registration & Complete Merchant Workspace (Backend-Ready)

**Goal**: Deliver account registration (`POST /auth/register`) and the complete Merchant mobile experience wired 100% to endpoints currently implemented in `api/src/`.

- [x] **2.0 — Unified Login & Account Registration (`POST /auth/register`)**:
  - Update `(auth)/login.tsx` copy for both Marketer & Merchant + dev-only quick sign-in buttons for both roles.
  - Implement `(auth)/register.tsx` matching `RegisterDto` (`name`, isolated-LTR `phone`, `password`, role selector `marketer` / `merchant` / both, and animated conditional `shop: { name, details }` required only when `merchant` is selected).
- [x] **2.1 — Merchant Tab Shell, Dashboard & Shop Profile**:
  - Build `src/app/(merchant)/(tabs)/_layout.tsx` with 5 tabs (`Dashboard`, `Campaigns`, `Scanner`, `Wallet`, `Profile`) and >= `48dp` Android touch targets.
  - Build `(merchant)/(tabs)/index.tsx` wired to `GET /merchant/dashboard` (verification status badge & unverified banner, available vs. locked balance cards, quick actions to Create Campaign & Scan QR, performance stats, top campaign highlight).
  - Build `(merchant)/(tabs)/profile.tsx` showing shop details (`merchant.name`, `details`, `verificationStatus`, `contractReference`), AR/EN language toggle, role switcher (rendered **only** if `user.roles` contains both `marketer` and `merchant`), and clean sign-out.
- [x] **2.2 — Merchant Wallet & Transaction Ledger**:
  - Implement `src/features/merchant/wallet/` and `(merchant)/(tabs)/wallet.tsx` wired to `GET /merchant/wallet` and `GET /merchant/wallet/transactions` (available vs. locked reserves, paginated ledger for all 5 movement kinds, pull-to-refresh, focus & `AppState` resume refresh).
- [x] **2.3 — Merchant Campaigns List, Detail & Campaign Closure**:
  - Implement `src/features/merchant/campaigns/` list/detail/close flows.
  - Build `(merchant)/(tabs)/campaigns.tsx` (`GET /merchant/campaigns` with status filter `all` / `active` / `ended`, sales progress, remaining `lockedBudgetSyp`, pagination).
  - Build `(merchant)/campaigns/[id].tsx` (`GET /merchant/campaigns/:id` + `POST /merchant/campaigns/:id/close` with explicit confirmation modal, duplicate-tap `Set` guard, reserve-release cache invalidation, and `directReferralUrl` copy/share when non-null).
- [x] **2.4 — Create Product Campaign & Live Server Preview**:
  - Implement `(merchant)/campaigns/new.tsx` supporting `product` + `fixed` commission + `open` join mode.
  - Auto-trigger debounced `POST /merchant/campaigns/preview` with `AbortController` to display backend `finalPriceSyp`, `worstCaseReserveSyp`, per-sale split, and `isAffordableByMerchant` (zero frontend arithmetic).
  - Submit `POST /merchant/campaigns` with payload-bound `Idempotency-Key` UUID stability (reuses key on network retry for identical payload; rotates key when any field changes).
- [x] **2.5 — Merchant Real Camera QR Scanner & Sale Settlement**:
  - Install `expo-camera` via `npx expo install expo-camera` and configure camera permission plugin in `app.json` (CNG).
  - Implement `src/features/merchant/scanner/` (`POST /merchant/scanner/lookup` + `POST /merchant/scanner/redeem-offer` with code-bound `Idempotency-Key` UUID stability).
  - Build `(merchant)/(tabs)/scanner.tsx` with focus-aware `CameraView` QR scanning, instant duplicate-scan cooldown, always-available manual code input (`OF-...`), graceful permission-denied fallback, pre-confirmation cash-due preview card, settlement breakdown card, and automatic campaign-closed alert (`campaignStatusAfterSale === 'ended'`).

---

## Phase 3 — Marketer Reporting Extensions (Backend-Ready Now)

**Goal**: Connect the Marketer reporting endpoints already implemented in `api/src/reporting/marketer-reporting.controller.ts` strictly inside `(marketer)/`.

- [x] **3.1 — Marketer Wallet History, Per-Merchant Breakdown & Stats**:
  - Wire `GET /marketer/wallet/transactions`, `GET /marketer/wallet/by-merchant`, and `GET /marketer/stats` in `src/features/marketer/wallet/` and `(marketer)/(tabs)/wallet.tsx`.
  - Visually separate `availableBalanceSyp`, `pendingPayoutSyp`, and `totalEarnedSyp` and display clicks, items sold, and conversion rate.

- [ ] **3.2 — Customer Workspace (Backend-Ready Now)**:
  **Goal**: Add full `customer` role support strictly isolated under `src/app/customer/` and `src/features/customer/`, wired to existing `api/src/` endpoints (`auth/register`, `public/referrals/:code`, `public/referrals/:code/clicks`, `customer/referrals/:code/offer-qr`, `customer/dashboard`, `customer/purchases`), without building unimplemented Backlog voucher UIs (`Phase 4.3`).
  - [ ] **3.2.1 — Core Auth, QR Display Primitive, i18n & Dev Sandbox (`Core/QR/i18n`)**:
    - Install SDK-58-compatible QR SVG renderer (`react-native-svg` + `react-native-qrcode-svg`) via `npx expo install` (verified with `npx expo-doctor`) and create `src/components/ui/QrCodeBox.tsx`.
    - Expand `MobileWorkspaceRole` to `'customer' | 'marketer' | 'merchant'` (`src/core/auth/`), add `hasCustomerRole`, update `hasSupportedMobileRole` (still rejecting `admin`-only accounts cleanly), and update `tokenStorage` / `AuthContext` for 3-role persistence.
    - Add full bilingual `ar.ts` and `en.ts` customer/QR/auth/error keys (including `SELF_PROMOTION_FORBIDDEN`, `CAMPAIGN_ENDED`) with strict `ar`/`en` key parity, plus isolated Demo Customer (`0999100004` / `0999100007`) & customer endpoint handlers in `src/core/dev/sandboxAdapter.ts` (`__DEV__ && EXPO_PUBLIC_USE_DEV_SANDBOX === 'true'`).
  - [ ] **3.2.2 — Multi-Role Auth, Register, Root Guard & Workspace Switcher (`Auth/Register/Switcher`)**:
    - Update `src/app/index.tsx` and `src/app/_layout.tsx` to enforce `5` mutually exclusive `Stack.Protected` groups (`customer`, `marketer`, `merchant`, `workspace-select`, `(auth)`) with explicit `redirectTo`.
    - Update `src/app/workspace-select.tsx`, `marketer/(tabs)/profile.tsx`, and `merchant/(tabs)/profile.tsx` to support switching across any combination of `customer`, `marketer`, and `merchant` (wiping SWR cache on role switch).
    - Update `(auth)/register.tsx` and `src/features/auth/` so users can select `'customer'` alone or combined with `'marketer'` / `'merchant'` (keeping `shop` required only when `'merchant'` is selected), and add dev-only Demo Customer quick sign-in to `(auth)/login.tsx`.
  - [ ] **3.2.3 — Public Referral Offers & Offer QR Issuance (`Public Offer & Offer QR`)**:
    - Create `src/features/customer/offers/` with referral link/code parser (raw code e.g. `mk-demo01`, `https://.../r/<code>`, or `alsalamiyahoffers://r/<code>`), `Set<string>` dedupe for one-time `POST /public/referrals/:code/clicks` per open and `POST /customer/referrals/:code/offer-qr`, plus `SELF_PROMOTION_FORBIDDEN` & `CAMPAIGN_ENDED` localized handling.
    - Build `src/app/customer/_layout.tsx`, `src/app/customer/(tabs)/_layout.tsx` (4 tabs: `Offers`, `Cashback`, `Purchases`, `Profile`, >= `48dp` targets, RTL/LTR sync, double-back exit), and `src/app/customer/(tabs)/index.tsx` (`Offers` tab): paste/enter referral URL or code (plus incoming `expo-linking` deep-link capture), show validated offer details & discount/final price, and render/reuse single-use Offer QR (`QrCodeBox` for `qrToken` + selectable/copyable LTR-isolated `passCode` `OF-...` + in-store cash payment reminder).
  - [ ] **3.2.4 — Customer Cashback Dashboard, Purchase History & Profile (`Customer Dashboard & Purchases`)**:
    - Create `src/features/customer/{dashboard,purchases}/` using `${userId}:customer:...` SWR cache keys (`dashboard`, `purchases`) and zero frontend milestone/cashback arithmetic.
    - Build `src/app/customer/(tabs)/cashback.tsx` (`GET /customer/dashboard`: `availableCashbackSyp`, `lockedCashbackSyp`, `totalCashbackUnlockedSyp`, `verifiedPurchaseCount`, and server-driven purchase & spend milestone progress bars; NO voucher UI until `Phase 4.3`).
    - Build `src/app/customer/(tabs)/purchases.tsx` (`GET /customer/purchases` paginated `FlatList` with pull-to-refresh, focus & `AppState` resume refresh).
    - Build `src/app/customer/(tabs)/profile.tsx` (customer summary, AR/EN language switcher, multi-role workspace switcher when holding `marketer` and/or `merchant`, clean sign-out).

---

## Phase 4 — Post-Hackathon Backlog (Waiting on Backend Implementation)

**Goal**: Features defined in `API_CONTRACT.md` that are not yet implemented in `api/src/` — build only once backend publishes them:

- [ ] **4.1 — Merchant Extensions**:
  - Cashback voucher scanning (`POST /merchant/scanner/redeem-voucher`).
  - Store-wide discount campaigns (`store_discount`), percentage commissions, `POST /merchant/scanner/preview-offer`, and `quantity > 1`.
  - Approval-required participant management (`GET/PATCH /merchant/campaigns/:id/participants`).
  - Active `directReferralUrl` generation.
- [ ] **4.2 — Marketer Extensions**:
  - [x] **Simulated Payouts (`POST /marketer/payouts`, `GET /marketer/payouts`)**: Completed simulated payout request confirmation modal (`expectedAmountSyp` balance-change guard & `409` handling), `totalConfirmedPaidOutSyp` summary card, and paginated payouts history with status filters & rejection reason display in `marketer/(tabs)/wallet.tsx`.
  - [ ] Real transfers & receipts (**Backlog — waiting on backend**): Sham Cash receipt viewer, confirm, and dispute flows.
  - [ ] Public leaderboard (`GET /public/leaderboard`) (**Backlog — waiting on backend**).
- [ ] **4.3 — Customer Extensions**:
  - Cashback voucher issuance, listing, and cancellation (`POST /customer/cashback-vouchers`, `GET /customer/cashback-vouchers`, `POST /customer/cashback-vouchers/:voucherId/cancel`).
  - Server-side active Offer QR pass list or public offer catalog if added to `api/src/`.

---

### Final Verification & Demo Readiness Gate

The application is ready for physical Android rehearsal when:
1. Customer-only, Marketer-only, and Merchant-only accounts cannot reach each other's screens or caches.
2. Multi-role accounts switch cleanly without leaking stale state.
3. All SYP amounts display and parse accurately at scale `100` (`Minor Units`).
4. Real camera QR scan + manual fallback + Customer Offer QR display + `Idempotency-Key` retries pass against the live NestJS API (`EXPO_PUBLIC_USE_DEV_SANDBOX=false`).
5. `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor` pass with 0 errors across Android Development Build (`eas build --profile development`).
