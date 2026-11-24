# Live Handover & Progress Log (`HANDOVER.md`) — Mobile App

> **Mandatory Rule**: Update this file at the end of **every executed prompt** inside `hackathon-mobile/` so the exact project status, verification state, and next action remain 100% accurate.

---

## 1. Current Status

- **Current Phase**: **Bugfix Remediation Phase — All Prompts 1–10 Complete (`H2`–`H7` in `BUGFIX_TRACKER.md` + Final Codebase Audit)**.
- **Last Completed Action (Bugfix Prompt 10 — Merchant Workspace Fixes, Scanner Safety & Final Audit)**:
  - **1. `markStale` Revalidation & Focus Concurrency Guards (`H2`, `src/core/cache/swrCache.ts`, `src/features/{merchant,customer,marketer,profile}/**/hooks.ts`)**:
    - Replaced `swrCache.invalidate` / `invalidatePrefix` after campaign launch, close, and QR settlement (`invalidateMerchantCampaignRelatedCaches`, `invalidateMerchantPostRedeemCaches`) with `swrCache.markStale` / `swrCache.markStalePrefix` so mounted tabs keep cached UI visible instead of freezing on Skeletons.
    - Added `swrCache.isRevalidating(key)` and updated all `useFocusEffect` hooks across merchant, customer, marketer, and profile slices from `!== null` to `(!snapshot || !snapshot.isFresh)` gated by `!swrCache.isRevalidating(key)` or `!inFlightPagesRef.current.has(1)`.
  - **2. Campaign Filter Reset & `AbortController` (`H3`, `src/features/merchant/campaigns/{types,api,hooks}.ts`)**:
    - Added `signal?: AbortSignal` to `MerchantCampaignQuery` / `fetchMerchantCampaigns`, cleared `inFlightPagesRef`, `isLoadingMoreRef`, `isLoadingMore`, `isRefreshing`, and aborted stale in-flight requests in `useEffect` whenever `cacheKey` changes.
  - **3. Live Preview Guard, Retry & Dynamic Damascus/UTC `minimumEndDate` (`H4`, `src/features/merchant/campaigns/hooks.ts`, `src/app/merchant/campaigns/new.tsx`)**:
    - Added `!preview || Boolean(previewError)` to `isSubmitDisabled`, cleared `previewState` synchronously when preview inputs change or `previewInput === null`, added `retryPreview()` + `campaign-preview-retry-button`, and computed `minimumEndDate` dynamically on focus/picker open aligned with Damascus (`UTC+3`) & UTC calendar days.
  - **4. Local `100%` Discount & Positive Merchant Net Validation (`H5`, `src/features/merchant/campaigns/validation.ts`)**:
    - Mirrored `api/src/campaign/campaign-pricing.ts` BigInt rules in `validateCampaignDraft` to reject `finalPriceSyp <= 0n` (`discountFinalPriceInvalid`) and `merchantNetSyp <= 0n` (`commissionExceedsNetPrice`) with localized inline field errors while leaving live `/preview` authoritative.
  - **5. Dashboard Top-Campaign Badge Cleanup (`H6`, `src/app/merchant/(tabs)/index.tsx`)**:
    - Removed the misleading `activeStatus` `<StatusBadge>` from `topCampaign` since `TopMerchantCampaignDto` does not guarantee active campaign status.
  - **6. Background Camera/Torch Safety, Error State UI, Timer Cleanup & Constant Reuse (`H7`, `src/app/merchant/(tabs)/scanner.tsx`)**:
    - Tracked `appState === 'active'` in `isCameraLive` and turned off `isTorchOn` automatically whenever leaving active foreground or focus; differentiated `status === 'error'` in the viewfinder (`cameraErrorHint`) and toggle button (`rescanAction`); tracked/cleared `focusTimerRef` on unmount (`isMountedRef`); and used imported `SCANNER_CODE_MAX_LENGTH` instead of literal `128`.
- **Prior Completed Action (Bugfix Prompt 9 — Marketer Workspace Fixes & Accessibility)**:
  - **1. Server-Side Search `?q=`, Full Pagination & Membership Merge (`G1`, `src/features/marketer/campaigns/{api,hooks,types,index}.ts`, `src/core/i18n/{types,ar,en}.ts`, `src/app/marketer/(tabs)/index.tsx`)**:
    - Added `fetchAllMarketerMemberships` (bounded multi-page fetch merged via `Map<string, MarketerMembership>`), `mergeCampaignFeedPages` (order-preserving O(n+m) dedupe), `nextPage`/`loadMore` pagination, `350ms` debounced `?q=` search with `AbortController` cancellation, and `inFlightPagesRef` page locking in `useCampaignsFeed`.
    - Wired `FlatList` `onEndReached`, `campaigns-load-more-button`, and `ListFooterComponent` inline `loadMoreErrorMessage` + `campaigns-load-more-retry-button` in `marketer/(tabs)/index.tsx` alongside bilingual `campaigns.{loadMore,loadingMore}` keys.
  - **2. Marketer Wallet Page Lock, Active-Section Binding & Footer Recovery (`G2`, `src/features/marketer/wallet/{hooks,index}.ts`, `src/app/marketer/(tabs)/wallet.tsx`)**:
    - Unified page-1 in-flight locking via `inFlightPagesRef`, preserved `page >= 2` items during silent `useFocusEffect`/`AppState` refreshes (`applyFirstPageSnapshot`), separated `loadMoreErrorMessage` from fatal section errors, and gated `useMarketerStats`, `useMarketerEarningsByMerchant`, and `useMarketerTransactions` via `{ enabled: activeTab === ... }`.
    - Scoped pull-to-refresh and `isPullRefreshing` / `isRefreshingActiveSection` to the active sub-tab + summary, added `wallet-summary-retry-button` to `walletErrorMessage`, and moved `loadMore` error + Retry button into `ListFooterComponent`.
  - **3. Optimistic `joinCampaign` Session/Key Rollback Guards (`G3`, `src/features/marketer/campaigns/hooks.ts`)**:
    - Verified `getSessionEpoch()`, `activeDetailKeyRef`, and `activeFeedKeyRef` match the starting context before applying server membership results, reverting optimistic cache updates on failure, updating `isJoining`/`joinError` state, and marking search feed caches stale.
  - **4. Campaign Details Resilience, Safe Clipboard & Focus-Gated Android Back (`G4`, `src/app/marketer/campaigns/[id].tsx`)**:
    - Rendered inline `errorMessage` banner with Retry (`campaign-details-inline-retry-button`) even when cached campaign data is present, wrapped `handleCopyReferralUrl` in `try/catch` + `isMountedRef` with timer reset on URL change/unmount, added `campaign-invalid-referral-notice` when `membership?.status === 'approved'` without a valid `referralUrl`, and passed `enabled: isFocused` + `onBack` matching `handleGoBack` to `useAndroidBack`.
  - **5. Marketer Profile Error Banner & Retry (`G5`, `src/app/marketer/(tabs)/profile.tsx`)**:
    - Extracted `errorMessage` from `useProfileAccount()` and rendered an inline error banner with `marketer-profile-retry-button`.
  - **6. Screen-Reader Accessibility, `tabular-nums` & `AppState` Resume Listeners (`G6`, `wallet.tsx`, `campaigns/[id].tsx`, `campaigns/hooks.ts`)**:
    - Removed outer child-swallowing `accessible` props on wallet merchant/transaction `reportCard` items, guarded skeleton balance `accessibilityLabel` strings so `0` is not read while loading, applied `TabularNumberStyle` across all numeric values and dates in `wallet.tsx` and `campaigns/[id].tsx`, and added `AppState` foreground resume revalidation to `useCampaignsFeed` and `useCampaignDetails`.
- **Prior Completed Action (Bugfix Prompt 8 — Customer Workspace Fixes & Accessibility)**:
  - **1. Sequential Deep-Link Handling & `?code=` Extraction (`F1`, `src/features/customer/offers/types.ts`, `src/app/customer/(tabs)/index.tsx`)**:
    - Extended `extractReferralCode` to extract and validate `?code=` query parameters across relative paths, `http`/`https` URLs, and `alsalamiyahoffers://` deep links alongside `/r/<code>` paths.
    - Separated `lastHandledRouteCodeRef` and `lastHandledIncomingUrlRef` (with `suppressedIncomingUrlRef` guard) so consecutive deep links apply cleanly regardless of source, and reset tracking + `?code=` params on session/account changes or «عرض آخر» (`handleClearPress`).
  - **2. Localized Offer Attribution Label (`F2`, `src/app/customer/(tabs)/index.tsx`)**:
    - Added semantic `localizeAttributionLabel(rawLabel, t)` mapping server attribution values (`'Merchant direct'`, `'Marketer referral'`) to `t.customer.offers.attributionMerchant` / `t.customer.offers.attributionMarketer` with raw-string fallback.
  - **3. Purchases Pagination Deduping, Page Preservation & Footer Error Recovery (`F3`, `src/features/customer/purchases/hooks.ts`, `src/app/customer/(tabs)/purchases.tsx`)**:
    - Registered page `1` in `inFlightPagesRef` inside the initial `useEffect` fetch to prevent duplicate page-1 calls alongside `useFocusEffect`.
    - Added `preserveLoadedPages` (`applyFirstPageSnapshot`) so silent focus/resume refreshes merge fresh page-1 purchases cleanly via `mergeCustomerPurchasesBySaleId` without wiping loaded pages (`page >= 2`), reserving full reset for explicit manual `refresh()`.
    - Separated `loadMoreErrorState` / `loadMoreErrorMessage` from page-1 `errorState` and rendered inline footer error recovery in `purchases.tsx` (`ListFooterComponent`) with a Retry button calling `loadMore()` (blocking `onEndReached` auto-loops while an error is visible).
  - **4. Profile Error Banner & Retry (`F4`, `src/app/customer/(tabs)/profile.tsx`)**:
    - Exposed `errorMessage` from both `useProfileAccount()` and `useCustomerDashboard()` in an inline error banner with a `t.common.retry` button wired to `handleRefresh`.
  - **5. Stale Offer & `OfferQrPass` Eviction (`F5`, `src/features/customer/offers/hooks.ts`, `src/app/customer/(tabs)/index.tsx`)**:
    - Cleared `offer` and `activeCode` immediately in `usePublicOfferLookup` when `refreshOffer` fails with `NOT_FOUND` or `CAMPAIGN_ENDED`, and synced a `useEffect` in `index.tsx` to invoke `clearOfferPass()` whenever the offer disappears, ends, or returns `NOT_FOUND` / `CAMPAIGN_ENDED`.
  - **6. Screen-Reader Accessibility & Narrow-Screen (`320dp`) Polish (`F6`, `F7`, `src/app/customer/(tabs)/{index,cashback,purchases,profile}.tsx`)**:
    - Removed card-level `accessible` swallowing on `purchases.tsx` purchase cards so individual labels/amounts are read clearly, and added explicit `accessibilityLabel` on `cashback.tsx` milestone progressbars (complementing `BalanceCard` `D1` fix).
    - Passed `reducedMotion ? 0 : 180` to offer hero `<Image>`, cleared `failedImageUrl` on refresh/retry/offer-change, bound `loading={isRefreshing}` on `customer-offer-retry-button`, and added `flexWrap: 'wrap'` + `flexShrink: 1` to detail/summary rows across `index.tsx`, `purchases.tsx`, `cashback.tsx`, and `profile.tsx`.
- **Prior Completed Action (Bugfix Prompt 7 — UI Primitives Accessibility, Narrow-Screen Layout & Auth Form Polish)**:
  - **1. `BalanceCard` Accessibility & `tabular-nums` (`D1`, `D5`, `src/components/ui/BalanceCard.tsx`)**:
    - Moved `accessible`, `accessibilityRole="summary"`, and `accessibilityLabel` from the outer card container onto an inner `summaryContent` wrapper around `headerRow`, `amountContainer`, and `hint` so interactive `action` controls remain independently focusable.
    - Omitted `formattedAmount` from `accessibilityLabel` when `loading={true}` (`loading ? label : ...`) and applied `TabularNumberStyle` alongside `Typography.balance`.
  - **2. `QrCodeBox` Timer Safety, Narrow-Screen Sizing & `useLocale()` Copy (`D2`, `D3`, `src/components/ui/QrCodeBox.tsx`)**:
    - Added `isMountedRef` guards around async clipboard callbacks/timers and a `useEffect` reset clearing `copyTimerRef` and `hasCopied` whenever `normalizedPassCode` changes.
    - Used `useWindowDimensions()` + `maxWidth: '100%'` to cap QR canvas dimensions cleanly on `320dp` viewports while keeping `200dp` on standard screens, and moved all default fallback/accessibility strings to `t.qrCodeBox.*`.
  - **3. `CampaignCard` Responsive Metrics, `shopName` Wrap, `0%` Discount & `tabular-nums` (`D4`, `D5`, `src/components/ui/CampaignCard.tsx`)**:
    - Replaced dangling wrapped-row vertical divider with responsive `onLayout` / `useWindowDimensions` column stacking (`metricsPanelStacked` + horizontal hairline divider below `264dp` panel width / `360dp` viewport), switched `shopName` from `flex: 1` to `flexGrow: 1, flexShrink: 1`, hid struck-through `originalPrice` when `originalPriceSyp <= finalPriceSyp`, and applied `TabularNumberStyle` to price, original price, commission, and expiry text.
  - **4. `AppInput` Accessibility / `48dp` Accessory & `StatusBadge` `'warning'` Tone (`D6`, `src/components/ui/{AppInput,StatusBadge}.tsx`)**:
    - Added `accessibilityHint` (falling back to active `error` or `hint`) and merged `accessibilityState={{ ...textInputProps.accessibilityState, disabled: !editable }}` on `TextInput`, and raised `endAccessory` `minHeight` to `TouchTarget.minHeight` (`48dp`).
    - Added `'warning'` to `StatusBadgeTone` and `TONE_PALETTE` backed by `Colors.warningBg` (`#FFF2DF`) and `Colors.warning` (`#78451A`).
  - **5. Auth Hooks & Register Focus Flow (`E3`, `src/features/auth/hooks.ts`, `src/app/(auth)/register.tsx`)**:
    - Moved `setFieldErrors` and `setFormError` out of the `setRolesState` updater inside `toggleRole`, added leading `inFlightOpsRef.current.size > 0` guards to `useLoginForm.submit` (and dev-sandbox submitters), and wired `shopNameInputRef` in `register.tsx` so password `onSubmitEditing` focuses `shopName` whenever `includesMerchant` is active.
- **Prior Completed Action (Bugfix Prompt 6 — Locale/RTL Sync, Latin Numerals, Comma Grouping, UTC End Dates, Theme Tokens & i18n Parity)**:
  - **1. Locale Boot & Stack Direction Synchronization (`C3`, `src/core/rtl/{direction,index}.ts`, `src/core/i18n/LocaleContext.tsx`, `src/app/{_layout,index,(auth)/_layout,customer/_layout,marketer/_layout,merchant/_layout}.tsx`)**:
    - Added `getLayoutDirection(locale)` and epoch-guarded `LocaleContext` hydration (`localeEpochRef`) without triggering forced native reloads on live `ar` <-> `en` toggles.
    - Synchronized memoized `contentStyle.direction` and directional push animations across root and workspace `<Stack>` layouts, gated `index.tsx` initial redirect on `isLocaleReady`, and aligned `index.tsx` styles to valid theme tokens (`Typography.section`, `Spacing.gutter`, `Radii.panel`, `Colors.rule`, `Spacing.compact`).
  - **2. Safe Comma Thousands Grouping (`C4`, `src/core/rtl/format.ts`)**:
    - Updated `parseNewSypToMinorUnits` to accept valid thousands-separated inputs (`\d{1,3}(,\d{3})+` including Arabic `\u066C` -> `,` before `.xx`) while continuing to reject ambiguous comma decimals (`12,5`, `12,50`, `,500`).
  - **3. Latin Numerals & Safe Fallbacks (`C5`, `src/core/rtl/format.ts`)**:
    - Unified `formatPercent` and `formatCampaignDate` to use `ar-SY-u-nu-latn` + `numberingSystem: 'latn'` with digit normalization and `try/catch` fallbacks so card numbers consistently match `formatSyp`.
  - **4. UTC Campaign End-Date Alignment (`C6`, `src/core/rtl/format.ts`, `src/features/merchant/campaigns/validation.ts`)**:
    - Locked `formatCampaignDate` to `timeZone: 'UTC'` and unified `buildEndOfDayIso` (`Date.UTC(..., 23, 59, 59, 0)`) and `parseCampaignEndsAtToDate` (`getUTCFullYear/Month/Date`) to prevent `+1` day shifts in `UTC+3` (Damascus).
  - **5. Theme Tokens Completion & Cleanup (`C7`, `src/core/theme/{colors,typography,tokens,index}.ts`)**:
    - Added `warning: '#78451A'` and `warningBg: '#FFF2DF'` to `Colors`, added `fontVariant: ['tabular-nums']` to `Typography.balance` + exported `TabularNumberStyle`, and removed dead `LayoutStyles`.
  - **6. Dictionary Cleanup & New Keys (`C8`, `src/core/i18n/{types,ar,en}.ts`)**:
    - Removed unused keys (`common.{initializing,loading,currencySuffix,percentSymbol}`, `auth.{notMarketerError,sessionActiveTitle,sessionActiveSubtitle}`, `campaigns.joinFailed`, `wallet.totalConfirmedPaidOut`, `profile.signOutFailed`, `merchant.wallet.campaignReferenceLabel`, `merchant.{placeholders,placeholderSubtitle}`, `customer.offers.qrStatusLabel`, `customer.purchases.productLabel`) and added `qrCodeBox.*`, `profile.loadError`, `merchant.createCampaign.{discountFinalPriceInvalid,commissionExceedsNetPrice}`, and `merchant.scanner.cameraErrorHint` with `455 === 455` key parity.
- **Prior Completed Action (Bugfix Prompt 5 — Android Back, Safe `overlayStack`, Hydration Deep-Link Protection & `/r/[code]` Routing)**:
  - **1. Android Double-Back Root Exit (`C1`, `src/core/navigation/useAndroidBack.ts`)**:
    - Replaced per-hook `lastBackPressAtRef` with a module-level `lastRootBackPressAt` timestamp and called `BackHandler.exitApp()` returning `true` on the second back press within `EXIT_CONFIRM_WINDOW_MS` from any root tab.
  - **2. Busy-Before-Overlay Order, Safe `dismissTop()` & Dead iOS Cleanup (`C2`, `src/core/navigation/{overlayStack,useAndroidBack}.ts`, `src/app/merchant/campaigns/{new,[id]}.tsx`)**:
    - Ordered `if (isBusy) return true;` before `overlayStack.dismissTop()` in `useAndroidBack`.
    - Updated `OverlayEntry.onDismiss` to return `boolean | void`; `overlayStack.dismissTop()` now invokes `top.onDismiss()` first and keeps `top` in the stack if `onDismiss()` returns `false`.
    - Removed the dead iOS-only `useOverlayBackRegistration` call from `merchant/campaigns/new.tsx`, updated `[id].tsx` `handleDismissConfirm` to return `false` while `isClosing` is true (`true` once dismissed), and gated its registration on `isConfirmModalOpen && isFocused`.
  - **3. Protect Deep Links During Session Hydration (`E1`, `src/app/_layout.tsx`)**:
    - Added `isHydratingWithoutError = status === 'hydrating' && hydrationError === null` to `<Stack.Protected>` guards in `RootNavigator` so cold-start deep links are not evicted before session restoration completes (while routing to `/` if `hydrationError !== null`).
  - **4. `/r/[code]` Deep-Link Route & Auth/Multi-Role Handoff (`E2`, `src/app/r/[code].tsx`, `src/core/auth/AuthContext.tsx`, `src/app/{_layout,index,customer/(tabs)/index}.tsx`)**:
    - Added `pendingReferralCode`, `setPendingReferralCode`, and `clearPendingReferralCode` in `AuthContext` (with `resolveInitialWorkspaceRole` preferring `'customer'` for returning multi-role sessions holding a pending referral code while preserving `workspace-select` for fresh dual-role logins).
    - Created unguarded `src/app/r/[code].tsx` extracting codes from path `[code]`, `?code=`, or `Linking.useURL()`, storing `pendingReferralCode`, waiting for `status !== 'hydrating'`, routing guests to `/(auth)/login`, switching `customer`-capable accounts cleanly into `'customer'` before replacing to `/customer?code=...`, and redirecting non-customer users safely to their workspace.
    - Forwarded `pendingReferralCode` through `_layout.tsx` / `index.tsx` into `/customer?code=...` and consumed/cleared it in `customer/(tabs)/index.tsx`.
- **Prior Completed Action (Bugfix Prompt 4 — SWR Cache Race Protection & Stale-Preserving Revalidation `B3` in `src/core/cache/`)**:
  - **1. `cacheEpoch` + `keyVersions` + `inFlight` Identity Fencing (`src/core/cache/swrCache.ts`)**:
    - Added `cacheEpoch` (bumped on `clear()`) and per-key `keyVersions` (bumped on `set()`, `markStale()`, `markStalePrefix()`, `invalidate()`, and `invalidatePrefix()`), discarding stale `revalidate()` writes when epoch or key version changed mid-flight and checking `this.inFlight.get(key) === fetchPromise` before cleanup.
  - **2. `markStale` & `markStalePrefix` (`src/core/cache/swrCache.ts`)**:
    - Added `markStale(key)` and `markStalePrefix(prefix)` keeping existing `data` visible (`updatedAt = 0`, `isFresh === false`) while clearing stale in-flight entries so tabs refresh silently without flashing or locking onto Skeletons.
  - **3. Optimistic Rollback & Refresh Guards (`src/core/cache/useSWRResource.ts`)**:
    - Captured `CacheKeyVersion` in `applyOptimistic` so rollbacks abort if newer writes, `clear()`, or invalidations arrived; fenced `refresh()` and mount effects with `isMountedRef`, `activeKeyRef`, and `refreshIdRef` (`refreshingState` keyed per active key) so key switches or unmounts never leak `isRefreshing` or `error`.
  - **4. Dead Export Cleanup (`src/core/cache/{swrCache,index}.ts`)**:
    - Removed unused `buildUserCacheKey` and verified zero remaining references across `src/`.
- **Prior Completed Action (Bugfix Prompt 3 — Shared Campaign Types, Auth/Client Concurrency, Non-Destructive Hydration & Account Sync)**:
  - **1. Shared Pure Campaign Types (`H1`, `src/core/campaigns/{types,index}.ts`)**:
    - Extracted `Campaign`, `CampaignStatus`, `CampaignType`, `CommissionSpec`, and `JoinMode` into `src/core/campaigns/types.ts` and redirected `src/features/marketer/campaigns/types.ts`, `src/features/merchant/campaigns/types.ts`, and `src/features/merchant/scanner/types.ts` cleanly with zero cross-role imports.
  - **2. Cryptographic UUID Idempotency Priority (`B4`, `src/core/api/idempotency.ts`)**:
    - Prioritized `globalThis.expo?.uuidv4?.()` before `crypto.randomUUID`, `crypto.getRandomValues`, and the fallback generator to avoid `Math.random()` on Hermes without extra native packages.
  - **3. Session Epoch & Instant Non-Refreshing SignOut (`B1`, `src/core/api/{types,client,index}.ts`, `src/features/auth/api.ts`, `src/core/auth/AuthContext.tsx`)**:
    - Added `sessionEpoch` (`getSessionEpoch`, `bumpSessionEpoch`) and identity-checked `refreshInFlight` cleanup across `runSingleFlightRefresh`, `clearAuthAndCache`, `establishSession`, `switchWorkspaceRole`, `hydrateSession`, and `signOut`.
    - Added `skipRefreshOn401` and `bearerToken` to `ApiRequestOptions`, wiped local tokens/cache/state immediately in `signOut`, and invoked `logoutSession(refreshToken, accessToken)` with `skipRefreshOn401: true`.
  - **4. Non-Destructive Offline/5xx Hydration & Retry UI (`B2`, `src/core/api/client.ts`, `src/core/auth/AuthContext.tsx`, `src/app/{_layout,index}.tsx`)**:
    - Restricted `clearAuthAndCache` and `wipeLocalSession` to definitive auth rejections (`401`, `403`, `AUTH_REQUIRED`, `SESSION_EXPIRED`, `REFRESH_TOKEN_INVALID`, or missing mobile role), preserving `SecureStore` tokens on `NETWORK_ERROR`/`API_NOT_CONFIGURED`/`5xx`/`429`.
    - Added `hydrationError` and `retryHydration` to `AuthContext`, allowed `BrandSplashOverlay` to dismiss on `hydrationError !== null`, and rendered a localized Retry / Sign Out recovery card in `src/app/index.tsx`.
  - **5. Role-Switch Hardening (`B5`, `src/core/auth/AuthContext.tsx`)**:
    - Enforced full `swrCache.clear()`, concurrent double-tap locking (`switchingRoleRef`), and post-`await` `sessionEpoch` verification in `switchWorkspaceRole`.
  - **6. Live Account & Merchant Verification Sync (`B6`, `src/core/auth/AuthContext.tsx`, `src/features/{auth,profile}/hooks.ts`, `src/features/merchant/dashboard/hooks.ts`, `src/app/merchant/{campaigns/new,(tabs)/scanner}.tsx`)**:
    - Added `syncAccount` in `AuthContext`, synced `/auth/me` results in `useProfileAccount` and `useAccountRefresh`, synced `verificationStatus` updates in `useMerchantDashboard`, and wired `useAccountRefresh` on focus/resume in `new.tsx` and `scanner.tsx` when `!isVerified`.
- **Prior Completed Action (Bugfix Prompt 2 — Dev Sandbox Contract Alignment `A4` in `src/core/dev/sandboxAdapter.ts`)**:
  - **1. Offer QR Token Format & Dual Lookup (`qrToken` + `passCode`)**:
    - Replaced colon-delimited `mardood-qr:...` tokens with `SCANNER_CODE_REGEX`-compliant `mardood-qr-${passCode}-${campaignIdSuffix}-${accountSuffix}` tokens and indexed all seeded/created passes by both `passCode` and `qrToken` via `registerSandboxOfferPass` / `findSandboxOfferPass`.
  - **2. Strict Auth Credential & Token Verification (`401`)**:
    - Replaced unconditional fallback to `DEMO_MARKETER_ACCOUNT` with `sandboxPasswordsByPhone` verification (`401 INVALID_CREDENTIALS`), enforced token pattern + revocation checks in `requireAuthenticatedAccount()` / `resolveAccountFromToken()` (`401 AUTH_REQUIRED`, `401 REFRESH_TOKEN_INVALID`), and revoked rotated/logged-out tokens.
  - **3. Account-Scoped Marketer Memberships (`${account.id}:${campaignId}`)**:
    - Replaced shared `membershipsByCampaignId` with `membershipsByAccountAndCampaign` keyed by `${account.id}:${campaignId}`, scoped `/marketer/memberships` pagination/status filtering per marketer, and generated account-unique referral codes.
  - **4. Marketer `/campaigns` Filtering, Pagination & Expiry**:
    - Enforced `isSandboxCampaignAvailable` (`status === 'active' && endsAt > now`), `?q=` (productName / shopName), `?campaignType=`, `?joinMode=`, and `?page=` / `?pageSize=` on `/campaigns` and `/campaigns/:campaignId`.
  - **5. Scanner Cashback Milestone Unlock (`api/src/scanner/cashback-milestone.ts`)**:
    - Added `BigInt` milestone unlock logic in `redeem-offer` (`milestonePurchaseCount >= 5 && milestoneSpendSyp >= 50000n`), moving `lockedCashbackSyp` to `availableCashbackSyp` / `totalCashbackUnlockedSyp`, resetting milestone progress on unlock, and syncing `account.customer`.
- **Prior Completed Action (Bugfix Prompt 1 — Env Security, Sandbox Tree-Shaking & Dependency Hygiene)**:
  - **1. Env Gitignore Hardening (`A1`, `.gitignore`)**:
    - Updated `.gitignore` to ignore `.env` and `.env.*` while preserving `!.env.example`.
  - **2. HTTPS Enforcement & Explicit Missing-API Error (`A2`, `src/core/config/env.ts`, `src/core/api/{client,errors}.ts`, `src/core/i18n/{types,ar,en}.ts`)**:
    - Restricted `http://` URLs to `__DEV__` only (`https://` required outside `__DEV__`) and prevented silent relative `/api/v1/...` fetches by throwing `ApiClientError(0, 'API_NOT_CONFIGURED', ...)` + localized `API_NOT_CONFIGURED` copy (`466 === 466` keys).
  - **3. Production Dead-Code Elimination for Dev Sandbox (`A3`, `src/core/api/client.ts`, `src/core/dev/credentials.ts`, `src/features/auth/hooks.ts`)**:
    - Replaced static `../dev` import in `client.ts` with `__DEV__ && env.useDevSandbox`-gated conditional `require('../dev')` and isolated demo quick-login credentials inside `src/core/dev/credentials.ts` under `__DEV__` guards.
  - **4. Unused Dependencies & Web Config (`A5`, `package.json`, `app.json`)**:
    - Verified zero usage and removed `expo-device`, `expo-glass-effect`, `expo-system-ui`, and `expo-web-browser` from `package.json`, and updated `app.json` `web.output` from `"server"` to `"single"`.
- **Prior Completed Action (Merchant Campaign End-Date System `DateTimePicker` Upgrade)**:
  - **1. Expo SDK 58 Dependency & CNG Plugin (`package.json`, `app.json`)**:
    - Installed `@react-native-community/datetimepicker` (`9.2.1`) via `npx expo install @react-native-community/datetimepicker` inside `hackathon-mobile/`, automatically registering the Expo config plugin in `app.json`.
  - **2. Date Helpers & Hook (`src/features/merchant/campaigns/{validation.ts,hooks.ts,index.ts}`)**:
    - Added `getMinimumCampaignEndDate()`, `buildEndOfDayIso(date)`, and `parseCampaignEndsAtToDate(rawEndsAt)`, aligned `buildFutureIsoFromDays(7)` to local end-of-day UTC ISO, and replaced `selectQuickDays` with `selectEndsAtDate(date)` (which resets `Idempotency-Key` on date change).
  - **3. Bilingual Dictionary & UI (`src/core/i18n/{types,ar,en}.ts`, `src/app/merchant/campaigns/new.tsx`)**:
    - Removed quick-day chips (`+3/+7/+14/+30`) and raw ISO text input; replaced with a `>= 48dp` `design.md`-styled date trigger displaying `formatCampaignDate(draft.endsAt, locale)` and opening the native system `DateTimePicker` (`design="material"` calendar dialog on Android with `Colors.action` `#B54718`, plus a `useOverlayBackRegistration`-guarded `Modal` inline picker on iOS) with Haptics and keyboard dismissal.
- **Prior Completed Action (Task 8 — Customer Cashback, Purchases & Profile Tab Screens)**:
  - **1. `src/app/customer/(tabs)/cashback.tsx` (`CustomerCashbackScreen`)**:
    - Wired `useCustomerDashboard()` (`GET /customer/dashboard`) with `#503C44` (`Colors.ink`) `BalanceCard` displaying `availableCashbackSyp`, `lockedCashbackSyp`, and `totalCashbackUnlockedSyp` via `formatSyp`.
    - Added server-driven «تقدم هدف الكاش باك» milestone progress section (`milestonePurchaseCount / milestonePurchasesRequired`, `formatSyp(milestoneSpendSyp) / formatSyp(milestoneSpendRequiredSyp)`, and `verifiedPurchaseCount`) with `useReducedMotion()`-aware Reanimated progress bars, `SkeletonBlock` loading states, pull-to-refresh, and fatal/inline error retry (strictly zero Cashback Voucher UI per Backlog boundary).
  - **2. `src/app/customer/(tabs)/purchases.tsx` (`CustomerPurchasesScreen`)**:
    - Wired `useCustomerPurchases()` (`GET /customer/purchases`) in a paginated `FlatList` keyed by `saleId` rendering `shopName`, `productName`, `quantity`, `customerPaidCashSyp`, `cashbackEarnedSyp`, and `scannedAt`, with pull-to-refresh, `SkeletonBlock` skeleton cards, empty state, error retry, and `loadMore` footer/scroll pagination.
  - **3. `src/app/customer/(tabs)/profile.tsx` (`CustomerProfileScreen`)**:
    - Wired `useProfileAccount()`, `useCustomerDashboard()`, `useLanguageSwitcher()`, `useSignOut()`, and `useAuth()` (`switchWorkspaceRole`) to display customer `name`, LTR-isolated `phone`, role badge, `verifiedPurchaseCount`, cashback summary, multi-role workspace switcher buttons (`marketer` / `merchant` when owned), `AR` RTL ↔ `EN` LTR toggle, and clean sign-out.
    - Enabled `useAndroidBack({ enabled: isFocused, isRootTab: true })` across all three tab screens.
- **Prior Completed Action (Task 7 — Customer Navigator Layout & Offers/QR Tab Screen)**:
  - **1. `src/app/customer/_layout.tsx` & `src/app/customer/(tabs)/_layout.tsx`**:
    - Updated `customer/_layout.tsx` `<Stack>` wrapper and created `customer/(tabs)/_layout.tsx` with 4 `useMemo`-stabilized tabs (`index` العروض/Offers, `cashback` الكاش باك/Cashback, `purchases` المشتريات/Purchases, `profile` الحساب/Profile), module-level icon components (`render*TabIcon`), `>= 48x48 dp` `TouchTarget` items, and reactive RTL/LTR `direction`.
    - Added temporary placeholder screens (`cashback.tsx`, `purchases.tsx`, `profile.tsx`) with `useAndroidBack({ enabled: isFocused, isRootTab: true })` so Expo Router resolves cleanly until Prompt 8.
  - **2. `src/app/customer/(tabs)/index.tsx` (`Offers` & `OfferQrPass` Screen)**:
    - Wired `usePublicOfferLookup`, `useCustomerOfferQr`, and `useCustomerRecentOffers` with referral code/link input, `expo-clipboard` quick paste button, search/clear actions, and `?code=` + `Linking.useURL()` (`r/[code]`) deep-link capture.
    - Rendered `PublicOffer` card with `sanitizeImageUrl` (`http://`/`https://` guard + shop monogram fallback), shop name & details, product name & description, backend-authoritative `originalPriceSyp` / `finalPriceSyp` / `discountPercent` (zero frontend math), `attributionLabel` & offer status badges, and `endsAt` expiry.
    - Wired «إصدار رمز العرض QR» button (`disabled={isIssuing || isLoading}`, `loading={isIssuing}`, Haptics on success/error), active `OfferQrPass` card via `QrCodeBox` (`qrToken`, LTR-isolated `passCode` `OF-...`, copy button), pass status badge (`active`/`redeemed`/`expired`), clear cash-in-store reminder (`qrCashReminder`), and `useAndroidBack({ enabled: isFocused, isBusy: isLoading || isIssuing, isRootTab: true })`.
  - **3. `src/core/i18n/{types,ar,en}.ts`**:
    - Added `customer.offers.pasteAction` (`'لصق'` / `'Paste'`) and aligned `qrCashReminder` copy with 100% key parity (`468 === 468` keys).
- **Prior Completed Action (Task 6 — Customer Dashboard & Purchases Feature Slices, No UI Screens)**:
  - **1. `src/features/customer/dashboard/` (`types.ts`, `api.ts`, `hooks.ts`, `index.ts`)**:
    - Defined `CustomerDashboard` aligned 1:1 with `CustomerDashboardDto` (`api/src/reporting/dto/customer-reporting.dto.ts`).
    - Implemented `fetchCustomerDashboard()` calling `GET /customer/dashboard` (`auth: true`).
    - Implemented `useCustomerDashboard()` backed by `useSWRResource` with `buildRoleCacheKey(userId, 'customer', 'dashboard')`, `20_000 ms` TTL (`CUSTOMER_DASHBOARD_CACHE_TTL_MS`), `useFocusEffect` revalidation, `AppState` foreground resume revalidation, and pull-to-refresh (`refresh`), passing authoritative backend fields directly with zero frontend arithmetic.
  - **2. `src/features/customer/purchases/` (`types.ts`, `api.ts`, `hooks.ts`, `index.ts`)**:
    - Defined `CustomerPurchase`, `CustomerPurchasePage`, and `FetchCustomerPurchasesParams` aligned 1:1 with `CustomerPurchaseDto` and `CustomerPurchasePageDto`.
    - Implemented `fetchCustomerPurchases({ page, pageSize })` calling `GET /customer/purchases` (`auth: true`) with `page`/`pageSize` clamping.
    - Implemented `useCustomerPurchases()` with `buildRoleCacheKey(userId, 'customer', 'purchases')` (`20_000 ms` TTL), `Map<string, CustomerPurchase>` deduplication via `mergeCustomerPurchasesBySaleId` keyed by `saleId`, `Set<number>` in-flight page guard, `useFocusEffect` + `AppState` resume refresh, and pull-to-refresh (`refresh`) + `loadMore`.
  - **3. Role Isolation & Scope**: Verified zero cross-imports between `src/features/customer/` and `src/features/{marketer,merchant}/`, and left `src/app/customer/(tabs)/` UI screens untouched per task boundary.
- **Prior Completed Action (Expo Router SDK 58 `Maximum update depth exceeded` / `RoutingQueueDrainer` Fix — Tasks 1–5 + Phase 3.2.1/3.2.2 Core & Auth)**:
  - **Task 1 — Compiler Stabilization (`app.json`)**:
    - Set `"reactCompiler": false` under `expo.experiments` in `app.json` while keeping `"typedRoutes": true`.
  - **Task 2 & Task 3 — Route Collision Elimination (`marketer/` & `merchant/`)**:
    - Moved `src/app/(marketer)/` -> `src/app/marketer/` (6 files) and updated Marketer `Href` targets (`'/marketer/campaigns/${campaignId}'`, `'/marketer'`). Deleted `src/app/(marketer)/`.
    - Moved `src/app/(merchant)/` -> `src/app/merchant/` (9 files) and updated Merchant `Href` targets across `merchant/(tabs)/{index,campaigns}.tsx`, `merchant/campaigns/{new,[id]}.tsx`, and `src/features/merchant/campaigns/hooks.ts` (`'/merchant/campaigns/new'`, `'/merchant/scanner'`, `'/merchant/campaigns'`, `'/merchant/campaigns/${created.id}'`). Deleted `src/app/(merchant)/`.
    - Eliminated all cross-group URL collisions on `/`, `/wallet`, `/profile`, and `/campaigns/[id]` while preserving strict role isolation and all `@/*` domain imports.
  - **Task 4 — Neutral Root `/` Gate (`src/app/index.tsx`) & Explicit `Stack.Protected` `redirectTo` (`src/app/_layout.tsx`)**:
    - Created unguarded `src/app/index.tsx` rendering only a `Colors.canvas` `<View>` under `<BrandSplashOverlay />` and dispatching a single `router.replace(...)` via `useIsFocused()` + `useEffect()` once `status !== 'hydrating'` (`'/(auth)/login'`, `'/marketer'`, `'/merchant'`, or `'/workspace-select'`), with zero `<Redirect>` during render.
    - Updated `src/app/_layout.tsx` (`RootNavigator`) to mount `<Stack initialRouteName="index" screenOptions={ROOT_STACK_SCREEN_OPTIONS}>` with an unguarded `<Stack.Screen name="index" />` and 4 mutually exclusive `<Stack.Protected>` guards (`marketer`, `merchant`, `workspace-select`, `(auth)`) each wired with explicit `redirectTo` targets (`authenticatedRedirect` and `workspaceExitRedirect`).
  - **Task 5 — Stale Reference Audit & Governance Sync**:
    - Audited `src/` and confirmed zero remaining references to `(marketer)`, `(merchant)`, `(auth)/index`, or `<Redirect`.
    - Synced route folder references in `AGENTS.md` (`marketer/`, `merchant/`, `src/app/index.tsx`) without altering any security or architectural rules.
  - **Prior Foundation (Already Preserved)**:
    - `src/app/(auth)/index.tsx` remains deleted (`initialRouteName="login"` + `unstable_settings = { anchor: 'login' }` in `(auth)/_layout.tsx`), and all navigator `screenOptions`, screen `options`, and `tabBarIcon` helpers remain module-constant or `useMemo`-stabilized.
- **Previous Audit Baseline (Pre-Android-Build Comprehensive Audit & Live Setup Docs)**:
  - **Security & Workspace Isolation Audit**: Verified `AuthContext.tsx`, `tokenStorage.ts`, `buildRoleCacheKey(userId, role, ...)`, and `__DEV__ && EXPO_PUBLIC_USE_DEV_SANDBOX === 'true'` gating.
  - **Currency Minor Units (`scale 100`) & RTL/LTR Parity Audit**: Verified `BigInt` `formatSyp` / `parseNewSypToMinorUnits`, `381` `ar.ts`/`en.ts` key parity, and `StatusBadge` `forceLtr` on scanned `OF-...` codes.

## 2. Project File & Cleanup Status

- **Completed (Code — Phase 0 + Phase 1 + Phase 1.5 + Phase 2.0–2.5 + Phase 3.1 + Pre-Build Audit)**:
  - Governance & tracking docs: `AGENTS.md`, `ROADMAP.md`, `HANDOVER.md`, `README.md`, `eas.json`, `.env.example`, `app.json` (with `expo-camera` CNG plugin).
  - Assets: `assets/fonts/IBMPlexSansArabic-{Regular,SemiBold,Bold}.ttf` + verified Mardood logo, splash, and adaptive icon PNGs in `assets/images/`.
  - Core modules: `theme/`, `i18n/`, `rtl/` (Minor-Unit `BigInt` formatter & parser), `config/`, `auth/` (dual-role guards + SecureStore `activeRole`), `api/` (`idempotency.ts` + expanded `errors.ts` + dual-role refresh), `cache/` (`${userId}:${role}:...` namespace isolation), `navigation/` (`useAndroidBack`, `useOverlayBackRegistration`), `dev/` (offline-only sandbox gated by `__DEV__ && EXPO_PUBLIC_USE_DEV_SANDBOX === 'true'`).
  - UI primitives: `src/components/ui/` (`AppButton`, `AppInput`, `BalanceCard`, `BrandMark`, `BrandSplashOverlay`, `CampaignCard`, `StatusBadge` with `forceLtr`, `SkeletonBlock`, `CampaignCardSkeleton`, `index.ts`).
  - Features: `src/features/{auth,profile}/`, `src/features/customer/{offers,dashboard,purchases}/`, `src/features/marketer/{campaigns,wallet}/`, `src/features/merchant/{dashboard,wallet,campaigns,scanner}/`.
  - Routes & UI Primitives: `src/components/ui/QrCodeBox.tsx`, `src/app/_layout.tsx` (5 `Stack.Protected` guards + `r/[code]`), `src/app/index.tsx`, `src/app/r/[code].tsx`, `src/app/workspace-select.tsx`, `src/app/(auth)/{_layout,login,register}`, `src/app/customer/{_layout,(tabs)/{_layout,index,cashback,purchases,profile}}`, `src/app/marketer/{_layout,(tabs)/{_layout,index,wallet,profile},campaigns/[id]}`, `src/app/merchant/{_layout,(tabs)/{_layout,index,campaigns,scanner,wallet,profile},campaigns/{new,[id]}}`. (`src/app/(auth)/index.tsx`, `src/app/(marketer)/`, and `src/app/(merchant)/` removed).
- **Remaining (Phase 3.2.4 UI)**: None — all 4 Customer tabs (`Offers`, `Cashback`, `Purchases`, `Profile`) are complete.
- **Remaining (Phase 4 — Waiting on Backend)**:
  - Phase 4.1, 4.2 & 4.3 backlog endpoints (`/marketer/payouts*`, `/public/leaderboard`, store discounts, `/customer/cashback-vouchers*`, participant approvals).

## 3. Backend API Wiring Matrix (`api/src/` & `../Hacjathon file/docs/handoff/API_CONTRACT.md`)

### A. Authentication & Sessions
| Endpoint | Backend (`api/src/`) | Mobile Status | Notes |
| --- | --- | --- | --- |
| `POST /auth/login` | Ready | Complete (`Phase 2.0`) | Unified Marketer & Merchant login (`__DEV__` sandbox buttons hidden when `EXPO_PUBLIC_USE_DEV_SANDBOX=false`) |
| `POST /auth/register` | Ready (`RegisterDto`) | Complete (`Phase 2.0`) | Supports `marketer` / `merchant` / both + conditional `shop: { name, details }` |
| `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Ready | Complete (`Phase 1.5.2`) | Single-flight refresh mutex, `hasSupportedMobileRole`, `SecureStore` + SWR wipe |

### B. Marketer Workspace (`marketer/`)
| Endpoint | Backend (`api/src/`) | Mobile Status | Notes |
| --- | --- | --- | --- |
| `GET /campaigns`, `GET /marketer/memberships` | Ready | Complete (`Phase 1.2`) | Isolated in `src/features/marketer/campaigns/` & `${userId}:marketer:...` |
| `GET /campaigns/:campaignId`, `/membership` | Ready | Complete (`Phase 1.3`) | Guarded route `/marketer/campaigns/[id]` |
| `POST /marketer/campaigns/:campaignId/join` | Ready | Complete (`Phase 1.3`) | `Set` dedupe, rollback, native `Share.share` + clipboard |
| `GET /marketer/wallet` | Ready | Complete (`Phase 1.4` + `3.1`) | `${userId}:marketer:wallet:summary`; separated available, pending payout & total earned |
| `GET /marketer/wallet/transactions`, `/by-merchant`, `GET /marketer/stats` | Ready (`marketer-reporting.controller.ts`) | Complete (`Phase 3.1`) | `${userId}:marketer:wallet:{stats,by-merchant,transactions}` with sub-tabs & pagination |
| `/marketer/payouts*`, `GET /public/leaderboard` | Not in `api/src/` yet | Backlog (`Phase 4.2`) | Blocked on backend implementation |

### C. Merchant Workspace (`merchant/`)
| Endpoint | Backend (`api/src/`) | Mobile Status | Notes |
| --- | --- | --- | --- |
| `GET /merchant/dashboard` | Ready (`merchant-reporting.controller.ts`) | Complete (`Phase 2.1`) | `${userId}:merchant:dashboard` SWR cache, Minor Units, quick actions & verification banner |
| `GET /merchant/wallet`, `GET /merchant/wallet/transactions` | Ready (`merchant-reporting.controller.ts`) | Complete (`Phase 2.2`) | `${userId}:merchant:wallet:*` SWR cache, Minor Units, `Map` pagination dedupe & all 5 kinds |
| `GET /merchant/campaigns`, `GET /merchant/campaigns/:campaignId` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.3`) | Status tabs, progress bar, Minor-Unit reserves, pagination & stats |
| `POST /merchant/campaigns/:campaignId/close` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.3`) | Explicit confirm modal, `Set` dedupe & cross-cache release invalidation |
| `POST /merchant/campaigns/preview` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.4`) | Debounced `AbortController` live preview (`product` + `fixed` commission) |
| `POST /merchant/campaigns` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.4`) | Verified merchant + payload-bound `Idempotency-Key` UUID v4 + cross-cache invalidation |
| `POST /merchant/scanner/lookup` | Ready (`scanner.controller.ts`) | Complete (`Phase 2.5`) | Focus-gated `CameraView` + manual input (`OF-DEMO01`), cooldown, permission fallback & cash preview |
| `POST /merchant/scanner/redeem-offer` | Ready (`scanner.controller.ts`) | Complete (`Phase 2.5`) | `quantity: 1`, code-bound `Idempotency-Key`, full breakdown receipt, auto-close banner & cache invalidation |
| `POST /merchant/scanner/redeem-voucher`, `preview-offer`, `store_discount`, `participants`, active `directReferralUrl` | Not in `api/src/` yet | Backlog (`Phase 4.1`) | Blocked on backend implementation |

### D. Customer Workspace (`customer/`)
| Endpoint | Backend (`api/src/`) | Mobile Status | Notes |
| --- | --- | --- | --- |
| `GET /public/referrals/:code` | Ready (`referral.controller.ts`) | Complete (`Phase 3.2.3`) | `customer/(tabs)/index.tsx` + `src/features/customer/offers/` with `?code=`/`r/[code]` deep link & clipboard paste |
| `POST /public/referrals/:code/clicks` | Ready (`referral.controller.ts`) | Complete (`Phase 3.2.3`) | Empty POST deduped via `Set<string>` on active offer load in `customer/(tabs)/index.tsx` |
| `POST /customer/referrals/:code/offer-qr` | Ready (`referral.controller.ts`) | Complete (`Phase 3.2.3`) | `QrCodeBox`, LTR `OF-...` `passCode`, status badge, cash reminder & `SELF_PROMOTION_FORBIDDEN` hint |
| `GET /customer/dashboard` | Ready (`customer-reporting.controller.ts`) | Complete (`Phase 3.2.4`) | `cashback.tsx` & `profile.tsx` + `src/features/customer/dashboard/` (`${userId}:customer:dashboard` SWR, 20s TTL; zero frontend math) |
| `GET /customer/purchases` | Ready (`customer-reporting.controller.ts`) | Complete (`Phase 3.2.4`) | `purchases.tsx` paginated `FlatList` + `src/features/customer/purchases/` (`${userId}:customer:purchases` SWR, `Map` `saleId` dedupe) |
| `POST /customer/cashback-vouchers`, `GET /customer/cashback-vouchers`, `POST .../cancel` | Not in `api/src/` yet | Backlog (`Phase 4.3`) | Blocked on backend implementation (`AGENTS.md` forbids building Backlog UI early) |

## 4. Verification Status

- **Current Verification (Post Bugfix Prompt 10 — Final Codebase Audit)**:
  - TypeScript AST parse check across all `119` files in `hackathon-mobile/src/`: Passed (`0` syntax/parse errors).
  - Cross-role isolation, timer hygiene & log leak audit across `hackathon-mobile/src/`: Passed (`0` cross-imports between `customer`, `marketer`, and `merchant`; `0` `console.log` calls; `0` uncleaned `setTimeout`/`setInterval` timers).
  - Dictionary parity (`ar.ts` vs `en.ts` via `tsx`): Passed (`457 === 457` keys, `0` missing in either locale).
  - Unit tests (`tsx` against `swrCache.ts` and `merchant/campaigns/validation.ts`): Passed (`markStale`/`markStalePrefix`/`isRevalidating`, `100%` discount rejection, `finalPrice <= 0n` & `merchantNetSyp <= 0n` threshold checks, and Damascus/UTC end-date helpers).
  - Note: `hackathon-mobile/node_modules/` is not installed in the container, so `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor` must be run locally after `npm install`.
- **Prior Verification (Post Bugfix Prompt 9)**:
  - TypeScript AST parse check across all 13 modified Prompt 9 files (`i18n/{types,ar,en}.ts`, `marketer/campaigns/{types,api,hooks,index}.ts`, `marketer/wallet/{hooks,index}.ts`, `marketer/(tabs)/{index,wallet,profile}.tsx`, `marketer/campaigns/[id].tsx`): Passed (`0` parse errors).
  - Dictionary parity (`ar.ts` vs `en.ts` via `tsx --eval`): Passed (`457 === 457` keys, `0` missing) including `campaigns.loadMore` and `campaigns.loadingMore`.
  - Cross-role isolation audit across `src/features/` and `src/app/marketer/`: Passed (`0` cross-imports between `customer`, `marketer`, and `merchant`, and `0` leftover `isRefreshingAll` / `isLoadingMoreRef` references).
  - Note: `hackathon-mobile/node_modules/` is not installed in the current workspace, so `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor` require running locally after `npm install`.
- **Prior Verification (Post Bugfix Prompt 8)**:
  - TypeScript AST parse check across all 7 modified Prompt 8 files (`offers/types.ts`, `offers/hooks.ts`, `purchases/hooks.ts`, `customer/(tabs)/{index,purchases,cashback,profile}.tsx`): Passed (`0` parse errors).
  - Unit & i18n check via `tsx --eval`: Verified `extractReferralCode` against direct codes, `/r/<code>`, `?code=` query params, `https://...`, and `alsalamiyahoffers://...` deep links (`13` assertions passed), and confirmed `ar.ts` === `en.ts` parity (`455 === 455` keys).
  - Cross-role isolation audit across `src/features/`: Passed (`0` cross-imports between `customer`, `marketer`, and `merchant`).
  - Note: `hackathon-mobile/node_modules/` is not installed in the current workspace, so `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor` require running locally after `npm install`.
- **Prior Verification (Post Bugfix Prompt 7)**:
  - TypeScript AST parse check across all 7 modified Prompt 7 files (`BalanceCard.tsx`, `QrCodeBox.tsx`, `CampaignCard.tsx`, `AppInput.tsx`, `StatusBadge.tsx`, `src/features/auth/hooks.ts`, `src/app/(auth)/register.tsx`): Passed (`0` parse errors).
  - Dictionary parity (`ar.ts` vs `en.ts` via `tsx --eval`): Passed (`455 === 455` keys, `0` missing) and confirmed all `QrCodeBox` strings resolve via `t.qrCodeBox.*`.
  - Cross-role isolation audit across `src/features/`: Passed (`0` cross-imports between `customer`, `marketer`, and `merchant`).
- **Prior Baseline Verification (Post Bugfix Prompt 1 & `DateTimePicker` Upgrade)**:
  - `./hackathon-mobile/node_modules/.bin/tsc -p hackathon-mobile/tsconfig.json --noEmit`: Passed (exit code `0`, 0 errors).
  - `npm --prefix hackathon-mobile run lint` (`expo lint`): Passed (exit code `0`, 0 errors, 0 warnings).
  - `env -C hackathon-mobile npx --yes expo-doctor`: Passed (exit code `0`, `20/20` checks passed, 0 issues).
  - `ar.ts` vs `en.ts` key parity check: Passed (`465` keys === `465` keys, 0 missing).
  - Cross-role & Backlog isolation audit across `src/features/customer/` and `src/app/customer/`: Passed (0 cross-imports from `marketer`/`merchant`; 0 Backlog voucher UI).

## 5. Approved Demo Seed Reference & Live Android Runbook

> **Backend Seed Note**: `../api/prisma/DEMO_SEED.md` lives in the root `api/` workspace (`api/` is synced from the team backend repo). In accordance with `../Hacjathon file/docs/handoff/API_CONTRACT.md` (*Shared demo seed and API examples*), live demo passwords are kept in local `.env` / team setup and are **never stored in mobile code or docs**.

- **Seeded Live Roles & Fixtures**:
  - **Marketer-only** (`0999100003`, `0999100006`), **Verified Merchant-only** (`0999100002` with `100,000` available; `0999100005` with `435,000` campaign reserve), **Customer-only** (`0999100004`, `0999100007` — adding mobile support in `Phase 3.2`), and **Admin-only** (`0999100001` — stays blocked on mobile by `hasSupportedMobileRole`).
  - **Seeded Scanner Code**: `OF-DEMO01` (`90,000` minor units / `900.00 SYP` cash due -> `10,000` commission, `4,500` platform fee [`1,800` customer cashback + `2,700` platform net], `435,000` initial reserve -> `420,500` remaining).
- **Live Backend + Android Development Build Steps**:
  1. Set `.env`: `EXPO_PUBLIC_API_URL=<live-url>`, `EXPO_PUBLIC_WEB_URL=<live-web-url>`, `EXPO_PUBLIC_USE_DEV_SANDBOX=false`.
  2. Build Dev Client APK: `eas build --profile development --platform android` (or `npx eas-cli build --profile development --platform android`) and install the `.apk` on Android.
  3. Start Metro with clean cache: `npx expo start --dev-client -c` and test full real-camera `expo-camera` QR scanning, live auth, campaign launch, and redemption settlement.

## 6. Exact Next Step (Next Prompt)

- **Local Pre-Release Verification & Native Build**:
  - Run `npm install` inside `hackathon-mobile/`, verify `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor`, then proceed with EAS Android Dev Client build (`eas build --profile development --platform android`) and live E2E verification against the backend.
