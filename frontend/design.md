---
name: "مردود | Mardood"
description: "Shared brand and design tokens for the Mardood Arabic storefront and Android marketer app"
colors:
  action: "#B54718"
  action-hover: "#943710"
  dusty-mauve: "#B78391"
  mauve-tint: "#F3E6E8"
  ink: "#503C44"
  muted: "#6F555F"
  canvas: "#FBF7F2"
  surface: "#FFFFFF"
  rule: "#DDCBD0"
  control: "#987582"
  success: "#315D47"
  success-bg: "#EDF5EF"
  danger: "#982D3D"
  info: "#534767"
  info-bg: "#F1EDF5"
typography:
  display:
    fontFamily: "IBM Plex Sans Arabic"
    fontWeight: 700
  body:
    fontFamily: "IBM Plex Sans Arabic"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "IBM Plex Sans Arabic"
    fontSize: "14px"
    fontWeight: 600
rounded:
  control: "8px"
  panel: "12px"
spacing:
  compact: "8px"
  gutter: "16px"
  section: "24px"
---

# مردود | Mardood · Web and mobile design

## Overview

Use this guide for Alaa’s public/customer web pages, Tayma’s merchant/admin web pages, and Esmaeel’s React Native / Expo marketer app. The web homepage leads with a photograph of a local bakery counter. The public offer puts the product name and price before the QR action. The customer dashboard gives the available balance the most emphasis and places progress and purchase history below it.

The Android app shares the same typography, colors, controls, and financial hierarchy. Its demo flow covers marketer sign-in, browsing open campaigns, joining and sharing an offer, and viewing commission. The shopper opens the shared offer in the browser and gets the Offer QR there. Merchant redemption happens on the web.

Repository references: [current web styles](app/globals.css), [research and imagery](DESIGN-NOTES.md), [frontend setup](README.md), [web assignments](../docs/tasks/02-frontend.md), [mobile assignments](../docs/tasks/03-mobile.md), and the [API contract](../docs/handoff/API_CONTRACT.md). If this file is shared by itself, look for these paths in the team repository.

## Brand and logo

- Write **مردود** in Arabic UI, accessible labels, and browser titles. Use **Mardood** where an English project name is needed. The supplied logo already includes both wordmarks.
- Use the [full transparent logo](public/brand/mardood-logo.png) on white or warm canvas. Keep the orange offer tag on the right in RTL layouts. Preserve its aspect ratio, built-in clear space, and original colors.
- Use the [square symbol PNG](public/brand/mardood-symbol.png) for the browser tab and for compact brand placements. The symbol uses the existing offer tag and return arrow.
- **Tayma · Web:** Merchant and admin screens should inherit the shared [web layout](app/layout.tsx). The logo links to the home page with the accessible name **مردود، الصفحة الرئيسية**. It renders at 112 px wide on phones and 144 px from 640 px upward, with a 44 px minimum link height. Let the navigation wrap when space is tight.
- **Esmaeel · Expo:** Use the full logo on sign-in and the square symbol where a compact mark is needed. Display it with `resizeMode="contain"` and use **مردود** for the Android display name. For the launcher icon, place the symbol on the platform’s icon canvas and check the Android adaptive icon crop on a device.

## Colors

| Role | Hex | Use |
| --- | --- | --- |
| Burnt orange | `#B54718` | Primary buttons with white text, links, focus indications, and milestone fills |
| Orange pressed | `#943710` | Active or pressed primary buttons |
| Dusty Mauve Pink | `#B78391` | Brand mark and decorative accents |
| Light mauve | `#F3E6E8` | Quiet information panels, selected surfaces, and secondary balances |
| Deep Mauve Charcoal | `#503C44` | Main text and the dark balance surface, with white text on that surface |
| Muted text | `#6F555F` | Descriptions, hint text, and non-primary transaction information |
| Canvas and surface | `#FBF7F2`, `#FFFFFF` | Warm app background and white inputs or panels |
| Divider and control border | `#DDCBD0`, `#987582` | Row dividers and interactive outlines respectively |
| Success | `#315D47` on `#EDF5EF` | Confirmation and successful settlement |
| Error | `#982D3D` | Invalid credentials or failed actions |
| Information | `#534767` on `#F1EDF5` | Ended offers and informational notices |

Pair status colors with Arabic text. Keep solid Dusty Mauve Pink for accents and use the light tint for panels that carry text.

## Typography

Use **IBM Plex Sans Arabic** throughout. The current web frontend loads **400**, **600**, and **700** locally. Use the same three native font files on Android and load them through `expo-font`. The web package uses CSS and WebFonts. Expo should load the native font files from the official IBM package. [IBM Plex Sans Arabic](https://github.com/IBM/plex/tree/master/packages/plex-sans-arabic) · [Expo font setup](https://docs.expo.dev/develop/user-interface/fonts/)

| Role | Web reference | Suggested Android starting point |
| --- | --- | --- |
| Display | Homepage 36.8–58 px with line height 1.24. Offer title 32–56 px with line height 1.25. Both use weight 700. | Screen titles at 28/38, weight 700 |
| Section title | 20–24 px, weight 700 | 20/28, weight 700 |
| Body | 16 px on standard screens, weight 400 | 16/26, weight 400 |
| Field label and action | 14–16 px, weight 600 | 14/22 for labels and 16/24 for actions, weight 600 |
| Balance | 24–36 px by prominence and viewport, weight 700 | 32/42 for the main balance, weight 700 |

The Android numbers are font size and line height in React Native layout units. Use the matching loaded family for each weight. Keep system text scaling enabled and let long Arabic titles wrap. Format money with Arabic-friendly grouping and `ل.س.`, without changing amounts returned by the API. Keep phone numbers, codes, and raw URLs in LTR order within the RTL layout.

## Layout

- Use Arabic for visible copy, labels, accessible names, and errors. Enable RTL in Expo and check it on the actual Android build. Use logical start/end spacing for alignment. [React Native RTL guidance](https://reactnative.dev/docs/i18nmanager)
- Use a single scrollable column on phones, with a 16-unit gutter and safe area space. Use about 8 units between an input and its label or between closely related items, and 24 units between sections.
- Use at least 48 × 48 units for Android touch targets. Web inputs are 48 px high and main web actions have a minimum height of 44 px.
- Put the screen title and primary action in predictable positions. Keep price, commission, availability, and date readable at narrow widths and larger system text sizes.
- On the web, use `page-wrap` for the shared 1,200 px maximum and responsive gutters. Center the single-column offer at up to 600 px wide from the tablet breakpoint to desktop, then use the existing two-column layout. Retain the balanced homepage heading and let long Arabic content wrap.
- Keep the keyboard skip link in the shared web layout. During validation, move focus to the first invalid field or the form-level error. After a QR is issued, move focus to **بطاقة الخصم جاهزة**.

## Elevation & Depth

Build with warm canvas, white surfaces, and thin dividers. Use Deep Mauve Charcoal to give the most important balance more visual weight. Keep lists flat and readable.

## Shapes

Use 8-unit corners for controls and 12-unit corners for panels and image frames. Use a visible control outline on text inputs and secondary buttons. Keep campaign images consistent in crop and use the light mauve store fallback for missing merchant photos.

## Components

### Current web patterns

| Surface | Use and behavior |
| --- | --- |
| Navigation and homepage | Use the shared Mardood logo and role-appropriate links. Keep the bakery photo and two-line desktop headline as the main visual, with the steps in the light mauve section below. |
| Forms and recovery | Reuse `surface`, `page-title`, `button-primary`, `button-secondary`, `notice`, and `notice-error`. Keep Arabic errors close to the relevant input or action. Show a retry for a temporary offer load failure and a separate message for an invalid referral. |
| Public offer and QR | Label the API-provided final price before the action. Reserve image space, then use the light mauve store panel when the API has no photo. Keep the QR, manual code, and copy action together. On narrow screens, stack the code and button. Differentiate successful copying from the fallback that selects the text. |
| Customer cashback | Put the available balance on Deep Mauve Charcoal and the locked balance on light mauve. Show both milestone conditions separately and explain that both are required. Keep purchase amounts aligned and use an explanatory empty state when the customer has no purchases. |

### Tayma’s merchant and admin web screens

Use the shared app shell, form states, and API client. Put one primary action in each step. For top-up, show the merchant and amount before submission and the returned balance afterward. For campaign launch, put the backend reserve preview next to the launch action. In the manual scanner, keep lookup, cash due, confirmation, and settlement in that order. Display an Arabic explanation with next action when lookup fails or a code was already used. These are handoff patterns for the merchant/admin screens.

### Esmaeel’s Expo screens

| Surface | Direction for Expo |
| --- | --- |
| Sign-in | Stack labeled phone and password fields, then one orange action, **تسجيل الدخول**. Keep errors next to the field or action. Use the seeded marketer account through `POST /auth/login` and keep credentials in secure device storage. |
| Campaign list and details | Use an image or store fallback, then product and shop names, final price, marketer commission, and expiry. Read campaign values from `GET /campaigns` and `GET /campaigns/{campaignId}`. Use Arabic text for active and ended states. |
| Join and share | Show **الانضمام إلى الحملة** on an eligible campaign. After joining through `POST /marketer/campaigns/{campaignId}/join`, show **مشاركة العرض** when the API returns a `referralUrl`. Share that exact public URL using the platform share sheet. |
| Commission balance | Use a dark mauve panel with a clear label such as **الرصيد المتاح** and a large white amount. Read `availableBalanceSyp` from `GET /marketer/wallet` and refresh after settlement. Keep pending payouts visually separate when that feature ships. |
| Loading, empty, and error states | Keep the page title and layout stable. Show **لا توجد حملات نشطة حالياً** for an empty list and a clear retry action when loading fails. Disable duplicate join submissions while pending. |

## Do's and Don'ts

- Use the same colors and typography on both platforms, with controls sized for touch on Android.
- Use API values for prices, commission, statuses, links, and balances. Keep the mock seed and example figures out of production UI copy.
- Keep the Expo demo focused on sign-in, browse, join, share, and commission. Wallet history, payout receipt flows, statistics, and the leaderboard are backlog.
- Use the same status language on web and mobile. A pending action needs visible feedback. A confirmed action needs a clear result before balances or statuses change.
- Check the Android flow at a small phone width and with larger system text. From the device, join a campaign, share the link, open the web offer, then verify that the commission changes in Expo after the merchant scan.

The current customer web flow was checked in an isolated Edge session at 320, 390, 768, and 1440 px. Navigation, Arabic RTL, sign-in validation, QR copying, and cashback presentation passed against the mock API. Check native text scaling, touch behavior, merchant scanning, and balance updates on a physical Android device during live integration.

