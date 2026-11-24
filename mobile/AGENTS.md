# Alsalamiyah Offers (مردود / Mardood) — Mobile App Agent Instructions (`hackathon-mobile/`)

This is the **Customer, Marketer & Merchant Android App** for **"عروض السلمية / Alsalamiyah Offers (مردود | Mardood)"** (**Team 3 Affiliate Marketing Platform**), built with **React Native + Expo SDK 58 + TypeScript**.
- **Expo App Identity**: `slug: "alsalamiyah-offers"`, `scheme: "alsalamiyahoffers"`, display name `"مردود"`.

## 1. Canonical References & Scope Authority

- **Mobile task scope**: `../Hacjathon file/docs/tasks/03-mobile.md` (and shared rehearsal checks in `../Hacjathon file/docs/handoff/HACKATHON_TASKS.md`).
- **API contract (single source of truth)**: `../Hacjathon file/docs/handoff/API_CONTRACT.md` (`/api/v1`, Minor Units v4).
- **Design system**: `../Hacjathon file/docs/handoff/frontend/design.md` (synced with repo; warm palette, Arabic RTL + English LTR, Arabic error copy).
- **Progress & plan**: `ROADMAP.md` and `HANDOVER.md` in this directory.

## 2. Expo SDK 58 Rules — Do Not Trust Stale Training Data

Expo ships breaking changes every SDK release. Before writing code that touches any Expo, EAS, or React Native API:

1. Check the installed major version of `expo` in `package.json` (currently `~58.0.26`).
2. Verify against SDK 58 docs: `https://docs.expo.dev/versions/v58.0.0/` or `https://docs.expo.dev/llms.txt`.
3. Never create or edit `ios/` or `android/` directories manually (Continuous Native Generation — configure native behavior via `app.json` and config plugins).
4. Remember Expo Go bundles a fixed set of native modules; because the Merchant workspace uses **`expo-camera`** for real QR scanning alongside `expo-secure-store`, target an Android Development Build (`eas build --profile development --platform android` + `npx expo start --dev-client -c`, or `npx expo run:android`) or Preview APK for physical device verification.
5. Prefer recommended Expo packages (`expo-secure-store`, `expo-camera`, `expo-image`, `expo-font`, `expo-haptics`, `expo-clipboard`, `expo-linking`, `react-native-svg`, `react-native-qrcode-svg`) and always install via `npx expo install <package>` (verified afterward with `npx expo-doctor`).

## 3. Commands & Mandatory Verification Gate

Run commands inside `hackathon-mobile/`:

```bash
npx expo install <package>  # ALWAYS use instead of npm install for Expo/RN compatibility
npx expo start --android    # Run locally on Android device/emulator
npx expo lint               # ESLint check
npx tsc --noEmit            # TypeScript strict check
npx expo-doctor             # Diagnose dependency/config issues
```

Before declaring ANY code task complete:
- Run `npx tsc --noEmit` and `npx expo lint` and ensure zero errors.
- Update `HANDOVER.md` with exact completed work, verification status, API wiring status, and next step.

## 4. Strict AI Scope, Role Isolation & Local-First Android Target

- **Build ONLY what is explicitly requested** for the current step in `ROADMAP.md`.
- **Strict Role Separation (Customer vs. Marketer vs. Merchant)**:
  - Keep Customer, Marketer, and Merchant routes, feature slices, hooks, and cached resources **strictly separated** (zero cross-imports between `src/features/customer/`, `src/features/marketer/`, and `src/features/merchant/`).
  - Customer workspace (`customer/`) has **4 tabs** (`Offers`, `Cashback`, `Purchases`, `Profile`) — resolving referral links/codes, issuing single-use Offer QRs, tracking backend cashback milestones, and browsing verified purchase history. Note: `GET /api/v1/campaigns` is marketer-only on the backend, and Cashback Vouchers (`/customer/cashback-vouchers*`) are Backlog until implemented in `api/src/`.
  - Marketer workspace (`marketer/`) has **3 tabs** (`Campaigns`, `Wallet`, `Profile`) + campaign detail (`campaigns/[id]`).
  - Merchant workspace (`merchant/`) has **5 tabs** (`Dashboard`, `Campaigns`, `Scanner`, `Wallet`, `Profile`) + campaign creation (`campaigns/new`) & detail (`campaigns/[id]`).
  - Auth workspace handles `Login` and `Register` (supporting `customer`, `marketer`, `merchant`, or any multi-role combination; `shop` required only when `merchant` is selected) plus `workspace-select.tsx` ONLY when an account holds more than one supported mobile role.
  - Never allow an account without `'customer'` to mount or navigate into `customer/`, without `'marketer'` into `marketer/`, or without `'merchant'` into `merchant/`. Reject `admin`-only accounts cleanly (Admin remains on Web `/admin`).
- **Do NOT add**: unrequested features, Backlog screens whose backend endpoints are not yet built (including Cashback Voucher issuance/cancellation/redemption), AI assistants/chatbots, or unrequested refactors.
- **Do NOT invent** API endpoints, fields, or status values outside `API_CONTRACT.md` and `api/src/`. Surface contract mismatches explicitly.
- **Local Android priority**: Optimize and test for physical Android execution (`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`), seamlessly transitioning to 100% hosted backend endpoints with zero local mock data once `EXPO_PUBLIC_USE_DEV_SANDBOX=false`. Do NOT spend effort adapting layouts or workarounds for AI Studio web preview (`react-native-web` is out of scope).

## 5. Extensible Feature-Driven Architecture

Keep `src/app/` strictly for **Expo Router** routes and `_layout.tsx` navigators. Put all non-route logic outside `src/app/`:

```text
src/
├── app/                              # Expo Router screens & _layout.tsx ONLY
│   ├── _layout.tsx                   # Root Stack with unguarded index.tsx + 5 Stack.Protected guards
│   ├── index.tsx                     # Neutral root '/' gate (useIsFocused + useEffect, zero <Redirect>)
│   ├── workspace-select.tsx          # Multi-role workspace selector (customer / marketer / merchant)
│   ├── (auth)/                       # Guarded: !isAuthenticated
│   │   ├── _layout.tsx               # initialRouteName="login" (anchor: 'login')
│   │   ├── login.tsx                 # Unified Customer/Marketer/Merchant sign-in
│   │   └── register.tsx              # Account registration (customer / marketer / merchant + shop)
│   ├── customer/                     # Guarded: isAuthenticated && activeRole === 'customer' && hasCustomerRole
│   │   ├── _layout.tsx
│   │   └── (tabs)/
│   │       ├── _layout.tsx           # 4 tabs: Offers, Cashback, Purchases, Profile
│   │       ├── index.tsx             # Referral offer lookup/link input, click log & single-use Offer QR
│   │       ├── cashback.tsx          # Customer cashback balances & milestone progress bars
│   │       ├── purchases.tsx         # Paginated verified cash purchase history
│   │       └── profile.tsx           # Customer summary, AR/EN toggle, role switch (if multi), sign out
│   ├── marketer/                     # Guarded: isAuthenticated && activeRole === 'marketer' && hasMarketerRole
│   │   ├── _layout.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           # 3 tabs: Campaigns, Wallet, Profile
│   │   │   ├── index.tsx             # Active Campaigns browse
│   │   │   ├── wallet.tsx            # Marketer balance, by-merchant, transactions, stats
│   │   │   └── profile.tsx           # Account summary, AR/EN language toggle, role switch (if multi), sign out
│   │   └── campaigns/[id].tsx        # Marketer campaign detail, open join, native share
│   └── merchant/                     # Guarded: isAuthenticated && activeRole === 'merchant' && hasMerchantRole
│       ├── _layout.tsx
│       ├── (tabs)/
│       │   ├── _layout.tsx           # 5 tabs: Dashboard, Campaigns, Scanner, Wallet, Profile
│       │   ├── index.tsx             # Merchant dashboard (verification status, balances, stats, quick actions)
│       │   ├── campaigns.tsx         # Merchant campaigns list + status filter + pagination
│       │   ├── scanner.tsx           # Real camera QR scanner (expo-camera) + manual code fallback + settle
│       │   ├── wallet.tsx            # Available vs locked balances + paginated transactions ledger
│       │   └── profile.tsx           # Shop profile & verification details, AR/EN toggle, role switch (if multi), sign out
│       └── campaigns/
│           ├── new.tsx               # Create product campaign + live server preview + Idempotency-Key
│           └── [id].tsx              # Merchant campaign detail + close & release reserve
├── core/                             # Cross-cutting infrastructure
│   ├── api/                          # Typed fetch client, refresh mutex, idempotency UUID helper, error mapper
│   ├── auth/                         # SecureStore session store, multi-role helpers, activeRole guard
│   ├── cache/                        # SWR memory cache (${userId}:${role}:..., TTL, invalidation)
│   ├── config/                       # Validated EXPO_PUBLIC_* env configuration
│   ├── dev/                          # Isolated Dev Sandbox (ONLY active in __DEV__ + flag)
│   ├── i18n/                         # Typed bilingual dictionaries (ar / en) & locale store
│   ├── navigation/                   # Android BackHandler & exit-guard hooks
│   ├── rtl/                          # Bidirectional RTL/LTR manager, LTR isolation, Minor-Unit SYP formatter/parser
│   └── theme/                        # Typed StyleSheet design tokens aligned with design.md
├── features/                         # Modular vertical slices (strictly separated by role)
│   ├── auth/                         # Login, register, role validation
│   ├── profile/                      # Shared locale switcher & sign-out hooks
│   ├── customer/                     # Customer-only domain logic
│   │   ├── offers/
│   │   ├── dashboard/
│   │   └── purchases/
│   ├── marketer/                     # Marketer-only domain logic
│   │   ├── campaigns/
│   │   └── wallet/
│   └── merchant/                     # Merchant-only domain logic
│       ├── dashboard/
│       ├── campaigns/
│       ├── scanner/
│       └── wallet/
└── components/
    └── ui/                           # Reusable design primitives (48dp touch targets, Skeleton, Badges, QrCodeBox)
```

## 6. Data Structures, Idempotency & Optimistic UI Discipline

### Choose the right data structure for the job
- **`Map<string, T>`**: Use for $O(1)$ campaign lookup/updates by `campaignId` and normalizing/merging paginated or relational lists (`GET /campaigns` + `GET /marketer/memberships`) without nested $O(n^2)$ scans.
- **`Set<string>`**: Use for in-flight mutation deduplication (preventing duplicate `join`, `close`, `launch`, `redeem`, `offer-qr`, or per-navigation `click` requests while pending) and fast membership ID checks.
- **Stack**: Use Expo Router's native stack for screen history, and an explicit modal/overlay stack in `src/core/navigation/` when layered sheets/dialogs exist so Android Back dismisses top-down predictably.

### Idempotency-Key (`UUID v4`, 36 chars) for sensitive Merchant mutations
- Backend strictly requires a valid 36-character UUID `Idempotency-Key` header on:
  - `POST /merchant/campaigns` (campaign launch & reserve lock)
  - `POST /merchant/scanner/redeem-offer` (cash sale settlement & reserve debit)
- **Retry & Fingerprint Rule**:
  - Maintain a stable UUID `Idempotency-Key` for the current exact payload/attempt so retrying after a network timeout replays safely without double-locking or double-settling.
  - Whenever the user edits any campaign draft field or starts scanning a different code, **generate a fresh UUID** to avoid `409 IDEMPOTENCY_KEY_REUSED`.

### Optimistic UI & Zero Frontend Arithmetic
- Apply optimistic transitions only to **safe, reversible UI feedback** (e.g., immediate open-join feedback with rollback snapshot).
- **Never duplicate backend arithmetic**: Backend (`NestJS`) calculates all prices, worst-case reserves, fees, cashback splits, milestone thresholds/progress, available/locked balances, conversion rates, and pagination. Always call `POST /merchant/campaigns/preview` for live campaign preview calculations and render server values (`finalPriceSyp`, `milestonePurchasesRequired`, `milestoneSpendRequiredSyp`, etc.) directly.
- **Never fabricate financial or authoritative outputs optimistically**: Do not invent `referralUrl`, `qrToken`, `passCode`, `availableBalanceSyp`, `availableCashbackSyp`, `worstCaseReserveSyp`, or finalized settlements locally. Sync wallets and dashboards from the server after mutations, on pull-to-refresh, tab focus, and `AppState` resume.

## 7. App-Side Caching (SWR)

- Implement a lightweight memory-first **Stale-While-Revalidate (SWR)** cache under `src/core/cache/`.
- **Strict User & Role Isolation**: Namespace every authenticated cache key by **both `userId` and active `role`** (`${userId}:customer:dashboard`, `${userId}:marketer:campaigns`, `${userId}:merchant:wallet`, etc.) so switching accounts OR switching active role (for multi-role users) never leaks stale cross-role data.
- **Freshness**: Use short explicit TTLs (~60s for active campaigns, ~15–30s for wallets/dashboards/purchases) + immediate cross-key invalidation after mutations (`launch` / `close` / `redeem-offer` invalidate merchant dashboard, wallet, and campaigns; `join` invalidates marketer campaigns/memberships) + revalidation on pull-to-refresh, screen focus, and app foreground resume.
- **Strict security boundary**: Never store `accessToken`, `refreshToken`, `qrToken`, or user credentials in the regular cache or `AsyncStorage`. Call `cache.clear()` immediately on logout, account switch, role switch, or expired session.

## 8. Bilingual Support (`ar` & `en`), Bidirectional RTL/LTR, Minor Units & Camera

- **Full bilingual UI (`ar` + `en`)**: Support both **Arabic (`ar`)** and **English (`en`)**, with the **language switcher located in each workspace's Profile tab → Settings section**. Every visible label, title, button, validation error, empty state, and `accessibilityLabel` MUST live in typed `ar` and `en` dictionaries under `src/core/i18n/`.
- **Bidirectional RTL / LTR architecture**:
  - Synchronize layout direction cleanly with the active language (**RTL** for `ar`, **LTR** for `en`) via `src/core/rtl/` and `I18nManager`.
  - Always use **logical directional styles** (`marginStart`, `marginEnd`, `paddingStart`, `paddingEnd`, `start`, `end`, `textAlign: 'auto'`) instead of physical `left`/`right`.
  - Test every Customer, Marketer, and Merchant screen in **both RTL (Arabic) and LTR (English)** on Android.
- **LTR isolation inside RTL**: Always force `ltr` direction (`writingDirection: 'ltr'`) on Syrian phone numbers (`^09[0-9]{8}$`), pass/referral codes (`OF-...`, `mk-...`), raw `referralUrl` / `directReferralUrl` strings, and formatted numeric currency tokens regardless of active language.
- **Monetary Precision (`Minor Units`, Scale `100`)**:
  - All API `...Syp` fields are nonnegative JSON integers in **minor units (hundredths of 1 new SYP: `100` = `1.00 new SYP`)**.
  - Display amounts using exact integer quotient/remainder division by `100` (e.g., `90000` -> `900.00 ل.س.` / `900.00 SYP`) without floating-point inaccuracy.
  - Parse merchant decimal inputs (up to 2 fractional digits, supporting Arabic-Indic numerals) via pure integer parsing (`parseNewSypToMinorUnits`) into minor units (`"12.34"` -> `1234`) before sending to the API.
- **Real Camera QR Scanner (Merchant) & Offer QR Display (Customer)**:
  - Use **`expo-camera`** (`CameraView` + `useCameraPermissions`) in `merchant/(tabs)/scanner.tsx`, active ONLY while the tab is focused and actively scanning (pause/stop immediately upon valid capture or settlement, and release camera on tab blur).
  - Always provide an accessible manual code input (`OF-...`) and graceful permission-denied state (*«الكاميرا غير متاحة. أدخل الرمز يدوياً.»* / *"Camera unavailable. Enter the code manually."*).
  - On `customer/(tabs)/index.tsx`, render `qrToken` as a crisp high-contrast QR code on `#FFFFFF` surface paired with a selectable/copyable LTR-isolated `passCode` (`OF-...`) and clear in-store cash reminder (*«اعرض هذا الرمز للتاجر عند الدفع كاش لتسجيل الخصم واحتساب الكاش باك.»* / *"Show this code to the merchant when paying cash to apply the discount and record cashback."*).
- **Locked Styling Strategy — Typed `StyleSheet` + Centralized Design Tokens (`src/core/theme/`)**:
  - Do NOT install NativeWind or CSS-utility compilers. Use native `StyleSheet.create` backed by `design.md` tokens (`#FBF7F2` canvas, `#FFFFFF` surface, `#503C44` ink & dark balance panel, `#B54718` action / `#943710` pressed, `#F3E6E8` mauve tint, `#DDCBD0` rule, `#987582` control border, `#315D47`/`#EDF5EF` success, `#982D3D`/`#FDF2F4` danger, `#534767`/`#F1EDF5` info).
  - Load **IBM Plex Sans Arabic** (`400`, `600`, `700`) via `expo-font` before hiding `SplashScreen`.
  - Minimum **48×48 dp** Android touch targets, `8dp` control radius, `12dp` panel/image radius, `16dp` horizontal gutter, `24dp` section spacing.

## 9. Smooth Touch, Haptics & Animations

- Use **`react-native-reanimated`** and **`react-native-gesture-handler`** for fluid press feedback, list/card entrances, and conditional form sections (e.g., Merchant shop fields on Register).
- Keep directional animations **direction-aware** between RTL (`ar`) and LTR (`en`).
- Use **`expo-haptics`** purposefully: subtle impact on primary press, success notification on join/share/copy/register/launch/redeem, and error notification on validation or API error.
- Render geometry-matched **Skeleton loaders** and always respect **`useReducedMotion()`**.

## 10. Android System Back Button & Gesture Handling

- Handle Android hardware Back and system gestures via `src/core/navigation/useAndroidBack.ts` (`BackHandler`):
  1. Dismiss active modal / bottom sheet / overlay / scanner preview first if open.
  2. Guard critical in-flight mutations (`launch`, `close`, `redeem-offer`, `join`, `register`) so Back presses don't leave ambiguous UI state.
  3. Pop Expo Router stack normally on detail/form screens (`campaigns/[id]`, `campaigns/new`, `register`).
  4. On root tab screens in `customer/(tabs)`, `marketer/(tabs)`, and `merchant/(tabs)`, require a deliberate second Back press with a brief localized prompt (*«اضغط مرة أخرى للخروج»* / *"Press back again to exit"*).

## 11. Security Rules

- **Secure token storage**: Store `accessToken` and `refreshToken` (and any persisted `activeRole` choice for multi-role accounts) exclusively in **`expo-secure-store`**. Never place tokens in `AsyncStorage` or logs.
- **Single-flight refresh mutex**: Coordinate `POST /auth/refresh` behind one shared in-flight promise so parallel `401` responses trigger only **one** token rotation call. If refresh fails, wipe `SecureStore`, clear cache, and route to Login with a localized expiry message.
- **Multi-role Validation & `Stack.Protected` Enforcement**:
  - Confirm `user.roles` includes at least one of `'customer'`, `'marketer'`, or `'merchant'` upon login, registration, refresh, and `/auth/me` restore; reject `admin`-only accounts cleanly.
  - Enforce workspace isolation at **both** `AuthContext` (`activeRole`) and `src/app/_layout.tsx` (`Stack.Protected` guards so `customer/`, `marketer/`, and `merchant/` routes are never mounted simultaneously).
- **Safe URLs & Error Mapping**: Validate `http://` or `https://` schemes before rendering `imageUrl` or sharing `referralUrl` / `directReferralUrl`. Map every API error code from `API_CONTRACT.md` (including `MERCHANT_NOT_VERIFIED`, `INSUFFICIENT_MERCHANT_BALANCE`, `INSUFFICIENT_LOCKED_BUDGET`, `QR_ALREADY_REDEEMED`, `QR_EXPIRED`, `SELF_PROMOTION_FORBIDDEN`, `CAMPAIGN_ENDED`, `AMOUNT_OUT_OF_RANGE`, `IDEMPOTENCY_KEY_REUSED`, `PHONE_ALREADY_REGISTERED`) to clear localized (`ar`/`en`) user messages; never expose raw JSON, stack traces, or credentials.

## 12. Zero Mock Data Policy + Isolated Dev Test Mode

- **Hosted / Live API mode (`EXPO_PUBLIC_USE_DEV_SANDBOX=false`, mandatory once the hosted backend URL is live)**: **ZERO mock or local data** anywhere in the app. 100% of reads and mutations communicate directly with the hosted `EXPO_PUBLIC_API_URL`.
- **Pre-backend UI development (`__DEV__ && process.env.EXPO_PUBLIC_USE_DEV_SANDBOX === 'true'`)**:
  - Keep an isolated adapter strictly inside `src/core/dev/` matching `API_CONTRACT.md` schemas and minor-unit amounts (`90000`, `10000`, `100000`, `OF-DEMO01`) for **Customer, Marketer, and Merchant** demo accounts.
  - Expose clearly labeled dev-only quick login buttons on Login (for Demo Customer, Demo Marketer, and Demo Merchant) compiled out / hidden whenever `!__DEV__` or `EXPO_PUBLIC_USE_DEV_SANDBOX !== 'true'`.
  - Once `EXPO_PUBLIC_USE_DEV_SANDBOX=false` is set, nothing runs locally and zero screen code changes are needed.
