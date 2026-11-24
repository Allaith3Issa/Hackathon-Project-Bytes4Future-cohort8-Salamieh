# خطة ومتتبع إصلاح الأعطال والتحسينات (`BUGFIX_TRACKER.md`) — تطبيق الموبايل (`hackathon-mobile/`)

> **القواعد الحاكمة لهذه المرحلة:**
> 1. **الحفاظ الكامل على تدفّق التطبيق ومنطق العمل (Zero Flow/Business Regression):** لا نُغيّر مسارات التنقل الأساسية أو عقود `API_CONTRACT.md` أو تجربة المستخدم الحالية، ولا نُضيف طبقات تجريد ثقيلة تسبب بطئاً أو أخطاء جانبية.
> 2. **الالتزام الصارم بـ `AGENTS.md` و`design.md`:** عزل تام بين `features/customer/` و`features/marketer/` و`features/merchant/`، صفر حسابات مالية في الواجهة، توافق لغوي كامل (`ar.ts` === `en.ts`)، التزام تام بـ RTL/LTR المنطقي وأهداف اللمس `48×48 dp`.
> 3. **طريقة التتبع:** عند إتمام كل برومبت والتحقق منه، تُبدَّل `[ ]` إلى `[x]` أمام كل مشكلة محلولة في هذا الملف، مع تحديث `HANDOVER.md` عند كل خطوة.

---

## ملخص مراحل التنفيذ والبرومبتات المقسمة

| البرومبت | النطاق | المشاكل المشمولة | الحالة |
| --- | --- | --- | --- |
| **Prompt 1** | التهيئة والأمان وبيئة التشغيل والاعتماديات | `A1`, `A2`, `A3`, `A5` | [x] مكتمل |
| **Prompt 2** | إصلاح عقود `Dev Sandbox` ليتطابق مع `api/src/` | `A4` | [x] مكتمل |
| **Prompt 3** | فصل الأنواع المشتركة وحل تعارض عزل الأدوار + مصفوفة `Idempotency` و`Client`/`Auth` | `B1`, `B2`, `B4`, `B5`, `B6`, `H1` | [x] مكتمل |
| **Prompt 4** | ترقية `swrCache` و`useSWRResource` (منع السباقات والـ Skeleton اللانهائي) | `B3` | [x] مكتمل |
| **Prompt 5** | أندرويد Back، `overlayStack`، التوجيه المبدئي، والروابط العميقة `r/[code]` | `C1`, `C2`, `E1`, `E2` | [x] مكتمل |
| **Prompt 6** | التنسيق (الأرقام والتواريخ وفواصل الآلاف)، اللغة/RTL، الثيم، والقاموس | `C3`, `C4`, `C5`, `C6`, `C7`, `C8` | [x] مكتمل |
| **Prompt 7** | مكوّنات الواجهة الأساسية `src/components/ui/` ونماذج المصادقة | `D1`, `D2`, `D3`, `D4`, `D5`, `D6`, `E3` | [x] مكتمل |
| **Prompt 8** | إصلاحات مساحة **الزبون (`customer/`)** | `F1`, `F2`, `F3`, `F4`, `F5`, `F6`, `F7` | [x] مكتمل |
| **Prompt 9** | إصلاحات مساحة **المسوّق (`marketer/`)** | `G1`, `G2`, `G3`, `G4`, `G5`, `G6` | [x] مكتمل |
| **Prompt 10** | إصلاحات مساحة **التاجر (`merchant/` والماسح والإنشاء)** + فحص شامل أخير | `H2`, `H3`, `H4`, `H5`, `H6`, `H7` | [x] مكتمل |

---

## القسم (A): التهيئة والأمان، الـ Dev Sandbox، والاعتماديات

- [x] **A1 — استبعاد ملفات `.env` في `.gitignore`** *(عالية - أمان)*
  - **المسار:** `hackathon-mobile/.gitignore:33-35`
  - **المشكلة:** يتجاهل `.env*.local` فقط ولا يتجاهل `.env` أو `.env.production` رغم أن `README.md` ينص على نسخ `.env.example` إلى `.env`.
  - **الحل المعتمد:** إضافة `.env` و`.env.*` مع استثناء `!.env.example` داخل `.gitignore`.

- [x] **A2 — تقييد `http://` في الإنتاج وكشف غياب `EXPO_PUBLIC_API_URL` بوضوح** *(متوسطة - أمان وتهيئة)*
  - **المسار:** `src/core/config/env.ts:7-22, 28-52`، `src/core/api/client.ts:56-58`
  - **المشكلة:** `normalizeHttpUrl` تقبل `http:` خارج `__DEV__`، وعند غياب `EXPO_PUBLIC_API_URL` يصبح الرابط النسبي `/api/v1/...` ويرمي خطأ شبكة مضلل `NETWORK_ERROR`.
  - **الحل المعتمد:** السماح بـ `http:` فقط عند `__DEV__` (ورفضه خارج التطوير لصالح `https:` فقط)، وإبقاء رسالة خطأ تهيئة واضحة ومترجمة/مميزة عند غياب `apiBaseUrl` مع `useDevSandbox === false` بدلاً من خطأ شبكة غامض.

- [x] **A3 — منع تضمين كود `sandboxAdapter.ts` (68.6 KB) وبيانات الديمو في حزمة الإنتاج** *(متوسطة - أمان وحجم الحزمة)*
  - **المسار:** `src/core/api/client.ts:6, 122, 169`، `src/core/config/env.ts:36-43`، `src/features/auth/hooks.ts:22-27`
  - **المشكلة:** الاستيراد الثابت `import { handleSandboxRequest } from '../dev'` واختبار `if (env.useDevSandbox)` يمنع Metro من حذف كود الـ Sandbox وثوابت الحسابات التجريبية من حزمة الإنتاج.
  - **الحل المعتمد:** حراسة الاستدعاء بـ `if (__DEV__ && env.useDevSandbox)` واستخدام `require('../dev')` الشرطي داخل الفرع فقط، وتغليف ثوابت الديمو في `auth/hooks.ts` تحت `__DEV__` (أو إرجاعها لـ `core/dev/`) ليحذفها Metro كلياً في الإنتاج.

- [x] **A4 — إصلاح تناقضات `sandboxAdapter.ts` مع عقود `api/src/`** *(متوسطة - جودة الاختبار المحلي)*
  - **المسار:** `src/core/dev/sandboxAdapter.ts:401, 503-527, 812, 930-937, 1020-1105, 1673, 1772, 1835-1839, 2046, 2063-2070`
  - **المشاكل:**
    1. توليد `qrToken` بصيغة `mardood-qr:...` تحوي `:` فيرفضها `SCANNER_CODE_REGEX`، مع فهرسة `passCode` فقط دون `qrToken`.
    2. `POST /auth/login` يقبل أي كلمة مرور ويرجع حساباً افتراضياً للأرقام المجهولة بدل `401 INVALID_CREDENTIALS`، و`GET /auth/me` لا يرمي `401 AUTH_REQUIRED` عند غياب التوكن.
    3. `membershipsByCampaignId` غير معزول بـ `account.id`، و`GET /campaigns` يتجاهل `?q=` و`?page=` وانتهاء الصلاحية.
    4. تسوية الماسح لا تفتح الكاش باك المقفل عند بلوغ 5 مشتريات و500.00 ل.س (`50000`).
  - **الحل المعتمد:** توليد `qrToken` بأحرف `[A-Za-z0-9_-]` وفهرسته مع `passCode` في `sandboxOfferPasses`، فهرسة العضويات بـ `${account.id}:${campaignId}`، التحقق الصارم من كلمة المرور والتوكن وإرجاع `401`، دعم `q`/`page`/expiry في `/campaigns`، وتطبيق قاعدة فتح هدف الكاش باك من `api/src/scanner/cashback-milestone.ts`.

- [x] **A5 — تنظيف الاعتماديات غير المستخدمة في `package.json` ومراجعة `app.json`** *(منخفضة - نظافة المشروع)*
  - **المسار:** `hackathon-mobile/package.json:13, 15, 24, 25`، `hackathon-mobile/app.json:23-26`
  - **المشكلة:** وجود 4 حزم مباشرة غير مستخدمة (`expo-device`, `expo-glass-effect`, `expo-system-ui`, `expo-web-browser`)، وإعداد `"web": { "output": "server" }` غير ملائم لتطبيق Android-only.
  - **الحل المعتمد:** التحقق من خلو كامل المشروع وإعدادات Expo من أي مرجع لها ثم إزالة الحزم الأربع غير المستخدمة وضبط قسم `web` في `app.json` (`"output": "single"`). *(ملاحظة: أزيلت الحزم الأربع من `package.json`؛ يلزم تحديث `package-lock.json` عند تشغيل `npm install` محلياً).*

---

## القسم (B): النواة — API Client، المصادقة، الجلسة، الكاش، والـ Idempotency

- [x] **B1 — حل سباق `runSingleFlightRefresh()` مع `signOut()`/`establishSession()` ومسار `/auth/logout`** *(حرجة - أمان وتزامن)*
  - **المسار:** `src/core/api/client.ts:108-160, 188-203`، `src/core/auth/AuthContext.tsx:139-199`، `src/features/auth/api.ts:64`
  - **المشكلة:** غياب `sessionEpoch` يجعل تجديد توكن بطيء لحساب سابق يكتب فوق توكنات حساب جديد أو يمسح جلسته؛ و`signOut()` تنتظر `/auth/logout` حتى 15 ثانية قبل مسح الواجهة والكاش، وإذا كان `accessToken` منتهياً ترسل `/auth/logout` بالـ `refreshToken` القديم بعد دورانه فتفشل بـ `401`.
  - **الحل المعتمد:** إضافة `sessionEpoch` يزداد عند `establishSession` و`signOut` و`clearAuthAndCache` لإهمال أي نتيجة تجديد قديمة؛ إضافة `skipRefreshOn401?: boolean` في `ApiRequestOptions`؛ واستدعاء `logoutSession(refreshToken)` مع `skipRefreshOn401: true` (ما يحيي الدالة الميتة في `auth/api.ts:64`) مع مسح الحالة والكاش المحلي فوراً أثناء `signOut`.

- [x] **B2 — منع مسح `SecureStore` وإخراج المستخدم عند انقطاع الشبكة أو `5xx`** *(عالية - موثوقية الجلسة)*
  - **المسار:** `src/core/auth/AuthContext.tsx:94-129`، `src/core/api/client.ts:151-154`
  - **المشكلة:** `hydrateSession()` و`runSingleFlightRefresh()` تمسكان أي خطأ (بما فيه `NETWORK_ERROR` أو `5xx`) وتمسحان التوكنات وتطردان المستخدم.
  - **الحل المعتمد:** حصر `clearAuthAndCache()` و`wipeLocalSession(true)` بردود السيرفر القاطعة (`401`/`403` أو `REFRESH_TOKEN_INVALID` أو غياب دور مدعوم). عند خطأ الشبكة أثناء `hydrateSession` مع وجود توكنات، الإبقاء على التوكنات وتوفير `retryHydration()` لطيفة في شاشة التحميل/الجذر دون حذف الجلسة؛ وعند خطأ الشبكة أثناء `runSingleFlightRefresh` تمرير `NETWORK_ERROR` دون مسح التوكنات.

- [x] **B3 — منع سباقات الكتابة القديمة (`Stale-Write`) والـ Skeleton اللانهائي في `swrCache` و`useSWRResource`** *(عالية - دقة الكاش والأداء)*
  - **المسار:** `src/core/cache/swrCache.ts:30-36, 71-100, 122-150`، `src/core/cache/useSWRResource.ts:52-129`
  - **المشكلة:**
    1. استجابات `revalidate()` القديمة تكتب فوق `clear()` أو `invalidate*()`، وحذف `inFlight` لا يتحقق من مرجع الوعد.
    2. `applyOptimistic` يرجع لبيانات قديمة دون فحص وجود تحديث أحدث، و`refresh()` تضبط `isRefreshing` حتى بعد تغير المفتاح أو الـ unmount.
    3. حذف الكاش عبر `invalidate()` يجعل `data === null` وتُقفل التبويبات على Skeleton عندما تفحص `useFocusEffect` شرط `!== null`.
    4. تصدير ميت `buildUserCacheKey` في `swrCache.ts:30`.
  - **الحل المعتمد:** إضافة `cacheEpoch` + `keyVersions` في `swrCache.ts` + فحص `this.inFlight.get(key) === fetchPromise`؛ إضافة `markStale(key)` و`markStalePrefix(prefix)` التي تبقي آخر بيانات صالحة مرئية وتُصفّر `updatedAt = 0` لتحديثها بصمت؛ حماية `applyOptimistic` و`refresh()` في `useSWRResource`؛ وحذف `buildUserCacheKey`.

- [x] **B4 — تجنّب السقوط إلى `Math.random()` عند توليد `Idempotency-Key` على أندرويد** *(متوسطة - أمان)*
  - **المسار:** `src/core/api/idempotency.ts:18-35`
  - **المشكلة:** Hermes لا يعرّف `globalThis.crypto` افتراضياً ولا يوجد `expo-crypto`، فيسقط التنفيذ دائماً إلى `Math.random()`.
  - **الحل المعتمد (الأخف دون إضافة حزمة Native ثقيلة):** فحص `globalThis.expo?.uuidv4?.()` الموفَّر أصلياً من `expo-modules-core` كخيار أول مع `crypto.randomUUID` و`crypto.getRandomValues` قبل السقوط الاحتياطي، لضمان UUID آمن تشفيرياً فوراً دون كسر التوافق مع الـ Dev Client الحالي.

- [x] **B5 — حماية `switchWorkspaceRole` من الاستدعاءات المتزامنة وتطبيق المسح الكامل للكاش** *(متوسطة - عزل الأدوار)*
  - **المسار:** `src/core/auth/AuthContext.tsx:161-180`
  - **المشكلة:** يستدعي `invalidateUserRole` فقط بدل `swrCache.clear()` (خلافاً لـ `AGENTS.md:149`) ولا يحمي من تداخل نقرتين سريعتين أو مع `signOut` أثناء `await tokenStorage.saveActiveRole`.
  - **الحل المعتمد:** استدعاء `swrCache.clear()` وزيادة `sessionEpoch` + قفل/فحص جيل الطلب والجلسة بعد `await`.

- [x] **B6 — مزامنة `AuthContext.user` مع تحديثات الحساب وتفعيل `useAccountRefresh`** *(عالية - اتساق الجلسة)*
  - **المسار:** `src/core/auth/AuthContext.tsx`، `src/features/profile/hooks.ts:23-61`، `src/features/auth/hooks.ts:417-440`، `src/app/merchant/campaigns/new.tsx:103`، `src/app/merchant/(tabs)/scanner.tsx:96-98`
  - **المشكلة:** شاشات التاجر الحساسة (`new.tsx` و`scanner.tsx`) تقرأ `user.merchant.verificationStatus` القديم من `AuthContext` رغم تحديث البروفايل ولوحة التحكم، كما أن `useAccountRefresh` مصدّر غير مستخدم.
  - **الحل المعتمد:** إضافة `syncAccount(account)` في `AuthContext` (مع التحقق من تطابق `user.id` وبقاء الأدوار المدعومة)، استدعاؤها عند جلب `/auth/me` في `useProfileAccount` (ومزامنة `verificationStatus` عبر `useMerchantDashboard` أو `useAccountRefresh` عند استئناف التطبيق/فتح الشاشات الحساسة)، وتنظيف/ربط `useAccountRefresh`.

---

## القسم (C): التنقل (Android Back)، الـ RTL/LTR، تنسيق الأرقام والتواريخ، الثيم، والقاموس

- [x] **C1 — إصلاح الخروج بالضغط المرتين من أي تبويب جذري في أندرويد** *(عالية - تجربة أندرويد)*
  - **المسار:** `src/core/navigation/useAndroidBack.ts:33, 63-71`
  - **المشكلة:** إرجاع `false` عند الضغطة الثانية خلال ثانيتين يمرّر الحدث لـ `<Tabs>` فينتقل للتبويب الأول بدل الخروج، و`lastBackPressAtRef` محلي لكل تبويب.
  - **الحل المعتمد:** استدعاء `BackHandler.exitApp()` وإرجاع `true` عند الضغطة الثانية مع مرجع توقيت مشترك على مستوى الوحدة.

- [x] **C2 — ترتيب `isBusy` في `useAndroidBack` وأمان `overlayStack.dismissTop()` وإزالة كود iOS الميت** *(متوسطة - التنقل والنوافذ)*
  - **المسار:** `src/core/navigation/useAndroidBack.ts:45-56`، `src/core/navigation/overlayStack.ts:26-34`، `src/app/merchant/campaigns/[id].tsx:78-89`، `src/app/merchant/campaigns/new.tsx:119-123`
  - **المشكلة:** `overlayStack.dismissTop()` تحذف العنصر قبل فحص قبول الإغلاق وتُستدعى قبل `if (isBusy) return true;`، ما يخرج النافذة من المكدس أثناء `isClosing`؛ كما يوجد تسجيل iOS ميت في `new.tsx`.
  - **الحل المعتمد:** تقديم `if (isBusy) return true;` على `overlayStack.dismissTop()` في `useAndroidBack`، وإبقاء العنصر في `overlayStack` حتى يُغلق فعلياً (أو إرجاع `boolean` من `onDismiss` وعدم عمل `pop` إن رُفض)، وإزالة `useOverlayBackRegistration` الخاص بـ iOS من `new.tsx`.

- [x] **C3 — تنسيق إقلاع اللغة وتفادي تضارب الاتجاه المزدوج (`LocaleContext` و`I18nManager`)** *(متوسطة - RTL/LTR)*
  - **المسار:** `src/core/i18n/LocaleContext.tsx:33-72`، `src/core/rtl/direction.ts:17-25`، `src/app/_layout.tsx:113-116, 131`
  - **المشكلة:** إظهار الشجرة بـ `DEFAULT_LOCALE = 'ar'` قبل انتهاء قراءة `SecureStore` قد يسبّب قلباً بصرياً مبدئياً عند اختيار `'en'`، واستدعاء `I18nManager.forceRTL` الحي بدون توافق مع اتجاه الجلسة يترك المكونات الأصلية مختلفة الاتجاه.
  - **الحل المعتمد (يحافظ على الفلو السريع بدون إعادة تشغيل قسرية):** إبقاء `BrandSplashOverlay` يغطي الشاشة حتى `isLocaleReady` (موجود فعلاً في `_layout.tsx:52`)، مع تهيئة `<Stack>` والمحتوى الأساسي أو تطبيق `I18nManager` بشكل نظيف عند التهيئة دون تسبب بأي وميض أو إعادة تشغيل مفاجئة تفقد حالة المستخدم عند التبديل الحي في الإعدادات (مع ضبط اتجاه `Stack` عبر `isRtl` كما هو مطبّق في `merchant/_layout.tsx` وتعميمه).

- [x] **C4 — دعم فاصلة الآلاف الإنجليزية `,` عند إدخال ولصق المبالغ في `parseNewSypToMinorUnits`** *(متوسطة - الإدخال المالي)*
  - **المسار:** `src/core/rtl/format.ts:10-12, 58-74`
  - **المشكلة:** `formatSyp` تنتج فواصل آلاف `,` بينما `parseNewSypToMinorUnits` ترفض `"1,500"`.
  - **الحل المعتمد:** قبول نمط تجميع الآلاف اللاتيني الصحيح (`\d{1,3}(,\d{3})+` مع أو بدون كسر عشري `.xx`) وحذف فواصل الآلاف الصحيحة بأمان مع رفض الصيغ العشرية المبهمة.

- [x] **C5 — توحيد نظام الأرقام في `format.ts` وإضافة `try/catch` لـ `formatPercent`** *(متوسطة - اتساق التصميم)*
  - **المسار:** `src/core/rtl/format.ts:31-47, 101-132`
  - **المشكلة:** `formatSyp` تستخدم أرقاماً لاتينية بينما `formatPercent` و`formatCampaignDate` تحت `'ar-SY'` تنتجان أرقاماً مشرقية، كما يفتقر `formatPercent` لـ `try/catch`.
  - **الحل المعتمد:** تمرير `numberingSystem: 'latn'` (أو locale `'ar-SY-u-nu-latn'` مع fallback آمن داخل `try/catch`) في `formatPercent` و`formatCampaignDate` لتتطابق جميع أرقام البطاقة الواحدة مع `formatSyp`.

- [x] **C6 — منع إزاحة اليوم لتواريخ انتهاء الحملة بين UTC وتوقيت سوريا (`UTC+3`)** *(متوسطة - دقة التواريخ)*
  - **المسار:** `src/core/rtl/format.ts:117-132`، `src/features/merchant/campaigns/validation.ts:116-118`، `src/app/merchant/campaigns/new.tsx:105`
  - **المشكلة:** `formatCampaignDate` تستخدم المنطقة المحلية بلا `timeZone`، فيتحول `"2026-11-30T23:59:59.000Z"` إلى `1 كانون الأول` في دمشق، و`buildEndOfDayIso` يحول نهاية اليوم المحلي إلى UTC قد يرحّل اليوم في مناطق زمنية سالبة.
  - **الحل المعتمد:** تنسيق `formatCampaignDate` باستخدام `timeZone: 'UTC'` (لتطابق التواريخ اليومية الصرفة `YYYY-MM-DDT23:59:59.000Z` التي ينشئها `buildEndOfDayIso` كـ UTC end-of-day) أو توحيد `buildEndOfDayIso` لاستخدام تاريخ اليوم المختار (`YYYY-MM-DD`) مباشرة بنهاية اليوم UTC `T23:59:59.000Z` عند استلامه من منتقي التاريخ، ما يلغي أي انحراف بين اختيار التاريخ وعرضه عبر جميع المناطق الزمنية.

- [x] **C7 — إكمال ثوابت الثيم المفقودة وتنظيف `LayoutStyles`** *(منخفضة-متوسطة - نظام التصميم)*
  - **المسار:** `src/core/theme/colors.ts`، `src/core/theme/typography.ts:66-71`، `src/core/theme/tokens.ts:32-59`
  - **المشكلة:** غياب `warning` (`#78451A`) و`warningBg` (`#FFF2DF`)، غياب `fontVariant: ['tabular-nums']` في `Typography.balance` (ونمط رقمي مساعد)، وبقاء `LayoutStyles` الميت.
  - **الحل المعتمد:** إضافة `warning` و`warningBg` إلى `Colors`، وتضمين `fontVariant: ['tabular-nums']` في `Typography.balance` وإضافة `tabularNumber`، وحذف `LayoutStyles` غير المستخدم.

- [x] **C8 — تنظيف مفاتيح القاموس الميتة وإضافة مفاتيح المكوّنات الناقصة مع تطابق `ar`/`en`** *(منخفضة - نظافة i18n)*
  - **المسار:** `src/core/i18n/{types,ar,en}.ts`
  - **المشكلة:** مفاتيح قديمة غير مستخدمة (`merchant.placeholders.*`, `merchant.placeholderSubtitle`, `common.initializing`, `auth.notMarketerError`, `auth.sessionActiveTitle`, `auth.sessionActiveSubtitle`, إلخ) مقابل نصوص مدمجة في `QrCodeBox` أو رسائل جديدة مطلوبة.
  - **الحل المعتمد:** حذف المفاتيح الميتة غير المستخدمة، وإضافة مفاتيح `QrCodeBox` ورسائل التحقق/الأخطاء الجديدة بالتطابق التام `100%` بين `ar.ts` و`en.ts`.

---

## القسم (D): مكوّنات الواجهة الأساسية (`src/components/ui/`) ونماذج المصادقة

- [x] **D1 — إصلاح إمكانية الوصول (`Accessibility`) في `BalanceCard`** *(عالية)*
  - **المسار:** `src/components/ui/BalanceCard.tsx:51-56, 78-95, 110`
  - **المشكلة:** `accessible` على الجذر يبتلع عناصر `action` التفاعلية ويقرأ رصيد `0.00` أثناء `loading={true}`.
  - **الحل المعتمد:** تطبيق `accessible` على حاوية الملخص العلوي فقط (أو حصره عند غياب `action`)، وعدم قراءة `formattedAmount` عند `loading={true}`.

- [x] **D2 — إصلاح تسرب مؤقت النسخ وعدم تصفير `hasCopied` في `QrCodeBox`** *(متوسطة)*
  - **المسار:** `src/components/ui/QrCodeBox.tsx:56-58, 88-94, 102-126`
  - **المشكلة:** جدولة `setTimeout` بعد `await Clipboard.setStringAsync` قد تتم بعد الـ unmount، وتغيّر `passCode` لا يصفّر `hasCopied`.
  - **الحل المعتمد:** إضافة `isMountedRef` لإلغاء المتابعة بعد التفكيك وتصفير `hasCopied` وإلغاء المؤقت في `useEffect` عند تغيّر `normalizedPassCode`.

- [x] **D3 — منع تجاوز العرض على `320dp` ونقل النصوص المدمجة في `QrCodeBox`** *(منخفضة-متوسطة)*
  - **المسار:** `src/components/ui/QrCodeBox.tsx:44, 66-86, 128, 166-172`
  - **المشكلة:** أبعاد `224dp` داخل حشوات `48dp+16dp` تلامس أو تتجاوز عرض `320dp`؛ والنصوص الافتراضية مكتوبة يدوياً داخل المكوّن.
  - **الحل المعتمد:** ضبط العرض بـ `useWindowDimensions` / `maxWidth: '100%'` مع تقييد الحجم النسبي للشاشات الضيقة وقراءة النصوص الافتراضية من `useLocale()`.

- [x] **D4 — إصلاح التفاف `metricsPanel` و`metaHeader` وخصم `0%` في `CampaignCard`** *(متوسطة)*
  - **المسار:** `src/components/ui/CampaignCard.tsx:197-204, 293-327`
  - **المشكلة:** التباس `metricDivider` عند الالتفاف، ضغط `shopName` الطويل بسبب `flex: 1` مع `flexWrap`، وعرض السعر الأصلي مشطوباً عند تساويه مع النهائي.
  - **الحل المعتمد:** جعل `metricDivider` متجاوباً أو استبدال الحدود المرنة، استخدام `flexGrow: 1, flexShrink: 1` لـ `shopName`، وإخفاء `originalPrice` إذا `originalPriceSyp <= finalPriceSyp`.

- [x] **D5 — تطبيق `fontVariant: ['tabular-nums']` في `BalanceCard` و`CampaignCard`** *(منخفضة)*
  - **المسار:** `src/components/ui/BalanceCard.tsx:86-94`، `src/components/ui/CampaignCard.tsx:334-349`
  - **الحل المعتمد:** تطبيق `fontVariant: ['tabular-nums']` على قيم المبالغ والنسب.

- [x] **D6 — تحسين إمكانية الوصول والحد الأدنى `48dp` في `AppInput` وإضافة نغمة `warning` لـ `StatusBadge`** *(منخفضة)*
  - **المسار:** `src/components/ui/AppInput.tsx:64-71, 104-135, 169-175`، `src/components/ui/StatusBadge.tsx:8, 19-53`
  - **الحل المعتمد:** تمرير `accessibilityState={{ disabled: !editable }}` و`accessibilityHint` في `AppInput`، ضبط `endAccessory` على `48dp`، وإضافة `'warning'` في `StatusBadge`.

---

## القسم (E): جذر التنقل، الروابط العميقة، والمصادقة

- [x] **E1 — حماية الروابط العميقة أثناء `status === 'hydrating'` في `_layout.tsx`** *(متوسطة-عالية)*
  - **المسار:** `src/app/_layout.tsx:52-64, 126-154`، `src/app/index.tsx`
  - **المشكلة:** `<Stack.Protected>` يقيّم `isAuthenticated === false` أثناء `hydrating` ويطرد أي مسار عميق إلى `/(auth)/login` قبل استعادة الجلسة.
  - **الحل المعتمد:** عدم تفعيل طرد `<Stack.Protected>` قبل خروج `status` من `'hydrating'` (الانتظار مع `BrandSplashOverlay` وبوابة `index.tsx` دون كسر عزل المساحات بمجرد انتهاء `hydrating`).

- [x] **E2 — دعم مسار `/r/[code]` والروابط العميقة عبر تسجيل الدخول وتعدد الأدوار** *(عالية)*
  - **المسار:** إنشاء `src/app/r/[code].tsx` + ربطه بـ `src/core/navigation/` أو `AuthContext`، `src/app/index.tsx`
  - **المشكلة:** لا يوجد مسار `r/[code].tsx` والروابط تضيع إذا وصلت قبل تسجيل الدخول أو أثناء تفعيل دور المسوّق/التاجر.
  - **الحل المعتمد:** إضافة مسار `r/[code].tsx` خفيف + حفظ `pendingReferralCode` مؤقتاً بالذاكرة (في `AuthContext` أو مخزن ملاحي بسيط)؛ عند امتلاك الحساب دور `customer` يتم توجيهه/تبديله نظيفاً إلى `/customer?code=...` بعد تسجيل الدخول أو اختيار الدور.

- [x] **E3 — تنظيف هوكس المصادقة وانتقال التركيز في `register.tsx`** *(منخفضة-متوسطة)*
  - **المسار:** `src/features/auth/hooks.ts:122-141, 246-265, 417-440`، `src/app/(auth)/register.tsx:209-211`
  - **المشاكل:** تحديث الحالة داخل `setRolesState` في `toggleRole`؛ فحص `inFlightOpsRef` المتأخر في `submit`؛ وجود `useAccountRefresh` ككود ميت؛ عدم نقل التركيز من حقل كلمة المرور إلى اسم المتجر عند الضغط على Next.
  - **الحل المعتمد:** نقل `setFieldErrors`/`setFormError` خارج مُحدِّث `setRolesState`، تقديم فحص `inFlightOpsRef` لمطلع `submit`، تفعيل/دمج `useAccountRefresh` أو حذفه، وإضافة `onSubmitEditing` لـ `shopNameRef` عند تفعيل دور التاجر.

---

## القسم (F): مساحة الزبون (`src/features/customer/` و`src/app/customer/`)

- [x] **F1 — معالجة الروابط العميقة المتتالية ودعم `?code=` داخل `extractReferralCode`** *(عالية)*
  - **المسار:** `src/app/customer/(tabs)/index.tsx:121-147`، `src/features/customer/offers/types.ts:84-143`
  - **الحل المعتمد:** دعم `searchParams.get('code')` في `extractReferralCode`، وفصل مراقبة `rawRouteCode` عن `incomingUrl` ليُطبّق الأحدث تغييراً فعلياً، وتصفير المرجع عند تغيير الحساب أو الضغط على «عرض آخر».

- [x] **F2 — تعريب وسم `attributionLabel` في بطاقة عرض الزبون** *(متوسطة)*
  - **المسار:** `src/app/customer/(tabs)/index.tsx:410-412`
  - **المشكلة:** عرض النص الإنجليزي الحرفي من السيرفر (`Merchant direct` / `Marketer referral`) وسط الواجهة العربية.
  - **الحل المعتمد:** ربط القيمة دلالياً بمفاتيح `t.customer.offers.attributionMerchant` و`t.customer.offers.attributionMarketer` مع الإبقاء على النص الأصلي كـ fallback عند أي قيمة مستقبلية.

- [x] **F3 — إصلاح الازدواج وفقدان الصفحات وتجربة خطأ `loadMore` في `useCustomerPurchases` و`purchases.tsx`** *(متوسطة)*
  - **المسار:** `src/features/customer/purchases/hooks.ts:105-163, 236-299`، `src/app/customer/(tabs)/purchases.tsx:176-189, 254-267`
  - **الحل المعتمد:** تسجيل الصفحة 1 في `inFlightPagesRef` داخل `useEffect` لمنع الطلب المزدوج مع `useFocusEffect`، عدم مسح الصفحات المحمّلة (`page >= 2`) في التحديث التلقائي الصامت (الاكتفاء بالتصفير في التحديث اليدوي الصريح أو دمج أول صفحة بـ `mergeCustomerPurchasesBySaleId`)، وعرض خطأ `loadMore` في `ListFooterComponent` مع زر يعيد استدعاء `loadMore()`.

- [x] **F4 — عرض خطأ تحميل الحساب وزر إعادة المحاولة في `customer/(tabs)/profile.tsx`** *(متوسطة)*
  - **المسار:** `src/app/customer/(tabs)/profile.tsx:45-56, 132-238`
  - **الحل المعتمد:** استخراج `errorMessage` من `useProfileAccount()` و`useCustomerDashboard()` وعرض شريط خطأ + زر إعادة المحاولة.

- [x] **F5 — إسقاط بطاقة العرض و`OfferQrPass` المتقادمة عند `NOT_FOUND` / `CAMPAIGN_ENDED` أثناء التحديث** *(متوسطة)*
  - **المسار:** `src/features/customer/offers/hooks.ts:212-231`، `src/app/customer/(tabs)/index.tsx:368-596`
  - **الحل المعتمد:** عند فشل `refreshOffer` بـ `NOT_FOUND` أو `CAMPAIGN_ENDED`، مسح `offer` و`offerPass` في واجهة الزبون حتى لا تبقى بطاقة QR تبدو صالحة لعرض منتهٍ.

- [x] **F6 — إصلاح حجب قارئات الشاشة في `cashback.tsx` و`purchases.tsx`** *(متوسطة)*
  - **المسار:** `src/app/customer/(tabs)/cashback.tsx:210-295`، `src/app/customer/(tabs)/purchases.tsx:78-83`
  - **الحل المعتمد:** ضمان قراءة كافة الأرصدة والحقول عبر قارئات الشاشة دون ابتلاعها في حاوية `accessible` ناقصة الوصف.

- [x] **F7 — تحسينات واجهة الزبون (`reducedMotion` للصورة، إعادة تحميل الصورة الفاشلة، التفاف الصفوف، حالة `isRefreshing` لزر Retry)** *(منخفضة)*
  - **المسار:** `src/app/customer/(tabs)/{index,cashback,purchases,profile}.tsx`
  - **الحل المعتمد:** تمرير `reducedMotion ? 0 : 180` للصورة وتصفير `failedImageUrl` عند التحديث؛ إضافة `flexWrap: 'wrap'` و`flexShrink: 1` لصفوف التفاصيل على `320dp`؛ وربط `loading={isRefreshing}` بزر Retry في `index.tsx`.

---

## القسم (G): مساحة المسوّق (`src/features/marketer/` و`src/app/marketer/`)

- [x] **G1 — دعم الترقيم الكامل والبحث السيرفري (`q`) في `useCampaignsFeed` و`marketer/(tabs)/index.tsx`** *(عالية)*
  - **المسار:** `src/features/marketer/campaigns/{api,hooks,types}.ts`، `src/app/marketer/(tabs)/index.tsx:55-64, 206-261`
  - **المشكلة:** يجلب صفحة 1 (50 حملة) فقط والبحث محلي فقط، ولا يتجاوز 100 عضوية.
  - **الحل المعتمد:** دعم `page`/`nextPage`/`loadMore` والبحث السيرفري `q` مع debounce `350ms` + `AbortController`، وجلب صفحات العضويات اللازمة ودمجها عبر `Map<string, CampaignViewModel>` للحفاظ على نفس الكاش والتجربة السريعة دون بطء.

- [x] **G2 — إصلاح ازدواج الجلب وفقدان الصفحات وتعارض حالات التحديث في `marketer/wallet/`** *(عالية)*
  - **المسار:** `src/features/marketer/wallet/hooks.ts:275-787`، `src/app/marketer/(tabs)/wallet.tsx:92-158, 201-223, 500-506, 544-557, 776-789`
  - **الحل المعتمد:** توحيد قفل الصفحة 1 عبر `inFlightPagesRef`، عدم مسح الصفحات `>= 2` عند التحديث الخلفي، تفعيل/ربط الجلب وحالة `isRefreshing` حسب القسم الفرعي النشط فقط (`activeSection`)، نقل خطأ `loadMore` إلى `ListFooterComponent` مع زر يعيد `loadMore()`، وإضافة زر إعادة المحاولة لتنبيه `walletErrorMessage`.

- [x] **G3 — تحصين تراجع `joinCampaign` التفاؤلي ضد تغيّر الجلسة أو الدور** *(متوسطة)*
  - **المسار:** `src/features/marketer/campaigns/hooks.ts:150-241`
  - **الحل المعتمد:** مقارنة `activeDetailKeyRef` و`activeFeedKeyRef` وحالة الجلسة قبل تطبيق النتيجة أو التراجع على `swrCache` و`state`.

- [x] **G4 — تحسينات صفحة تفاصيل الحملة للمسوّق (`campaigns/[id].tsx`)** *(متوسطة)*
  - **المسار:** `src/app/marketer/campaigns/[id].tsx:79-100, 155-172, 241-268, 397-462`
  - **المشاكل:** إخفاء `errorMessage` عند وجود حملة في الكاش؛ غياب `try/catch` و`isMountedRef` في `handleCopyReferralUrl`؛ السقوط لزر الانضمام إذا `approved` دون `validatedReferralUrl`؛ نقص `enabled: isFocused` والعودة لـ `/marketer` في `useAndroidBack`.
  - **الحل المعتمد:** عرض شريط خطأ مضمّن مع إعادة المحاولة عند وجود `campaign`، تغليف النسخ بـ `try/catch` + `isMountedRef`، إظهار تنبيه `invalidReferralUrl` للحالة الحدية، وتمرير `enabled: isFocused` و`onBack` متطابق مع زر الرجوع العلوي.

- [x] **G5 — عرض خطأ تحميل الحساب وزر إعادة المحاولة في `marketer/(tabs)/profile.tsx`** *(متوسطة)*
  - **المسار:** `src/app/marketer/(tabs)/profile.tsx:44, 121-159`
  - **الحل المعتمد:** استخراج `errorMessage` من `useProfileAccount()` وعرضه مع زر إعادة المحاولة.

- [x] **G6 — قارئات الشاشة، `tabular-nums`، و`AppState` resume refresh في المسوّق** *(منخفضة)*
  - **المسار:** `src/app/marketer/(tabs)/wallet.tsx:278-375`، `src/app/marketer/campaigns/[id].tsx:338-385`، `src/features/marketer/campaigns/hooks.ts:43-53, 133-143`
  - **الحل المعتمد:** إزالة `accessible` الحاجب للحقول الفرعية أو إكمال الوصف، إضافة `tabular-nums` للأرقام والمبالغ، وإضافة مستمع `AppState` resume لهوكس حملات المسوّق.

---

## القسم (H): مساحة التاجر (`src/features/merchant/` و`src/app/merchant/`) وتكامل `src/`

- [x] **H1 — إزالة الاستيراد المتقاطع بين `features/merchant/` و`features/marketer/` وفق `AGENTS.md:43`** *(متوسطة - عزل الأدوار)*
  - **المسار:** `src/features/merchant/campaigns/types.ts:1, 4-10`، `src/features/merchant/scanner/types.ts:1`، `src/features/marketer/campaigns/types.ts`
  - **الحل المعتمد:** نقل أنواع الحملة المشتركة الصرفة (`Campaign`, `CampaignStatus`, `CampaignType`, `CommissionSpec`, `JoinMode`) إلى وحدة مشتركة خفيفة في `src/core/campaigns/types.ts` (أو `src/core/api/types.ts`) واستيرادها من هناك في شريحتي المسوّق والتاجر بدون أي استيراد بين شرائح الأدوار.

- [x] **H2 — استبدال `invalidate` بـ `markStale` لمنع تجمّد تبويبات التاجر على Skeleton** *(حرجة - لوحة، حملات، محفظة، ماسح)*
  - **المسار:** `src/features/merchant/campaigns/hooks.ts:71-75, 338-347, 417-426, 464, 668`، `src/features/merchant/dashboard/hooks.ts:38-47`، `src/features/merchant/wallet/hooks.ts:73-82, 345-354`، `src/features/merchant/scanner/hooks.ts:24-28, 261`
  - **المشكلة:** حذف مفاتيح الكاش + شرط `!== null` في `useFocusEffect` يجمّد التبويبات المركّبة على Skeleton بعد إنشاء/إغلاق حملة أو تسوية QR.
  - **الحل المعتمد:** استبدال الحذف بـ `swrCache.markStale` / `swrCache.markStalePrefix` (مع الحفاظ على آخر بيانات مرئية) وتحديث شرط `useFocusEffect` في كل هوكس التاجر (وكذلك الزبون) إلى `if (!snapshot || !snapshot.isFresh) void refresh(...)` مع حماية التزامن.

- [x] **H3 — منع تعلّق `isLoadingMoreRef` و`isRefreshing` عند تغيير فلتر الحملات أثناء طلب جارٍ** *(عالية)*
  - **المسار:** `src/features/merchant/campaigns/hooks.ts:129-142, 161-210, 227-336`
  - **الحل المعتمد:** تصفير `isLoadingMoreRef.current` و`isLoadingMore` و`isRefreshing` داخل `useEffect` عند تغيّر `cacheKey` واستخدام `AbortController` لإلغاء الطلبات الملغاة للفلتر السابق.

- [x] **H4 — تحصين المعاينة الحية وتاريخ الانتهاء في إنشاء الحملة (`campaigns/new.tsx`)** *(عالية)*
  - **المسار:** `src/app/merchant/campaigns/new.tsx:103, 105, 178-180, 432-437`، `src/features/merchant/campaigns/hooks.ts:578-624`
  - **المشاكل:** تفعيل زر الإطلاق رغم فشل المعاينة؛ ظهور معاينة/خطأ قديم أثناء مهلة الـ 400ms عند مسح حقل وإعادة كتابته؛ تجمّد `minimumEndDate` عبر منتصف الليل؛ غياب زر retry للمعاينة.
  - **الحل المعتمد:** تضمين `!preview || Boolean(previewError)` في `isSubmitDisabled`؛ تصفير `previewState` فور تغيّر المدخلات أو عندما `previewInput === null`؛ إضافة `retryPreview()` وزر Retry؛ وحساب الحد الأدنى لتاريخ الانتهاء ديناميكياً عند فتح المنتقي (بما يتوافق مع اليوم الحالي/السيرفر وتوقيت دمشق).

- [x] **H5 — سد فجوة التحقق المحلي للخصم `100%` وصافي التاجر `<= 0` في `validation.ts`** *(عالية)*
  - **المسار:** `src/features/merchant/campaigns/validation.ts:60-87, 255-277`، `src/core/i18n/{ar,en}.ts`
  - **المشكلة:** قبول خصم 100% (`finalPrice === 0n`) أو عمولة تجعل `merchantNetSyp <= 0n` محلياً يؤدي لفشل السيرفر بـ `VALIDATION_ERROR` عام بلا `fieldErrors`.
  - **الحل المعتمد:** اشتراط `finalPrice > 0n` والتحقق من بقاء `merchantNetSyp > 0n` في `validateCampaignDraft` (استناداً لقواعد `api/src/campaign/campaign-pricing.ts` دون كسر تسعير السيرفر في المعاينة الحية) وإضافة رسائل خطأ واضحة ومترجمة لكل من الخصم والعمولة.

- [x] **H6 — إزالة شارة «نشطة» المضللة عن `topCampaign` في لوحة التاجر** *(متوسطة)*
  - **المسار:** `src/app/merchant/(tabs)/index.tsx:292-300`
  - **الحل المعتمد:** إزالة `<StatusBadge label={t.campaigns.activeStatus} />` من بطاقة `topCampaign` لأن عقد `TopMerchantCampaignDto` في الباك إند لا يضمن نشاط الحملة حالياً.

- [x] **H7 — أمان الكاميرا بالخلفية، حالة خطأ الماسح، مؤقت Focus، والتصديرات الميتة** *(عالية / متوسطة / منخفضة)*
  - **المسار:** `src/app/merchant/(tabs)/scanner.tsx:104-112, 129-133, 160-162, 680-708, 769`، `src/features/merchant/scanner/types.ts:3`
  - **المشاكل:**
    1. *(عالية)* بقاء `<CameraView>` والفلاش نشطَين عند وضع التطبيق في الخلفية (`AppState !== 'active'`).
    2. *(متوسطة)* عرض رسالة توقف معاينة خاطئة وزر «إيقاف الكاميرا» عند `status === 'error'`.
    3. *(منخفضة)* `setTimeout` للـ focus بدون تنظيف `clearTimeout` عند `unmount`.
    4. *(منخفضة)* استخدام `maxLength={128}` حرفياً بدل الثابت المصدّر `SCANNER_CODE_MAX_LENGTH`.
  - **الحل المعتمد:** تتبّع `appState === 'active'` وإدراجه في `isCameraLive` مع إطفاء الفلاش تلقائياً بالخلفية؛ تمييز حالة `status === 'error'` في مربع الكاميرا وزر الاستئناف؛ تنظيف `focusTimerRef` عند التفكيك؛ واستخدام `SCANNER_CODE_MAX_LENGTH`.

---

## سجل التحقق النهائي بعد إتمام كافة المراحل

- [ ] `npx tsc --noEmit` (0 errors) — *(يتطلب وجود `node_modules` مثبّتة في `hackathon-mobile/`؛ غير مثبّتة في حاوية المعاينة الحالية وتحتاج التشغيل محلياً بعد `npm install`)*
- [ ] `npx expo lint` (0 errors, 0 warnings) — *(يتطلب `hackathon-mobile/node_modules/` محلياً)*
- [ ] `npx expo-doctor` (20/20 checks) — *(يتطلب `hackathon-mobile/node_modules/` محلياً)*
- [x] فحص تطابق مفاتيح القاموس `ar.ts` === `en.ts` (0 مفاتيح مفقودة أو يتيمة — `457 === 457`)
- [x] فحص AST لخلو `src/` من الاستيرادات المتقاطعة بين الأدوار والتصديرات الميتة والمؤقتات غير المنظّفة (`119` ملفاً، `0` أخطاء نحوية، `0` استيرادات متقاطعة، `0` `console.log`، `0` مؤقتات غير منظّفة، مع اجتياز اختبارات `validation.ts` و`swrCache.ts`)
- [x] تحديث `hackathon-mobile/HANDOVER.md` بالنتائج النهائية
