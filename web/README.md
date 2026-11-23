# Web frontend

Use Node.js 20.9 or newer. From this folder, run:

```sh
npm ci
npm run dev
```

Next.js serves the web frontend on port 3000 by default. The server-only API client defaults to `http://localhost:3001/api/v1`. Set `API_BASE_URL` in `.env.local` to point to another NestJS instance. Use seeded customer credentials and a referral URL from the shared handoff.

`lib/api.ts` exports `apiRequest` for server-side calls. `lib/session.ts` exports `saveSession`, `getAccount`, and `authenticatedRequest` for the merchant and admin work. Use these helpers from Server Components, Server Actions, or Route Handlers. Only Server Actions and Route Handlers can write session cookies. Both languages share the button, field, and surface styles.

The customer flow covers sign-in, returning to a referral offer, issuing an Offer QR, and viewing cashback progress and purchase history. NestJS supplies all monetary values and milestones. The shared handoff in `docs/handoff` defines the API and fixtures.

## Arabic and English

Arabic is the default and keeps the existing unprefixed paths. English paths use `/en`, for example `/en/login` and `/en/r/mk-demo01`. The language switcher uses an explicit `/ar` link to switch back to Arabic. Arabic public pages have an unprefixed canonical URL. The proxy saves the language in a separate cookie and preserves the query string when opening legacy links, including `/r/[code]`.

The App Router pages under `app/[locale]` serve both languages. Add interface text to both dictionaries in `messages/` and look it up using `getI18n()` on the server or `useI18n()` in client components. Use `LocalizedLink` for internal navigation. Names and descriptions supplied by users or the API are displayed as entered. The shared formatter presents SYP in the current locale while keeping the API’s integer minor units and the `Asia/Damascus` timezone.

See the [web design guide](design.md) for the bilingual typography, palette, and interface patterns.
