# Live Handover & Progress Log (`HANDOVER.md`) — Mobile App

> **Mandatory Rule**: Update this file at the end of **every executed prompt** inside `hackathon-mobile/` so the exact project status, verification state, and next action remain 100% accurate.

---

## 1. Current Status

- **Current Phase**: **Merchant Campaign Image Upload — Expo SDK 58 `FormData` `XMLHttpRequest` Multipart Transport & Error Classification Fix Complete**.
- **Last Completed Action (Campaign Image Multipart Upload XHR & Error Classification Fix — Mobile Only)**:
  - **1. Native `XMLHttpRequest` Multipart Path (`src/core/api/client.ts`)**:
    - Routed `isFormData === true` requests inside `executeRawFetch` through internal `executeMultipartXhr(...)` using `XMLHttpRequest` instead of Expo SDK 58's WinterCG `expo/fetch` (whose `convertFormDataAsync` rejects React Native `{ uri, name, type }` `FormData` parts with `Unsupported FormDataPart implementation`).
    - Passed `Accept`, `Authorization`, and `Idempotency-Key` headers while stripping any manual `Content-Type` header so Android/OkHttp generates `multipart/form-data; boundary=...` automatically; preserved `timeoutMs` (`xhr.timeout` + `timeoutMs + 500` safety timer), `externalSignal` (`AbortSignal`), `HttpResponseLike` adapter compatibility, and `401` single-flight refresh retries (`runSingleFlightRefresh()`).
  - **2. Refined Abort vs Network vs Client Error Classification (`src/core/api/client.ts`)**:
    - Separated external `AbortSignal` cancellations (`createAbortError()`, `name: 'AbortError'`) from genuine timeouts/network failures (`NETWORK_ERROR`), added `isLikelyFetchNetworkError` (matching Expo `FetchError` / `fetch failed:` and non-`unsupported` `TypeError`s), and stopped masking non-network `FormData`/`BodyInit` errors as `NETWORK_ERROR`.
  - **3. Hardened Image `FormData` Asset Normalization (`src/features/merchant/campaigns/api.ts`)**:
    - Validated non-empty trimmed `uri` (`ApiClientError(400, 'VALIDATION_ERROR', ...)`), normalized MIME (`'image/jpg'` / empty -> `'image/jpeg'`) and fallback filename, and appended strictly the single `'file'` part (`{ uri, name, type }`) compatible with `POST /merchant/uploads/image` (`api/` & `sandboxAdapter.ts`).
- **Prior Completed Action (Campaign Image Local File Byte-Size Fix — Mobile Only)**:
  - **1. SDK 58 `expo-file-system` Dependency (`package.json`, `package-lock.json`)**:
    - Restored `node_modules/` via `npm ci` and declared `"expo-file-system": "~58.0.14"` via `npx expo install expo-file-system` (matching `expo` `~58.0.26` with zero manual edits to `android/` or `ios/`).
  - **2. Local File Size Measurement, Reason Classification & Cache Cleanup (`src/features/merchant/campaigns/imageUpload.ts`, `index.ts`)**:
    - Replaced React Native `fetch(file://...)` + `response.blob()` inside `readLocalFileByteSize` with zero-copy native `new File(uri)` (`file.exists` / `file.size`) from `expo-file-system`, plus an `AbortSignal`-aware `XMLHttpRequest` (`responseType = 'blob'`) fallback for non-`file://` URIs (`content://`, `blob:`) accepting `status === 0` or `2xx` and closing blobs after reading `size`.
    - Added typed `CampaignImageCompressionFailureReason` (`'SIZE_LIMIT_EXCEEDED' | 'FILE_READ_FAILED' | 'PROCESSING_FAILED'`) on `CampaignImageCompressionError` (exported via `index.ts`), wrapped `ImageManipulator` failures cleanly as `'PROCESSING_FAILED'`, and cleaned up superseded/oversized temporary cache files via `File.delete()`.
  - **3. Bilingual Error Mapping Separation (`src/core/i18n/{types,ar,en}.ts`, `src/features/merchant/campaigns/hooks.ts`)**:
    - Added `merchant.createCampaign.imageReadFailedError` across `types.ts`, `ar.ts`, and `en.ts` (`502 === 502` parity).
    - Updated `runCompressAndUpload` in `hooks.ts` so `imageCompressionFailedError` is shown **only** when `err.reason === 'SIZE_LIMIT_EXCEEDED'`, while local read/processing failures map to `imageReadFailedError`.
- **Prior Completed Action (Marketer Simulated Payouts Integration — Phases 1–5)**:
  - **1. Error Mapping & Bilingual Dictionaries (`src/core/api/errors.ts`, `src/core/i18n/{types,ar,en}.ts`)**:
    - Added `'PAYOUT_ALREADY_PENDING'` and `'PAYOUT_AMOUNT_CHANGED'` to `KNOWN_ERROR_CODES`, `ApiErrorCodeKey`, and bilingual `errors` dictionaries (`ar.ts` & `en.ts`).
    - Added full bilingual `wallet.*` payout copy (summary card label, request action, confirmation modal, conflict/amount-changed/already-pending notices, status filters, status badges, rejection reason label, and empty/error states).
  - **2. Payout Types, API Client & Dev Sandbox Parity (`src/features/marketer/wallet/{types,api,index}.ts`, `src/core/dev/sandboxAdapter.ts`)**:
    - Extended `MarketerWallet` with `totalConfirmedPaidOutSyp` and added `PayoutStatus`, `MarketerPayout`, `CreateMarketerPayoutInput`, and `FetchMarketerPayoutsParams` matching `api/src/payout/payout.dto.ts`.
    - Implemented `fetchMarketerPayouts` (`GET /marketer/payouts`) and `requestMarketerPayout` (`POST /marketer/payouts` expecting `expectedAmountSyp` and `201`), plus full per-account simulated payout state, hold/confirm/reject ledger parity, and `409 PAYOUT_ALREADY_PENDING` / `409 PAYOUT_AMOUNT_CHANGED` validation in `src/core/dev/sandboxAdapter.ts`.
  - **3. SWR Cache Sync, Paginated Payouts Hook & Mutation Hook (`src/features/marketer/wallet/{hooks,index}.ts`)**:
    - Added `getMarketerPayoutsCachePrefix`, `getMarketerPayoutsCacheKey`, and non-destructive `syncMarketerPayoutCaches` (`swrCache.markStale` / `swrCache.markStalePrefix`).
    - Implemented `useMarketerPayouts` (status-filtered pagination, `AbortController`, `inFlightPagesRef`, `applyFirstPageSnapshot`) and `useRequestMarketerPayout` (`isSubmittingRef`, `isMountedRef`, `sessionEpoch`, `409` conflict recovery + immediate wallet revalidation, `201` list prepend + silent background sync).
  - **4. Marketer Wallet UI (`src/app/marketer/(tabs)/wallet.tsx`)**:
    - Added `wallet-confirmed-paid-out-card` (`totalConfirmedPaidOutSyp`), `BalanceCard.action` states (CTA button / high-contrast `pending_review` notice / zero-balance disabled state), dismissible `marketer-payout-created-banner`, `Modal` confirmation registered with `useOverlayBackRegistration` + `useAndroidBack`, and a 4th `'payouts'` sub-tab with `2×2` wrapping tab bar, `Radii.control` status filters, and rejection reason callouts (zero Admin UI added).
  - **5. Obsolete Contract Cleanup & Documentation Sync (Phase 5)**:
    - Removed obsolete `'payout_transfer_reversal'` across `wallet/types.ts`, `wallet.tsx`, `src/core/i18n/{types,ar,en}.ts`, and `src/core/dev/sandboxAdapter.ts` (`0` remaining matches in `src/`) to match the 4 backend `marketerKinds` in `api/src/reporting/dto/marketer-reporting.dto.ts`.
    - Updated `HANDOVER.md` and `ROADMAP.md` (`4.2`) while keeping real transfers (Sham Cash receipts/confirm/dispute) and `GET /public/leaderboard` in Backlog.
- **Prior Completed Action (Image Upload Phase 5 — Create Campaign UI, i18n Cleanup & Final Gate)**:
  - **1. Product Image UI (`src/app/merchant/campaigns/new.tsx`)**:
    - Removed `imageUrlRef` and manual `<AppInput testID="campaign-image-url-input" />`, replacing them inside `formCard` with a `design.md`-compliant «صورة المنتج / Product image» section featuring `>= 48dp` Gallery & Camera `AppButton` actions (`campaign-image-gallery-button`, `campaign-image-camera-button`), `expo-image` preview (`campaign-image-preview`) with reduced-motion transition, compression/upload `ActivityIndicator` (`campaign-image-status-loading`), `StatusBadge` `'success'` indicator (`campaign-image-status-uploaded`), error banner with Retry & Open Settings (`campaign-image-retry-button`, `campaign-image-open-settings-button`), Remove action (`campaign-image-remove-button`), inline `fieldErrors.imageUrl`, and verified-merchant hint.
    - Updated `isSubmitDisabled` to require `!isImageBusy && Boolean(draft.imageUrl.trim())` while keeping `useAndroidBack({ enabled: isFocused, isBusy: isLaunching, isRootTab: false })`.
  - **2. Validation & i18n Cleanup (`src/features/merchant/campaigns/validation.ts`, `src/core/i18n/{types,ar,en}.ts`)**:
    - Replaced obsolete `imageUrlTooLong` and `imageUrlInvalid` validation fallbacks with `t.errors.IMAGE_UPLOAD_FAILED` and removed all 5 obsolete manual-URL keys (`imageUrlLabel`, `imageUrlPlaceholder`, `imageUrlRequired`, `imageUrlInvalid`, `imageUrlTooLong`) across `types.ts`, `ar.ts`, and `en.ts` (`473 === 473` parity, 0 leftover references).
- **Prior Completed Action (Image Upload Phase 4 — Hook & Validation Logic)**:
  - **1. Validation Update (`src/features/merchant/campaigns/validation.ts`)**:
    - Kept `imageUrl: string` in `CampaignDraftFormInput` and `LaunchCampaignInput` to preserve `POST /merchant/campaigns` payload compatibility, switched empty `trimmedImageUrl` error to `t.merchant.createCampaign.imageRequiredError`, and preserved `MAX_CAMPAIGN_IMAGE_URL_LENGTH` + `isSafeHttpUrl` defense-in-depth checks.
  - **2. Create Campaign Hook Orchestration (`src/features/merchant/campaigns/hooks.ts`, `index.ts`)**:
    - Added and exported `CampaignImageUploadStatus` (`'idle' | 'compressing' | 'uploading' | 'uploaded' | 'error'`) and `CampaignImagePermissionType` (`'gallery' | 'camera'`).
    - Added `selectedImageUri`, `imageUploadStatus`, `imageUploadError`, `imagePermissionDenied`, `isImageBusy`, `pickCampaignImageFromGallery()`, `captureCampaignImageWithCamera()`, `retryImageUpload()`, and `removeCampaignImage()` with SDK 58 `mediaTypes: ['images']`, permission checks, verified-merchant check, `AbortController` + `uploadSeqRef` race fencing, `isMountedRef` unmount cleanup, `idempotencySlotRef` resets on any `updateField` or image change, and `isImageBusy` guard inside `submit()`.
- **Prior Completed Action (Image Upload Phase 3 — Compression, Upload API & Sandbox)**:
  - **1. SDK 58 Iterative Compression Service (`src/features/merchant/campaigns/imageUpload.ts`, `index.ts`)**:
    - Implemented `compressCampaignImageForUpload(uri, signal?)` using SDK 58 `ImageManipulator.manipulate(uri, { maxWidth, maxHeight })` + `ImageManipulatorContext.renderAsync()` + `ImageRef.saveAsync({ format: SaveFormat.JPEG, compress })` (non-deprecated API, explicit `.release()` cleanup, and never upscaling smaller images).
    - Applied iterative resize/quality ladder (`1200@0.80` -> `1200@0.65` -> `1000@0.55` -> `800@0.45`) with `readLocalFileByteSize` (`fetch` + `Blob.size`) targeting `SAFE_CLIENT_IMAGE_BYTES = 490_000` (hard cap `MAX_BACKEND_IMAGE_BYTES = 500_000`), throwing `CampaignImageCompressionError` if still oversized or `AbortError` when canceled.
  - **2. Upload API Helper (`src/features/merchant/campaigns/api.ts`, `index.ts`)**:
    - Implemented and exported `uploadMerchantCampaignImage(asset, signal?)` building a strict single-part `FormData` (`'file'` field only with `{ uri, name, type }`) and calling `POST /merchant/uploads/image` with `auth: true`, `signal`, and `timeoutMs: 30_000`.
  - **3. Dev Sandbox Endpoint (`src/core/dev/sandboxAdapter.ts`)**:
    - Added `POST /merchant/uploads/image` enforcing `merchant` role, `verificationStatus === 'verified'` (`403 MERCHANT_NOT_VERIFIED`), React Native `getParts()` / standard `entries()` single `'file'` validation (`400 VALIDATION_ERROR`), `500_000`-byte cap (`413 IMAGE_TOO_LARGE`), and static `image/jpeg | image/png | image/webp` MIME validation (`415 UNSUPPORTED_IMAGE_FORMAT`).
- **Prior Completed Action (Image Upload Phase 2 — Network Multipart & Dictionaries)**:
  - **1. Multipart `FormData` Support (`src/core/api/client.ts`)**:
    - Updated `executeRawFetch` to detect `options.body instanceof FormData`, omit manual `Content-Type: application/json` (letting React Native inject the `multipart/form-data; boundary=...` header automatically), and pass the `FormData` instance directly to `fetch` without `JSON.stringify`, while preserving `Authorization: Bearer`, custom `timeoutMs`, and `401` single-flight refresh retry.
  - **2. Media Error Codes (`src/core/api/errors.ts`, `src/core/i18n/{types,ar,en}.ts`)**:
    - Added `'IMAGE_TOO_LARGE'`, `'UNSUPPORTED_IMAGE_FORMAT'`, `'IMAGE_UPLOAD_FAILED'`, and `'IMAGE_UPLOAD_UNAVAILABLE'` to `KNOWN_ERROR_CODES`, `ApiErrorCodeKey`, and localized `errors` dictionaries (`ar.ts` & `en.ts`).
  - **3. Campaign Product Image Keys (`src/core/i18n/{types,ar,en}.ts`)**:
    - Added 17 localized `merchant.createCampaign.*` keys covering gallery/camera selection, compression/upload progress, errors, permission prompts, and verified-merchant gating (keeping legacy `imageUrl*` keys temporarily until Phase 5 removes `campaign-image-url-input` in `new.tsx`).
- **Prior Completed Action (Image Upload Phase 1 — Packages & CNG Config Plugin)**:
  - **1. SDK 58 Dependencies (`package.json`, `package-lock.json`)**:
    - Restored `node_modules/` via `npm ci` and installed `expo-image-picker` (`~58.0.10`) and `expo-image-manipulator` (`~58.0.16`) via `npx expo install expo-image-picker expo-image-manipulator`.
    - Verified installed SDK 58 `.d.ts` definitions: `expo-image-picker` uses `MediaType[]` (`['images']`, `MediaTypeOptions` deprecated) and `ImagePicker.launchImageLibraryAsync` / `launchCameraAsync`; `expo-image-manipulator` exposes `ImageManipulator.manipulate(...)` + `ImageManipulatorContext` (`manipulateAsync` deprecated) and `SaveFormat.JPEG`.
  - **2. CNG Permissions Plugin (`app.json`)**:
    - Added `"expo-image-picker"` plugin with Arabic `photosPermission`, unified Arabic `cameraPermission` compatible with `expo-camera`, and `microphonePermission: false` (blocking `RECORD_AUDIO` consistently with `expo-camera`'s `recordAudioAndroid: false`), with zero manual edits to `android/` or `ios/`.
- **Prior Completed Action (Mobile Logout Concurrency Gate & Refresh-Before-Revoke Fix)**:
  - **1. Sign-Out Refresh Gate (`src/core/api/{client,index}.ts`)**:
    - Added epoch-scoped `activeSignOutEpoch` and `pendingSignOutBlockEpoch` with `holdSignOutBlockingRefresh`, `beginSignOutGate`, `endSignOutGate`, `isSignOutInProgress`, and bounded `awaitActiveRefresh(timeoutMs)` (race-safe with guaranteed `clearTimeout` cleanup).
    - Guarded `runSingleFlightRefresh()` to return `null` immediately when `isSignOutInProgress()` is true, and guarded `clearAuthAndCache()` so background `401` failures during sign-out cannot bump `sessionEpoch`, wipe tokens early, or fire `sessionExpiredListener`.
    - Updated `bumpSessionEpoch()` to clear both gate epochs automatically so any fresh `establishSession()` resets the gate without blocking subsequent refreshes.
  - **2. Coordinated `signOut()` & Isolated Refresh (`src/core/auth/AuthContext.tsx`, `src/features/auth/{api,hooks,index}.ts`)**:
    - `signOut()` calls `holdSignOutBlockingRefresh()`, safely awaits any already-in-flight refresh via `awaitActiveRefresh(4_000)`, verifies `getSessionEpoch() === preSignOutEpoch`, then acquires `logoutEpoch = beginSignOutGate()` and revokes either the `preRefreshed` tokens or `SecureStore` tokens (`logoutSession` -> fallback to `refreshAuthSession` + rotated tokens on expired/missing AT), clearing local `SecureStore`/cache in `finally` only when `getSessionEpoch() === logoutEpoch`.
    - Added pure-TS `isAccessTokenExpired` JWT `exp` check, `timeoutMs` option on `logoutSession`, `refreshAuthSession` helper, and `isMountedRef` unmount guard in `useSignOut`.
  - **3. Dev Sandbox Parity (`src/core/api/client.ts`, `src/core/dev/sandboxAdapter.ts`)**:
    - Forwarded `bearerToken` into `handleSandboxRequest` (`SandboxRequestOptions`) and updated sandbox `POST /auth/logout` to resolve `options?.bearerToken ?? tokenStorage.getAccessToken()`, validate access/refresh tokens, and revoke both consistently with `api/src/auth/auth.service.ts`.
- **Prior Completed Action (Bugfix Prompt 10 — Merchant Workspace Fixes, Scanner Safety & Final Audit)**:
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

- **Completed (Code — Phase 0 + Phase 1 + Phase 1.5 + Phase 2.0–2.5 + Phase 3.1 + Pre-Build Audit + Image Upload Phases 1–5)**:
  - Governance & tracking docs: `AGENTS.md`, `ROADMAP.md`, `HANDOVER.md`, `README.md`, `eas.json`, `.env.example`, `app.json` (with `expo-camera`, `expo-image-picker`, and `@react-native-community/datetimepicker` CNG plugins).
  - Assets: `assets/fonts/IBMPlexSansArabic-{Regular,SemiBold,Bold}.ttf` + verified Mardood logo, splash, and adaptive icon PNGs in `assets/images/`.
  - Core modules: `theme/`, `i18n/`, `rtl/` (Minor-Unit `BigInt` formatter & parser), `config/`, `auth/` (dual-role guards + SecureStore `activeRole`), `api/` (`idempotency.ts` + expanded `errors.ts` + dual-role refresh), `cache/` (`${userId}:${role}:...` namespace isolation), `navigation/` (`useAndroidBack`, `useOverlayBackRegistration`), `dev/` (offline-only sandbox gated by `__DEV__ && EXPO_PUBLIC_USE_DEV_SANDBOX === 'true'`).
  - UI primitives: `src/components/ui/` (`AppButton`, `AppInput`, `BalanceCard`, `BrandMark`, `BrandSplashOverlay`, `CampaignCard`, `StatusBadge` with `forceLtr`, `SkeletonBlock`, `CampaignCardSkeleton`, `index.ts`).
  - Features: `src/features/{auth,profile}/`, `src/features/customer/{offers,dashboard,purchases}/`, `src/features/marketer/{campaigns,wallet}/`, `src/features/merchant/{dashboard,wallet,campaigns,scanner}/`.
  - Routes & UI Primitives: `src/components/ui/QrCodeBox.tsx`, `src/app/_layout.tsx` (5 `Stack.Protected` guards + `r/[code]`), `src/app/index.tsx`, `src/app/r/[code].tsx`, `src/app/workspace-select.tsx`, `src/app/(auth)/{_layout,login,register}`, `src/app/customer/{_layout,(tabs)/{_layout,index,cashback,purchases,profile}}`, `src/app/marketer/{_layout,(tabs)/{_layout,index,wallet,profile},campaigns/[id]}`, `src/app/merchant/{_layout,(tabs)/{_layout,index,campaigns,scanner,wallet,profile},campaigns/{new,[id]}}`. (`src/app/(auth)/index.tsx`, `src/app/(marketer)/`, and `src/app/(merchant)/` removed).
- **Remaining (Phase 3.2.4 UI)**: None — all 4 Customer tabs (`Offers`, `Cashback`, `Purchases`, `Profile`) are complete.
- **Remaining (Phase 4 — Waiting on Backend)**:
  - Phase 4.1, 4.2 & 4.3 backlog endpoints (real Sham Cash transfers/receipts/confirm/dispute, `/public/leaderboard`, store discounts, `/customer/cashback-vouchers*`, participant approvals).

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
| `GET /marketer/wallet` | Ready | Complete (`Phase 1.4` + `3.1`) | `${userId}:marketer:wallet:summary`; separated available, pending payout, total earned & `totalConfirmedPaidOutSyp` |
| `GET /marketer/wallet/transactions`, `/by-merchant`, `GET /marketer/stats` | Ready (`marketer-reporting.controller.ts`) | Complete (`Phase 3.1`) | `${userId}:marketer:wallet:{stats,by-merchant,transactions}` with sub-tabs & pagination |
| `POST /marketer/payouts`, `GET /marketer/payouts` | Ready (`payout.controller.ts`) | Complete (`Simulated Payouts Phases 1–5`) | `expectedAmountSyp` confirmation modal (`409` balance-changed / already-pending recovery), SWR stale sync, paginated `'payouts'` sub-tab with status filters & rejection reason display |
| `GET /public/leaderboard` (and real Sham Cash transfer receipts/confirm/dispute) | Not in `api/src/` yet | Backlog (`Phase 4.2`) | Blocked on backend implementation |

### C. Merchant Workspace (`merchant/`)
| Endpoint | Backend (`api/src/`) | Mobile Status | Notes |
| --- | --- | --- | --- |
| `GET /merchant/dashboard` | Ready (`merchant-reporting.controller.ts`) | Complete (`Phase 2.1`) | `${userId}:merchant:dashboard` SWR cache, Minor Units, quick actions & verification banner |
| `GET /merchant/wallet`, `GET /merchant/wallet/transactions` | Ready (`merchant-reporting.controller.ts`) | Complete (`Phase 2.2`) | `${userId}:merchant:wallet:*` SWR cache, Minor Units, `Map` pagination dedupe & all 5 kinds |
| `GET /merchant/campaigns`, `GET /merchant/campaigns/:campaignId` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.3`) | Status tabs, progress bar, Minor-Unit reserves, pagination & stats |
| `POST /merchant/campaigns/:campaignId/close` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.3`) | Explicit confirm modal, `Set` dedupe & cross-cache release invalidation |
| `POST /merchant/campaigns/preview` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.4`) | Debounced `AbortController` live preview (`product` + `fixed` commission) |
| `POST /merchant/campaigns` | Ready (`merchant-campaign.controller.ts`) | Complete (`Phase 2.4`) | Verified merchant + payload-bound `Idempotency-Key` UUID v4 + cross-cache invalidation |
| `POST /merchant/uploads/image` | Ready (`media.controller.ts`) | Complete (`Image Upload Phases 1–5` + `File.size` & XHR `FormData` Fixes) | Gallery/Camera via `expo-image-picker`, iterative JPEG compression (`<= 490,000` bytes) via `expo-image-manipulator`, `expo-file-system` `File.size` + XHR fallback, native `XMLHttpRequest` multipart `'file'` upload (bypassing SDK 58 `expo/fetch`), Dev Sandbox parity & UI in `new.tsx` |
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

- **Current Verification (Campaign Image Multipart XHR & Error Classification Fix — Prompt 3 Gate)**:
  - `npx --yes expo-doctor`: Passed (**20/20 checks passed. No issues detected!**, exit `0`).
  - `npx tsc --noEmit`: Exited `2` with **0** errors in all modified files (`src/core/api/client.ts`, `src/features/merchant/campaigns/api.ts`); only the `3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`.
  - Targeted `npx eslint src/core/api/client.ts src/features/merchant/campaigns/api.ts`: Exited `0` with **0** errors (`0` issues in `api.ts`; `2` pre-existing `@typescript-eslint/no-require-imports` warnings remain at `client.ts:469,549` for conditional `__DEV__` sandbox loading).
  - Full `npx expo lint`: Exited `1` with **35 problems (20 errors, 15 warnings)** — identical to pre-existing baseline (`0` new findings introduced).
  - Ephemeral `npx --yes tsx` behavioral verification (`client.ts`, `campaigns/api.ts`, `sandboxAdapter.ts`): Passed (`ALL_UNIT_AND_SANDBOX_CHECKS_PASSED` — verified `FormData` -> `XMLHttpRequest` routing without manual `Content-Type`, MIME/filename normalization, `401` single-flight refresh + XHR retry with rotated token, `timeout`/`onerror` -> `NETWORK_ERROR`, `externalSignal.abort()` -> `AbortError`, non-network `TypeError('Unsupported ...')` preserved without `NETWORK_ERROR` masking, genuine `fetch failed:` -> `NETWORK_ERROR`, empty URI -> `400 VALIDATION_ERROR`, and Dev Sandbox `POST /merchant/uploads/image` + `415 UNSUPPORTED_IMAGE_FORMAT` rejection).
  - Cross-role isolation & backend boundary check: Passed (`0` cross-role imports across `src/features/`; `0` changes inside `api/`).
- **Prior Verification (Campaign Image Local File Byte-Size Fix)**:
  - `npx --yes expo-doctor`: Passed (**20/20 checks passed. No issues detected!**, exit `0`).
  - `npx tsc --noEmit`: Exited `2` with **0** errors in all modified files (`src/features/merchant/campaigns/{imageUpload,hooks,index}.ts`, `src/core/i18n/{types,ar,en}.ts`); only the `3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`.
  - Targeted `npx eslint` on `src/features/merchant/campaigns/{imageUpload,index}.ts` and `src/core/i18n/{types,ar,en}.ts`: Passed (**0** errors, **0** warnings); in `src/features/merchant/campaigns/hooks.ts`, **0** issues in modified `runCompressAndUpload` lines (`3` pre-existing findings remain on untouched lines `164`, `442`, `1038`).
  - Full `npx expo lint`: Exited `1` with **35 problems (20 errors, 15 warnings)** — identical to pre-existing baseline (`0` new findings introduced).
  - `ar.ts` vs `en.ts` dictionary parity & `imageUpload` unit checks (`node`): Passed (**502 === 502** keys, `MISSING_IN_EN=[]`, `MISSING_IN_AR=[]`; verified 3 KB `File.size`, `SIZE_LIMIT_EXCEEDED` temp cleanup, `492 KB` best-candidate retention, `PROCESSING_FAILED`, `FILE_READ_FAILED`, and `content://` XHR `status=0` fallback).
- **Prior Verification (Marketer Simulated Payouts Integration Phase 5 — Final Gate)**:
  - `npx --yes expo-doctor`: Passed (**20/20 checks passed. No issues detected!**, exit `0`).
  - `npx tsc --noEmit`: Exited `2` with **0** errors in all Phases 1–5 modified files (`src/core/api/errors.ts`, `src/core/i18n/{types,ar,en}.ts`, `src/features/marketer/wallet/{types,api,hooks,index}.ts`, `src/core/dev/sandboxAdapter.ts`, `src/app/marketer/(tabs)/wallet.tsx`); only the `3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`.
  - Targeted `eslint` on all 10 modified files (`src/core/api/errors.ts`, `src/core/i18n/{types,ar,en}.ts`, `src/features/marketer/wallet/{types,api,hooks,index}.ts`, `src/core/dev/sandboxAdapter.ts`, `src/app/marketer/(tabs)/wallet.tsx`): **0** errors and **0** warnings across 9 files and all newly added payout code in `hooks.ts` (`4` pre-existing findings remain in untouched `hooks.ts` lines `337`, `574`, `693`, `930`).
  - Full `npx expo lint`: Exited `1` with **35 problems (20 errors, 15 warnings)** — identical to pre-existing baseline (`0` new findings introduced across Phases 1–5).
  - `ar.ts` vs `en.ts` dictionary parity (Node/TypeScript evaluator): Passed (**501 === 501** keys, `MISSING_IN_EN=[]`, `MISSING_IN_AR=[]`).
  - Cleanup & isolation `grep` across `hackathon-mobile/src/`: Passed (`0` remaining `payout_transfer_reversal` occurrences; `0` cross-role imports between `customer/`, `marketer/`, and `merchant/`; `0` admin routes/imports; `0` `console.log` calls; `0` uncleaned timers).
- **Prior Verification (Image Upload Phase 5 — Final Gate)**:
  - `npx --yes expo-doctor`: Passed (**20/20 checks passed. No issues detected!**).
  - Targeted `npx eslint` on Phase 5 files (`src/features/merchant/campaigns/validation.ts`, `src/core/i18n/{types,ar,en}.ts`, `src/features/merchant/campaigns/{imageUpload,api}.ts`, `src/core/api/errors.ts`, `src/core/dev/sandboxAdapter.ts`): `0` errors and `0` warnings; in `src/app/merchant/campaigns/new.tsx`, `0` issues in all Phase 5 image UI lines (`1` pre-existing `react-hooks/set-state-in-effect` error on untouched `new.tsx:147`).
  - Full `npx expo lint`: Exited `1` (`35` total problems: `20` errors, `15` warnings — identical to pre-existing baseline, `0` new findings introduced across Phases 1–5).
  - `npx tsc --noEmit`: Exited `2` with `0` errors in all Phase 1–5 modified files (`3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`).
  - `ar.ts` vs `en.ts` dictionary parity (`tsx`) & cleanup `grep`: Passed (`473 === 473` keys, `0` missing, `0` leftover `imageUrl*`/`campaign-image-url-input` references, `0` cross-role imports).
- **Prior Verification (Image Upload Phase 4)**:
  - `npx eslint src/features/merchant/campaigns/{validation,hooks,index,types}.ts`: `0` errors/warnings across `validation.ts`, `index.ts`, `types.ts`, and all newly added Phase 4 image-upload logic in `hooks.ts` (`3` pre-existing lint findings remain in untouched `hooks.ts` lines `164`, `442`, `1035`).
  - `npx tsc --noEmit`: `0` errors across `validation.ts`, `hooks.ts`, `index.ts`, `types.ts`, and `new.tsx`; `3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`.
- **Prior Verification (Image Upload Phase 3)**:
  - `npx eslint src/features/merchant/campaigns/{imageUpload,api,index}.ts src/core/dev/sandboxAdapter.ts`: Passed (`0` errors, `0` warnings).
  - `npx tsc --noEmit`: `0` errors across all Phase 3 files (`imageUpload.ts`, `api.ts`, `index.ts`, `sandboxAdapter.ts`); `3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`.
- **Prior Verification (Image Upload Phase 2)**:
  - `npx eslint src/core/api/{client,errors,types}.ts src/core/i18n/{types,ar,en}.ts`: Passed (`0` errors; `2` pre-existing `require('../dev')` tree-shaking warnings in `client.ts`).
  - `ar.ts` vs `en.ts` dictionary parity (`tsx`): Passed (`478 === 478` keys, `0` missing in either locale).
  - `npx tsc --noEmit`: `0` errors across all Phase 2 files (`src/core/api/*`, `src/core/i18n/*`); `3` pre-existing errors remain in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582`.
- **Prior Verification (Image Upload Phase 1 — Live `node_modules/` Installed)**:
  - `npx expo-doctor`: Passed (**20/20 checks passed. No issues detected!**).
  - `npx tsc --noEmit`: Zero errors on Phase 1 config/package additions; surfaced **3 pre-existing** TypeScript errors in untouched files (`src/app/merchant/(tabs)/scanner.tsx:79,136` for `AppState.currentState` nullable typing, and `src/app/merchant/campaigns/[id].tsx:582` for `Modal` `onRequestClose` returning `boolean`).
  - `npx expo lint`: Zero issues on Phase 1 changes; surfaced **pre-existing** ESLint findings (`35` problems: `20` errors, `15` warnings, primarily `react-hooks/set-state-in-effect` and `react-hooks/exhaustive-deps` from earlier `node_modules`-less turns).
- **Prior Verification (Post Bugfix Prompt 10 — Final Codebase Audit)**:
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

- **Live Android Development Build & E2E Media Verification**:
  - Build and install the Expo Dev Client (`eas build --profile development --platform android`) against the live backend (`EXPO_PUBLIC_USE_DEV_SANDBOX=false`), verify gallery picking, live camera capture, client compression (`< 500 KB`), `POST /merchant/uploads/image`, and end-to-end campaign creation on device.
  - Optional codebase maintenance pass: resolve the `3` pre-existing TypeScript errors in untouched `src/app/merchant/(tabs)/scanner.tsx:79,136` and `src/app/merchant/campaigns/[id].tsx:582` and the baseline `react-hooks/set-state-in-effect` lint findings.
