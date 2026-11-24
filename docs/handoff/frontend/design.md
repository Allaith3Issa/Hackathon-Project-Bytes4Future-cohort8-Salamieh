# Affiliate Marketing Platform · Web design

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

This is the design reference for the Next.js frontend. Use the [API contract](../API_CONTRACT.md) for fields and state transitions, the [team task split](../HACKATHON_TASKS.md) for ownership, and the [frontend instructions](AGENTS.md) for implementation boundaries. The route names below describe web pages. API calls keep their `/api/v1` paths.

**Arabic and English.** Arabic is the default (`lang="ar"`, `dir="rtl"`). English routes use `lang="en"` and `dir="ltr"`. Localize visible copy, validation, errors, and accessible names. Use logical layout properties, put workspace navigation at the inline start, and isolate phone numbers, links, and codes where their reading direction differs. See the [current Web design guide](../../../web/design.md) for bilingual implementation details.

## Design direction

Build the experience around a **local shop counter**. Product photos and clear store badges help shoppers recognize the offer immediately. Clear prices, aligned numbers, crisp single-use QR passes, and clean ledger statements help customers, marketers, merchants, and admins verify every SYP movement.

- **Public pages persuade.** Put the product or store discount in view before asking a shopper to generate a QR. A shared offer link starts directly at the offer details.
- **Signed-in pages support tasks.** Give each workspace a clear page title, a primary action when available, and readable lists or forms. On merchant and marketer screens, keep available balances, locked reserves, and payout statuses unmistakable.
- **The signature flow is offer to QR scan to cashback.** Carry the same product/store name, discount, and attribution from `/r/[code]` through the customer's Offer QR pass to the merchant's QR scanner and the customer's cashback progress.
- Use team-owned or merchant-provided photography. When a photo is missing (common for store-wide discount offers), show a clean neutral store card with the shop name and discount badge.

## Color, type, and layout

Use a light theme for the hackathon. Warm paper is the main canvas, Deep Mauve Charcoal anchors the text, Dusty Mauve Pink accents selected areas, and burnt orange marks the main action.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#FBF7F2` | Warm paper background |
| `surface` | `#FFFFFF` | Forms, QR cards, data tables, ledger summaries |
| `text` | `#503C44` | Deep Mauve Charcoal for main text and headings |
| `text-muted` | `#6F555F` | Secondary labels, help text, original price |
| `mauve` | `#B78391` | Dusty Mauve Pink for small decorative accents or image backdrops |
| `mauve-tint` | `#F3E6E8` | Navigation selection, selected role, highlighted leaderboard row |
| `rule` | `#DDCBD0` | Decorative dividers and table row separation |
| `control-border` | `#987582` | Visible boundaries on enabled text fields and outlined controls |
| `action` | `#B54718` | Burnt orange for primary button fills, links, and focus rings |
| `action-hover` | `#943710` | Hover and pressed action surface |
| `success` / `success-bg` | `#315D47` / `#EDF5EF` | Verified, approved, scanned/paid, cashback unlocked, confirmed payout |
| `warning` / `warning-bg` | `#78451A` / `#FFF2DF` | Pending verification, pending approval, locked cashback, payout awaiting confirmation |
| `danger` / `danger-bg` | `#982D3D` / `#FBECEF` | Rejected, disputed payout, insufficient balance, form errors |
| `info` / `info-bg` | `#534767` / `#F1EDF5` | Ended offers, already redeemed QRs, informational notes |

Use white text on burnt-orange buttons and Deep Mauve Charcoal over the light mauve tint. White on burnt orange is approximately **5.41:1**. Charcoal on warm paper is **9.51:1**, and muted text on warm paper is **6.27:1**. Status always includes an Arabic word or phrase, with an icon where helpful. Target 4.5:1 contrast for normal text and 3:1 for essential control boundaries.

| Design property | Specification |
| --- | --- |
| Display typography | **Noto Naskh Arabic**, regular, for the home headline and referral offer heading only. Start at 40/52 px on phones and 56/70 px on wide screens. |
| Interface typography | **Noto Sans Arabic**, 400–700, with an Arabic-capable system sans-serif fallback. Body and form inputs 16/26 px, secondary text 14/23 px, workspace page titles 28/40 px, section headings 20/30 px. Align money, quantities, and totals (`tabular-nums`). |
| Spacing | Use 4, 8, 12, 16, 24, 32, 48, and 64 px. Use 16 px page gutters on phones, 24 px on medium screens, and 32 px on wide screens. Max content width 1,200 px. |
| Containers | Use 8 px radius for controls and 12 px for grouped surfaces. Prefer a flat canvas and fine rules. Save bordered surfaces for forms, QR passes, and summaries. |
| Widths | Compact below 768 px, medium from 768 to 1,023 px, wide from 1,024 px. Check 320, 390, 768, and 1,440 px. Keep centered forms up to ~560 px. |
| Motion | Short feedback around 120–180 ms. Respect `prefers-reduced-motion`. |

Use burnt orange for one primary action per task region. Use 44 px minimum touch targets for key controls.

## Navigation and screen specs

Use a simple wordmark and clearly labeled public links. Signed-in routes share a workspace shell with page title, active role badge, and role-appropriate navigation. Show a role switcher only when the user holds more than one role (`customer`, `marketer`, `merchant`).

### Demo navigation

Show public offer and sign-in, customer cashback progress, merchant campaign preview and launch, campaign closure, the manual scanner, and admin sign-in and top-up. The demo leaves the public leaderboard, full marketer web workspace, and full admin accounting overview out of navigation. Use seeded accounts for the live rehearsal. Show voucher controls when the extension is ready.

### Public, account, and customer · Alaa

| Web route or surface | Layout and behavior |
| --- | --- |
| `/` | Hero introducing cash-in-store local offers, customer cashback, and guaranteed marketer commissions. Show **تسجيل الدخول** in the demo. Add the registration and leaderboard links and role landing pages when those surfaces ship. No fabricated testimonials or fake figures. |
| `/register`, `/login` | One labeled column. Register with name, Syrian phone (`09xxxxxxxx`), password, and selectable roles (**عميل**، **مسوّق**، **تاجر**). Reveal shop name & details only when **تاجر** is selected. |
| `/r/[code]` | Show offer photo/store card, shop name, product/offer title, discount badge, final price (or store-wide discount %), and end date. Show **انتهى هذا العرض** when `ended` and **لم نعثر على رابط الإحالة** on `404`. When active: if signed out, show a compact inline prompt to sign in/register by phone right there; once signed in, show **إصدار بطاقة الخصم (QR)** and display the high-contrast single-use Offer QR + selectable `passCode` (`OF-...`) with reminder **اعرض هذا الرمز للتاجر عند الدفع كاش لتسجيل الخصم واحتساب الكاش باك**. |
| `/customer` | Customer Cashback Dashboard: show verified purchases count, milestone progress (e.g. `3 / 5 شراءات` and spend threshold toward unlock), prominent **الكاش باك المتاح للصرف** vs **الكاش باك المجمّد**, purchase history table/list, and **إصدار قسيمة كاش باك (QR)** form + active Voucher QR (`CB-...`) with option to cancel unused voucher. |
| `/leaderboard` (backlog) | Flat list/table with rank, marketer name, total earnings, and registration date. Keep backend ordering. Highlight authenticated marketer's row with `mauve-tint` and **أنت**. |

### Marketer web workspace · Alaa (backlog)

| Web route | Layout and behavior |
| --- | --- |
| `/marketer/campaigns` | Search (`q`) and filters (`joinMode`, `campaignType`) above uniform offer cards showing shop name, offer type (`منتج محدد` / `خصم فاتورة`), discount, commission, and end date. |
| `/marketer/campaigns/[id]` | Full offer details + Join (**الانضمام إلى الحملة**) or Request (**طلب الانضمام**) action, status badge (`بانتظار الموافقة` / `مقبول` / `مرفوض`), and approved referral URL with **نسخ الرابط** and **مشاركة**. |
| `/marketer/memberships` | Joined and requested campaigns with status, link copy/share actions, clicks, sales, and earnings. Confirm copy with **تم نسخ الرابط**. |
| `/marketer/stats`, `/marketer/wallet` | Prominent `availableBalanceSyp`, `pendingPayoutSyp`, and total earnings. Include **أرباحي حسب كل متجر** breakdown, transaction ledger, **طلب سحب أرباح** form (amount + Sham Cash / Syriatel Cash / Cash + account details), and **سجل طلبات السحب** showing Admin's uploaded Sham Cash receipt image with **تأكيد الاستلام** and **الإبلاغ عن مشكلة** actions. |

### Merchant workspace · Tayma

| Web route | Layout and behavior |
| --- | --- |
| `/merchant` | Top summary showing verification status (`بانتظار الاعتماد` / `معتمد` / `مرفوض`), **الرصيد المتاح** (`availableBalanceSyp`), **الرصيد المحجوز للحملات** (`lockedBudgetSyp`), top-performing campaign highlight, and totals (clicks, sales, gross cash sales, commissions paid, platform fees paid, conversion). Direct actions to **إنشاء حملة** and **مسح رمز QR**. |
| `/merchant/campaigns`, `/merchant/campaigns/new` | List with status, sales progress, remaining `lockedBudgetSyp`, and end date. The demo creation form uses **عرض على منتج محدد** (`product`), open joining, and fixed commission. Enable **خصم على الفاتورة** (`store_discount`) when store discounts ship. Display the backend live preview of **التكلفة المحجوزة لأسوأ الحالات** (`worstCaseReserveSyp`) and per-sale fee/cashback/commission split alongside available balance check before **إطلاق الحملة**. |
| `/merchant/campaigns/[id]` | Status, remaining locked budget, and **إغلاق الحملة وإرجاع الرصيد المتبقي** with confirmation. Show **رابط المتجر المباشر** with a copy button when `directReferralUrl` has a value. Add approval controls and participant reporting with those features. |
| `/merchant/scanner` | Manual code input for the demo, with a future camera QR scanner (`OF-...` or `CB-...`) with fallback when camera is denied. After lookup: for `offer_qr`, show customer name, offer details, and the API cash preview for one item, and confirm **تأكيد البيع وخصم الرصيد**; for the voucher extension, show the voucher amount, ask the merchant for the bill total before applying it, and confirm **قبول قسيمة الكاش باك وإضافة الرصيد**. Show the API’s cash amount after redemption, or explain that a smaller bill leaves the voucher active. Show the settlement breakdown after confirmation and indicate when the sale closed the campaign. Clear the manual code on success. Stop the camera on success when camera scanning ships. For future store discounts, request a fresh API preview after the merchant enters or changes the bill and show the cash and fee breakdown before confirmation. |
| `/merchant/wallet` | Available vs locked balance cards + paginated ledger listing Admin top-ups, campaign locks/unlocks, sale deductions, and cashback voucher reimbursements. |

### Admin workspace · Tayma

| Web route | Layout and behavior |
| --- | --- |
| `/admin` (demo) | Dedicated Arabic sign-in (**تسجيل دخول الإدارة**). After successful sign-in, take the admin to `/admin/topups`. |
| `/admin` accounting overview (backlog) | Display separated accounting cards: **إجمالي شحنات التجار المستلمة**، **أرصدة التجار المتاحة**، **الاحتياطي المحجوز بالحملات**، **مستحقات المسوقين (المتاح + قيد السحب)**، **صندوق الكاش باك للعملاء (المجمّد + المتاح + المحجوز للقسائم)**، و**صافي رسوم المنصة بعد الكاش باك**، plus counts of merchants, marketers, customers, active campaigns, and sales. |
| `/admin/merchants` (backlog) | Verification queue with shop details, legal contract reference field, and **اعتماد التاجر** / **رفض الطلب** actions. |
| `/admin/topups` | Select verified merchant, enter received SYP amount, payment method (`كاش` / `شام كاش` / `سيريتل كاش` / `حوالة`) and reference note to credit `availableBalanceSyp`, plus top-up ledger table. |
| `/admin/payouts` (backlog) | Filterable payout queue (`قيد المراجعة` / `تم التحويل` / `مؤكد` / `مُعترض عليه` / `مرفوض`). On pending requests: upload Sham Cash receipt image, enter transfer reference, and tap **تأكيد التحويل** (or **رفض الطلب** with reason). For disputed payouts, show **تأكيد وصول الحوالة** and **إعادة المبلغ إلى الرصيد**. Both actions require a note. Restoring funds also requires the reference for the returned transfer. |
| `/admin/users`, `/admin/campaigns` (backlog) | Paginated oversight tables with role and status filters. |

## Data, feedback, and accessibility

- **No frontend arithmetic.** Always render backend-provided reserves, fee splits, cashback milestones, and pagination links directly.
- **Loading, empty, and confirmed states.** Keep headings in place during fetches; use clear Arabic empty states (**لا توجد حملات نشطة حالياً**، **لا توجد طلبات سحب بعد**). Prevent double submissions and reuse `Idempotency-Key` on uncertain campaign launches, voucher issuance, QR redemptions, top-ups, and payout submissions.
- **Camera fallback.** Keep manual code entry accessible whenever camera access is unavailable or denied.

### Error copy examples

| API code or state | Visible Arabic copy |
| --- | --- |
| `INVALID_CREDENTIALS` | «تعذّر تسجيل الدخول. تحقّق من رقم الهاتف وكلمة المرور وحاول مرة أخرى.» |
| Session expired or revoked | «انتهت جلستك. سجّل الدخول مرة أخرى.» |
| `MERCHANT_NOT_VERIFIED` | «يجب اعتماد حسابك كتاجر وتوقيع الاتفاقية قبل إنشاء حملة.» |
| `INSUFFICIENT_MERCHANT_BALANCE` | «رصيدك المتاح غير كافٍ لتغطية الحد الأقصى لتكلفة الحملة. اشحن رصيدك عبر الإدارة للمتابعة.» |
| `INSUFFICIENT_LOCKED_BUDGET` | «الرصيد المحجوز لهذه الحملة غير كافٍ لإتمام هذه العملية.» |
| `QR_ALREADY_REDEEMED` | «تم استخدام هذا الرمز من قبل ولا يمكن مسحه مرة أخرى.» |
| `CAMPAIGN_ENDED` | «انتهى هذا العرض.» |
| `AMOUNT_OUT_OF_RANGE` | «المبلغ الناتج يتجاوز الحد المسموح به.» |
| `INSUFFICIENT_WALLET_BALANCE` | «المبلغ المطلوب يتجاوز رصيدك المتاح للسحب.» |
| `INSUFFICIENT_CASHBACK_BALANCE` | «رصيد الكاش باك المتاح غير كافٍ لإصدار هذه القسيمة.» |
| Camera unavailable | «الكاميرا غير متاحة. أدخل الرمز يدوياً.» |
