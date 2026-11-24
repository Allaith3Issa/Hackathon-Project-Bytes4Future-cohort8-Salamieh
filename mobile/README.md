# مردود — Mardood (Mobile App)

Dual-workspace (**Marketer** + **Merchant**) Android application for **Team 3 Affiliate Marketing & Cashback Platform**, built with **React Native**, **Expo SDK 58**, and **TypeScript**.

---

## 1. Environment Configuration (Live Backend vs. Dev Sandbox)

Copy `.env.example` to `.env` before running against the hosted NestJS server:

```bash
cp .env.example .env
```

Required variables in `.env`:

```env
EXPO_PUBLIC_API_URL=https://<your-live-api-domain>
EXPO_PUBLIC_WEB_URL=https://<your-live-web-domain>
EXPO_PUBLIC_USE_DEV_SANDBOX=false
```

- When `EXPO_PUBLIC_USE_DEV_SANDBOX=false` (required for live backend testing and all EAS builds):
  - All requests hit `${EXPO_PUBLIC_API_URL}/api/v1/*` directly.
  - **Zero mock/fallback data** is synthesized on network or API failures; real server responses and error codes govern every screen.
  - **Dev Sandbox quick-login buttons never appear**, and the sandbox adapter (`src/core/dev/sandboxAdapter.ts`) is bypassed completely and stripped when `__DEV__` is `false`.
- Restart Metro with `-c` (`npx expo start --dev-client -c`) whenever `.env` values change so Expo inlines the updated `EXPO_PUBLIC_*` environment variables.

---

## 2. Approved Demo Accounts & Seed Fixtures

> **Security Policy (Zero Credentials in Source Control)**  
> Per `../Hacjathon file/docs/handoff/API_CONTRACT.md` (*Shared demo seed and API examples*), **passwords for live backend demo accounts live exclusively in the backend repository (`api/prisma/DEMO_SEED.md` / team private setup)** and must **never** be committed into mobile source code or documentation. Note that the `api/` directory is maintained in the backend repository outside this mobile workspace.

### A. Live Backend Seed Roles (`api/prisma/DEMO_SEED.md` + `API_CONTRACT.md`)

Obtain the phone numbers and private passwords from `api/prisma/DEMO_SEED.md` (backend repo) or the team setup sheet:

| Role / Fixture | Purpose on Live Rehearsal | Expected Mobile Behavior |
| --- | --- | --- |
| **Marketer** (`marketer`) | Browse active campaigns, join open campaigns (`referralUrl`), track wallet & per-merchant earnings | Direct access to `(marketer)/` workspace only |
| **Verified Merchant** (`merchant`, `verified`) | Launch product campaigns (`POST /merchant/campaigns`), monitor dashboard & reserves, redeem Offer QR passes | Direct access to `(merchant)/` workspace only |
| **Dual-Role Account** (`marketer` + `merchant`) | Test workspace chooser & cross-workspace switching (`Profile -> Switch Workspace`) | Routes to `workspace-select`, clears active role SWR cache on switch |
| **Admin / Customer-Only** (`admin` / `customer`) | Negative authorization check | Blocked cleanly on mobile (`hasSupportedMobileRole`) with clear localized error |

### B. Seeded Monetary & Scanner Rehearsal Values (Minor Units: `100 = 1.00 SYP`)

- **Merchant Opening Balance & Top-Up**: Seeded verified merchant starts at `100,000` minor units (`1,000.00 SYP`); Admin top-up of `400,000` minor units raises available balance to `500,000` (`5,000.00 SYP`).
- **Live Rehearsal Campaign Split**: Original price `100,000` (`1,000.00 SYP`), `10%` discount -> final cash price `90,000` (`900.00 SYP`), marketer commission `10,000` (`100.00 SYP`), platform total fee `4,500` (`45.00 SYP` = `1,800` customer cashback + `2,700` platform net), `30` items max -> `435,000` (`4,350.00 SYP`) worst-case reserve.
- **Seeded Scanner Code**: **`OF-DEMO01`** — use with camera QR scan or manual lookup in `(merchant)/(tabs)/scanner` (`POST /merchant/scanner/lookup` -> preview `900.00 SYP` cash due -> `POST /merchant/scanner/redeem-offer` -> `420,500` remaining reserve).

### C. Offline UI Sandbox Mode (`__DEV__` + `EXPO_PUBLIC_USE_DEV_SANDBOX=true` Only)

Only when developing UI offline without a live API (`EXPO_PUBLIC_USE_DEV_SANDBOX=true` in local `.env`):
- **Marketer Demo (`0999100003`)** & **Verified Merchant Demo (`0999100002`)** quick buttons on Login.
- **Dual-Role Sandbox (`0999100009`)** and password-resettable in-memory fixture state.

---

## 3. Running on Android with Live Backend & Real Camera (`expo-camera`)

> **Why use an Android Development Build instead of Expo Go?**  
> Expo Go ignores `app.json` native splash/icon plugins, displays its own host splash, and cannot guarantee identical native camera permission / `expo-camera` behavior across OEM Android devices. To test the **real `CameraView` QR scanner**, native `#FBF7F2` splash screen, and adaptive icon against the live server:

### Option 1 — Cloud APK via EAS Build (Recommended, no local Android SDK needed)

1. Configure `.env` with the live URLs and `EXPO_PUBLIC_USE_DEV_SANDBOX=false`.
2. Build and install the **Development Client APK** on your Android phone:

```bash
npx eas-cli login
eas build --profile development --platform android
# (or: npx eas-cli build --profile development --platform android)
```

3. Install the downloaded `.apk` on the Android device (enable "Install unknown apps" if prompted).
4. Start Metro with cache cleared and connect via USB (`adb reverse tcp:8081 tcp:8081`) or same Wi-Fi LAN:

```bash
npx expo start --dev-client -c
```

5. Grant Camera permission inside the **Offer QR Scanner** tab (`ماسح العروض`) to test live `expo-camera` QR capture, torch toggle, cooldown lock, and manual `OF-DEMO01` fallback.

### Option 2 — Standalone Preview APK (No Metro Needed)

```bash
npx eas-cli build --profile preview --platform android
```

### Option 3 — Local Android SDK Build

```bash
npx expo run:android
```

---

## 4. Verification Checks

Run all checks inside `hackathon-mobile/` before every EAS build:

```bash
npm install
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

---

## 5. Documentation

- Engineering rules & architecture: `AGENTS.md`
- Phased execution plan: `ROADMAP.md`
- Live progress & verification status: `HANDOVER.md`
- Shared API contract: `../Hacjathon file/docs/handoff/API_CONTRACT.md`
- Mobile task scope: `../Hacjathon file/docs/tasks/03-mobile.md`
- Design system: `../Hacjathon file/docs/handoff/frontend/design.md`
