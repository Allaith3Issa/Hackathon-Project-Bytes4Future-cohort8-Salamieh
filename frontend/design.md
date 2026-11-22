# Affiliate Marketing Platform · Web design

This is the design reference for the Next.js frontend. Use the [API contract](../API_CONTRACT.md) for fields and state transitions, the [team task split](../HACKATHON_TASKS.md) for ownership, and the [frontend instructions](AGENTS.md) for implementation boundaries. The route names below describe web pages. API calls keep their `/api/v1` paths.

**Arabic only.** Set `lang="ar"` and `dir="rtl"` on the root HTML element. All visible copy, validation, error messages, and accessible names are Arabic. English screen descriptions in this guide are implementation notes. Use logical layout properties, put the wide workspace navigation at the inline start (right), and isolate phone numbers, links, and codes where their reading direction differs.

## Design direction

Build the experience around a **local shop counter**. Product photos help shoppers recognize what they’re buying. Clear prices, aligned numbers, and a receipt-style summary help customers and shop staff verify what happened. Merchants, marketers, and admins use the same typography and colors in an interface suited to everyday work.

- **Public pages persuade.** Put the product and price in view before asking a guest to commit. The home page explains how merchants sell and marketers earn. A shared offer link starts at the product.
- **Signed-in pages support tasks.** Give each workspace a clear page title, a primary action when one is available, and a readable list or form. On a campaign page, approval status, remaining limits, and referral actions have priority over decorative presentation.
- **The signature flow is offer to receipt.** Carry the same product name, quantity, and price hierarchy from the referral page through checkout to the receipt. Show the customer what the merchant needs to verify. Use the same order of information in the merchant’s receipt lookup.
- Use team-owned or merchant-provided photography. Choose honest crops with the item clearly identifiable. When a photo is missing, use a neutral placeholder with the product name beside it. Keep the approval and checkout flows legible without photography.

## References reviewed

These ten public references were selected for their relevance to affiliate discovery, merchant operations, independent sellers, and checkout. The design decisions on the right are adaptations for this project.

| Reference | Pattern used here |
| --- | --- |
| [Shopify Collabs](https://www.shopify.com/collabs/creators) | Put people, products, and clear role language up front. Open the home page with local-product imagery and distinct merchant and marketer entry points. |
| [Awin](https://www.awin.com/us/) | Make audience choices explicit. Use plain-language merchant and marketer role cards at registration and allow both roles on one account. |
| [impact.com](https://impact.com/affiliate-marketing/) | Make commission information and partner performance easy to distinguish. Separate settled revenue, commission paid, and reserved capacity in merchant views. |
| [PartnerStack Program Directory](https://market.partnerstack.com/) | Make an offer searchable and comparable. Give each campaign result the same positions for commission per item, expiry, and join mode. |
| [Rewardful](https://www.rewardful.com/) | Keep referral links accessible from the affiliate workspace. Place Copy link and Share next to the approved campaign in My Campaigns. |
| [Tapfiliate](https://tapfiliate.com/) | Keep attribution metrics distinct. Show clicks, settled items, earnings, and conversion as separately labeled values. |
| [Refersion](https://www.refersion.com/) | Give campaign operations and participant decisions clear homes. Separate pending requests from approved participants in campaign details. |
| [Etsy](https://www.etsy.com/) | Use recognizable product photography and make the available price easy to scan. Pair a clear photo crop with a dominant final price on referral pages. |
| [Gumroad Discover](https://gumroad.com/discover) | Make independent products the focus of discovery. Keep browse controls compact so the search results appear early in the viewport. |
| [Stripe Checkout](https://stripe.com/payments/checkout) | Keep the order summary next to a focused confirmation flow. Show the product, chosen quantity, and total before simulated payment. |

## Color, type, and layout

Use a light theme for the hackathon. Warm paper is the main canvas, Deep Mauve Charcoal anchors the text, Dusty Mauve Pink accents selected areas, and burnt orange marks the main action.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#FBF7F2` | Warm paper background |
| `surface` | `#FFFFFF` | Forms, receipt, data table, checkout summary |
| `text` | `#503C44` | Deep Mauve Charcoal for main text and headings |
| `text-muted` | `#6F555F` | Secondary labels, help text, original price |
| `mauve` | `#B78391` | Dusty Mauve Pink for small decorative accents or image backdrops |
| `mauve-tint` | `#F3E6E8` | Navigation selection, selected role, highlighted leaderboard row |
| `rule` | `#DDCBD0` | Decorative dividers and table row separation |
| `control-border` | `#987582` | Visible boundaries on enabled text fields and outlined controls |
| `action` | `#B54718` | Burnt orange for primary button fills, links, and focus rings |
| `action-hover` | `#943710` | Hover and pressed action surface |
| `success` / `success-bg` | `#315D47` / `#EDF5EF` | Paid, verified, approved, delivered |
| `warning` / `warning-bg` | `#78451A` / `#FFF2DF` | Pending review, pending approval, or payment held |
| `danger` / `danger-bg` | `#982D3D` / `#FBECEF` | Rejected, payment failure, and form errors |
| `info` / `info-bg` | `#534767` / `#F1EDF5` | Ended offers, already used receipts, and informational notes |

Use white text on burnt-orange buttons and Deep Mauve Charcoal over the light mauve tint. White on burnt orange is approximately **5.41:1**. Charcoal on warm paper is **9.51:1**, and muted text on warm paper is **6.27:1**. Use solid Dusty Mauve Pink as decoration only. Status always includes a word or phrase, with an icon where it helps. Target 4.5:1 for normal text and 3:1 for essential control boundaries and indicators. Give the focus ring a visible gap from the control edge. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

| Design property | Specification |
| --- | --- |
| Display typography | **Noto Naskh Arabic**, regular, for the home headline and referral product heading only. Start at 40/52 px on phones and 56/70 px on wide screens. Preserve the space needed for Arabic letterforms and diacritics. |
| Interface typography | **Noto Sans Arabic**, 400–700, with an Arabic-capable system sans-serif fallback. Body and form inputs 16/26 px, secondary text 14/23 px, workspace page titles 28/40 px, section headings 20/30 px. Align money, quantities, and totals. |
| Spacing | Use 4, 8, 12, 16, 24, 32, 48, and 64 px. Use 16 px page gutters on phones, 24 px on medium screens, and 32 px on wide screens. Public and workspace content max out at 1,200 px. |
| Containers | Use 8 px radius for controls and 12 px for grouped surfaces. Prefer a flat canvas and fine rules. Save a bordered surface for forms, checkout summaries, and receipts. Keep shadows for overlays that need separation. |
| Widths | Compact below 768 px, medium from 768 to 1,023 px, wide from 1,024 px. Check 320, 390, 768, and 1,440 px. Keep forms at a readable width, up to around 560 px when centered. |
| Motion | Use short state feedback around 120–180 ms. Respect `prefers-reduced-motion` and keep all information and controls available without animation. |

Use orange for one primary action per task region. On the offer page, the primary button is **الدفع في المتجر**, with **الطلب عبر الإنترنت** alongside or below it as a secondary action. Both remain visible while the offer is active. Use named text buttons for meaningful actions, plain outlines for secondary actions, and inline links for navigation. Use 44 px minimum targets for key touch controls.

## Navigation and screen specs

Use a simple wordmark and clearly labeled public links. Signed-in routes share a workspace shell with a page title, current role, and navigation. Use a sidebar on wide layouts and a labeled menu on compact layouts. Show a role switch only when the account has more than one relevant workspace. Switching role changes the visible navigation. The API still checks permissions and resource ownership.

### Public, account, and checkout · Alaa

| Web route or surface | Layout and behavior |
| --- | --- |
| `/` | Open with one strong product photo and a concise headline that describes selling and earning locally. Put **إنشاء حساب** and **تسجيل الدخول** in reach. Follow the hero with two concise paths, **للتجّار** and **للمسوّقين**, and expose the public leaderboard through navigation. Avoid fictional testimonials, logos, sales figures, and guarantees. |
| `/register`, `/login` | Use one labeled form column. Register with name, phone number, and password, plus independent **تاجر** and **مسوّق** selections. Reveal shop name and details only for the merchant role. Login uses phone and password. Keep field help and errors close to the inputs. Route signed-in users to an authorized workspace. |
| `/r/[code]` | On wide screens show the product image beside the offer summary. On compact screens stack the image, name, final price, original price and discount, end date, and actions. Place the description after the decision-critical details when space is tight. Keep the supplied final price prominent and label the original price. Show **انتهى هذا العرض** in the action area when the API returns `ended`. Show a separate **لم نعثر على رابط الإحالة** state on `404`. |
| Referral checkout | Use a focused checkout state within `/r/[code]`. Keep a visible summary with product, selectable quantity, and amount. On wide screens place it beside the form. On phones stack it above the confirmation button. For online orders collect name, phone, and delivery address. Label the simulator **دفع تجريبي** and let the user choose an approval or decline outcome. Collect no real card credentials. Use **تأكيد الدفع التجريبي** for the primary action. |
| In-store receipt and online confirmation | For an in-store success, show **تم الدفع**, product, quantity, amount paid, date, receipt number, and a high-contrast QR with a clear quiet zone. Show **أبرز هذا الإيصال في المتجر** and keep the receipt number selectable. For an online success, show **تم إرسال الطلب** and **بانتظار تأكيد التاجر** with the amount held. A pending online order is distinct from a redeemed in-store receipt. |
| `/leaderboard` | Use a flat list or table with rank, name, earnings, and registration date. Keep backend ordering. An authenticated marketer sees **ترتيبك** and a text **أنت** marker on their visible row. Use the mauve tint as secondary emphasis. |

### Marketer workspace · Alaa

| Web route | Layout and behavior |
| --- | --- |
| `/marketer/campaigns` | Put search and join-mode filter directly above the list. Use photo-led cards with the same order of information on every result. Show product name, final price, commission per item, end date, and join mode. Use **عرض الحملة** as the clear next step. Split search-empty and no-campaign states. |
| `/marketer/campaigns/[id]` | Pair the offer details with a visible membership action. Use **الانضمام إلى الحملة** for open campaigns and **طلب الانضمام** when approval is required. A pending request displays **بانتظار الموافقة**. Approved membership displays the server-provided link with **نسخ الرابط** and **مشاركة**. Show a rejected request clearly and offer **إعادة طلب الانضمام** only where the contract allows it. Ended campaigns disable new participation. |
| `/marketer/memberships` | Show joined and requested campaigns with labeled status. Put link actions beside each eligible campaign. Show clicks, items sold, and earnings as compact, labeled facts. Confirm a successful copy with **تم نسخ الرابط**. Keep **نسخ الرابط** available when native sharing is unavailable. |
| `/marketer/stats`, `/marketer/wallet` | Make earned SYP and wallet balance prominent on their respective pages. Give clicks, items sold, earnings, and conversion their own labels. List wallet transactions by campaign, amount, and date with server pagination. Use text and tables for the supplied totals. |

### Merchant workspace · Tayma

| Web route | Layout and behavior |
| --- | --- |
| `/merchant` | Put verification status, plan usage, and **إنشاء حملة** eligibility at the top. Show a clear explanation when verification or quota blocks creation. Give the wallet balance strong typography and list clicks, settled items, revenue, commission paid, and conversion as labeled values. Link directly to **الحملات**، **الطلبات**، and **مسح الإيصال**. |
| `/merchant/campaigns`, `/merchant/campaigns/new` | Use a tidy table or mobile list with status, date, and usage. Group creation fields into product, pricing and commission, and campaign limits and join mode. Show the backend pricing preview beside the form on wide screens and above **إطلاق الحملة** on phones. Mark per-item amounts as such. Keep the preview visibly pending or unavailable until the current values have a valid response. |
| `/merchant/campaigns/[id]` | Lead with status, end date, and campaign usage. Label settled items and commissions separately from reservations. Use an approvals section with **موافقة** and **رفض** on pending rows, and a participant table with clicks and settled sales. Confirm any decision after the API accepts it. |
| `/merchant/receipts` | Offer **مسح الرمز** and **إدخال رقم الإيصال**. Keep manual entry available through camera denial or failure. A valid lookup shows product, quantity, payment amount, and receipt number before **تأكيد تسليم المنتج**. A redeemed receipt is a clear terminal state. The scanner closes or stops after a successful read. |
| `/merchant/orders` | Put status filters above the list. Each row shows the order, product, quantity, amount, date, and labeled state. Open details for delivery contact and address. Pending orders offer **قبول** and **رفض**. Before rejection, explain the full simulated refund and require confirmation. Accepted orders offer **تأكيد التوصيل**. |
| `/merchant/wallet`, `/merchant/plans` | Put wallet balance above transaction history. For plans, show the current tier, dates and usage, with a clear label for **غير محدود** when supplied limits are `null`. Show API-provided prices and plan limits. Show a simulated payment confirmation before subscribe or renew. |

### Admin workspace · Tayma

| Web route | Layout and behavior |
| --- | --- |
| `/admin` | Without a valid admin session, show a dedicated Arabic form headed **تسجيل دخول الإدارة** with phone, password, and a sign-in button. It uses the existing admin account and has no registration link. After successful admin sign-in, show merchant and marketer counts, active campaigns, settled sales, and fee, plan, and total income. Place **مراجعة طلبات التجّار** near the overview heading. Use flat summary groups with aligned labels and numbers. |
| `/admin/merchants` | Start with the pending verification queue. Show merchant and shop details with current status. Use **اعتماد التاجر** and **رفض الطلب**. Confirm rejection and refresh the affected row after the API responds. |
| `/admin/users`, `/admin/campaigns` | Use paginated, labeled tables for oversight. Users can be filtered by role and campaigns by status. Show merchant and product identity where relevant. Stay within fields and actions exposed by the admin API. |

## Data, feedback, and accessibility

- **No frontend arithmetic.** This applies to browser code, Next.js server code, and UI helpers. Use `checkoutOptions` for quantities and totals, `/merchant/campaigns/pricing-preview` for the live estimate, `usage` and plan fields for limits, and `previousPage` and `nextPage` for navigation. Use API-supplied ranks and metrics directly. Formatting can add separators, `ل.س.` for Syrian pounds, or the Arabic percent sign `٪` without changing a value. Display the offer end timestamp instead of a calculated countdown. If a progress value is missing, use labeled counts and flag the API gap.
- **Loading and empty states.** Keep the page title and action context in place during fetches. Use short, geometry-matched placeholders where they reduce movement. Write an empty state for the task at hand, such as **لا توجد حملات تطابق عوامل التصفية** or **لا توجد معاملات في المحفظة بعد**. A failed list request gets a clear Arabic error and a retry when safe.
- **Readable errors.** Map API codes to clear instructions. Show field errors under the matching input, preserve entered data where safe, and focus the first invalid field when submission fails. Announce important asynchronous feedback with an appropriate live region. Keep error text next to the related action and visible without relying on color. Never expose raw JSON or stack traces.
- **Confirmed state.** Prevent duplicate submissions while pending. Keep the previous value until the backend confirms payments, approvals, redemption, orders, limits, and balances. If checkout’s outcome is uncertain, reuse the original idempotency key for the same payload. Record one referral click on actual navigation, including for an ended offer. Prefetch and server rendering do not record clicks.
- **Responsive and accessible.** Use persistent labels, keyboard navigation, visible focus, and a logical reading order. Preserve the key status and action on compact layouts. Adapt wide data tables to labeled rows where that helps users act. Keep real tabular relationships when rows or values need comparison. Camera permission errors must retain manual entry. Supply useful alt text for meaningful product images, and provide receipt number and instructions beside the QR.
- **Handling private data.** Use the documented web session boundary, with refresh requests every 15 minutes while signed in and server expiry after 30 days of inactivity. Show only permitted fields in each workspace, avoid shared caching on authenticated views, and keep delivery details inside the relevant merchant order. Guest checkout does not require creating an account.

### Error copy examples

| API code or state | Visible copy |
| --- | --- |
| `INVALID_CREDENTIALS` | «تعذّر تسجيل الدخول. تحقّق من رقم الهاتف وكلمة المرور وحاول مرة أخرى.» |
| Session expired or revoked | «انتهت جلستك. سجّل الدخول مرة أخرى.» |
| `CAMPAIGN_LIMIT_EXCEEDED` | «الكمية المتاحة أقل من طلبك. اختر كمية أصغر.» |
| `CAMPAIGN_ENDED` | «انتهى هذا العرض.» |
| `PAYMENT_DECLINED` | «رُفض الدفع التجريبي. اختر نتيجة الاختبار وحاول مرة أخرى.» |
| `RECEIPT_ALREADY_REDEEMED` | «استُخدم هذا الإيصال من قبل.» |
| `MERCHANT_NOT_VERIFIED` | «يجب اعتماد حسابك كتاجر قبل إنشاء حملة.» |
| `PLAN_LIMIT_REACHED` | «استنفدت عدد الحملات المتاح في هذه الفترة. اطّلع على الخطط للمتابعة.» |
| Camera unavailable | «الكاميرا غير متاحة. أدخل رقم الإيصال.» |

## Build and review order

Build one complete journey first. Approve a marketer, open their referral link, make an in-store simulated purchase, and redeem the receipt. Then complete online orders, plans, wallets, statistics, and the leaderboard with the same visual hierarchy. Use the Arabic demo product name **علبة معمول، ١ كغ** and the team’s seeded prices when reviewing. The running frontend takes every amount from the API.

- Check the offer, checkout, and receipt together at 390 px and 1,440 px. Check dense workspaces at 320, 768, and 1,440 px. Make sure amount labels, titles, long names, and important actions remain readable.
- Review real active, pending, approved, ended, paid, refunded, and already-redeemed states. Test keyboard access, camera fallback, error recovery, mobile navigation, and zoom. Confirm each visible field and action maps to the API contract.
- Build only the requested surfaces and states. Apply the reference patterns through these tokens and layouts, using original copy and imagery. This file guides the implementation when the corresponding work is assigned.
