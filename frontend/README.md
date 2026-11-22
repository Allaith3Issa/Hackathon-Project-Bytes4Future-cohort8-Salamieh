# Web frontend

Use Node.js 20.9 or newer. From this folder, run:

```sh
npm ci
npm run dev
```

Next.js serves the web frontend on port 3000 by default. The server-only API client defaults to `http://localhost:3001/api/v1`. Set `API_BASE_URL` in `.env.local` to point to another NestJS instance. Use seeded customer credentials and a referral URL from the shared handoff.

`lib/api.ts` exports `apiRequest` for server-side calls. `lib/session.ts` exports `saveSession`, `getAccount`, and `authenticatedRequest` for the merchant and admin work. Use these helpers from Server Components, Server Actions, or Route Handlers. Only Server Actions and Route Handlers can write session cookies. The global RTL layout and the button, field, and surface styles are shared.

The customer flow covers sign-in, returning to a referral offer, issuing an Offer QR, and viewing cashback progress and purchase history. NestJS supplies all monetary values and milestones. The shared handoff in `docs/handoff` defines the API and fixtures.

See [web design references](DESIGN-NOTES.md) for the Arabic typography, palette, and patterns used in the interface.
