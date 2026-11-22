# Frontend agent instructions

These instructions apply to work under `frontend/`.

## Stay within the request

- Implement only the screens, states, and interactions requested, plus what is directly required to make them work. The [API contract](../API_CONTRACT.md) and [team task split](../HACKATHON_TASKS.md) are references. They do not authorize implementing unrelated screens or completing the entire project.
- Reuse existing components and dependencies. Do not add unrequested pages, redesigns, features, animations, libraries, broad refactors, or backend changes. Surface a real API mismatch instead of inventing a route or response shape.
- Keep changes on the assigned branch and use a pull request when asked to submit them. Do not push to `main` or create commits, deployments, or PRs unless requested.

## Follow `design.md`

- Read `frontend/design.md` before UI work. If the team puts `design.md` at the repo root, use that as the fallback. Follow the applicable file for layouts, tokens, typography, component behavior, and responsive rules.
- While the design file is missing, continue requested API integration and other work that does not depend on the design. Reuse any established UI patterns. If a requested visual decision has no project reference, flag the missing direction. Do not create or change the design file unless asked.

## Next.js and TypeScript

- Use Next.js with the App Router and TypeScript. Keep route files focused on composition, use Server Components by default, and use Client Components for interactions and browser APIs. Keep feature-specific parts close to their routes and extract shared components only when there is real reuse.
- Use the shared typed API client and the documented endpoints. Next.js may handle the web session and forward authenticated requests to NestJS. All product rules and database access belong in NestJS. Keep web and Android values consistent with the API.
- Within the requested flow, reuse the project’s loading, error, empty, and success states. Use semantic controls, accessible labels, and keyboard interaction. Keep the interface usable at the widths in `design.md`.

## Arabic only

- Set `lang="ar"` and `dir="rtl"` on the root HTML element. Use Arabic for every user-facing string, including the admin sign-in, navigation, field labels, validation, errors, empty states, and accessible names. Provide only Arabic web UI.
- Use logical spacing and alignment. Isolate phone numbers, links, reference codes, and receipt identifiers where needed so they read in their natural direction inside Arabic text. Keep transport field names and route paths as defined by the API contract.

## No frontend arithmetic

- Frontend application code must not perform arithmetic. This covers browser code, Next.js server code, and UI helpers. NestJS supplies every calculated value the interface needs, including checkout totals, discount and commission amounts, balances, statistics, ranks, progress values, limits, and pagination.
- Render API values directly. Formatting may add separators, currency labels, or percent signs without changing the numeric value. For quantity changes, select the matching server-provided checkout option. For pagination, use the next or previous page returned by the API. If a value is missing, flag the contract gap and resolve it with the backend. Never add a frontend calculation as a fallback.

## Clear, readable errors

- Map API error codes to short, plain-language Arabic that says what happened and what the user can do next. For example, show «الكمية المتاحة أقل من طلبك. اختر كمية أصغر.» or «استُخدم هذا الإيصال من قبل.» Translate field errors before displaying them and use a clear Arabic fallback for unknown errors.
- Show validation messages beside the relevant fields and keep the user’s entries when they can be corrected. Show request failures near the action that failed, expose them to assistive technology, and make the message readable without relying on color alone.
- Use a safe fallback for unexpected errors. Keep stack traces, raw responses, and sensitive details out of the UI. Offer a retry when the operation can be retried safely. For an uncertain purchase outcome, retry with the original idempotency key.

## Security

- Keep access and refresh tokens in server-managed HttpOnly cookies. Use `Secure` in production and an appropriate `SameSite` policy. Keep tokens out of browser storage, client props, URLs, and logs. Check the origin of cookie-authenticated mutations at the server boundary.
- Keep secrets in server-only environment variables. Use `NEXT_PUBLIC_` only for values safe to publish. Keep authenticated responses private and avoid shared caching of customer, admin, or merchant data. Treat frontend route guards as navigation aids. NestJS must authorize each request.
- Render API data as text unless sanitized markup is explicitly required. Validate or constrain external URLs before rendering them. Use only the demo payment choice in API requests, and never collect or transmit real payment credentials.

## Session refresh and admin sign-in

- While signed in, request a refresh every 15 minutes through the same-origin Next.js server boundary. The server exchanges the refresh token with NestJS and updates both cookies. Coordinate refreshes so tabs and parallel requests do not independently rotate the same token. If a tab resumes after a pause, check the session before resuming protected work.
- Report deliberate authenticated user activity through the server boundary. Do not report timers, refresh calls, polling, or background traffic as activity. NestJS decides when a session reaches 30 days of inactivity. Refresh when only the access token has expired. If the session is expired or revoked, or the refresh token is rejected, clear both cookies, stop refresh scheduling, and show «انتهت جلستك. سجّل الدخول مرة أخرى.» Manual sign-out revokes the session and clears its cookies.
- At `<hostname>/admin`, show the Arabic admin sign-in form when there is no valid admin session. Submit the existing admin's credentials to the dedicated admin login endpoint through the server boundary. Show the admin overview at `/admin` after successful sign-in. Regular accounts cannot access admin content, and the admin form has no registration action.

## Keep the implementation simple and efficient

- Prefer local state and direct rendering of API data. Use arrays for ordered render lists and a `Map` or `Set` only for repeated lookups or deduplication when it helps. Avoid duplicating API data in global state or adding memoization, state libraries, or caching without a concrete need.
- Use optimistic UI only for low-risk, reversible changes that can roll back on failure. Wait for backend confirmation for payment, receipt redemption, approvals, order status, campaign capacity, and wallet balances. Disable duplicate submissions while pending and reuse the documented idempotency key when retrying the same purchase.
- Verify the requested screen and its relevant loading and error states, permissions, and responsive behavior. Report any checks you could not run.
