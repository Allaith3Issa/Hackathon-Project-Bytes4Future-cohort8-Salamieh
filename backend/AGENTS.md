# Backend agent instructions

These instructions apply to work under `backend/`.

## Stay within the request

- Implement only the feature or fix requested and the changes directly required to make it work. The [API contract](../API_CONTRACT.md), [ERD](../DATABASE_ERD.md), and [team task split](../HACKATHON_TASKS.md) describe the project. They do not authorize implementing their entire contents in one task.
- Reuse existing code and dependencies. Do not add unrelated endpoints, tables, dependencies, auth flows, background jobs, infrastructure, broad refactors, or documentation changes. Surface a genuine cross-team dependency or contract conflict before changing public behavior.
- Keep changes on the assigned branch and use a pull request when asked to submit them. Do not push to `main` or create commits, deployments, or PRs unless requested.

## NestJS and PostgreSQL

- Use NestJS and TypeScript with PostgreSQL. Organize related controllers, DTOs, services, and persistence code in feature modules. Keep controllers thin. Put business rules and transaction boundaries in services. Use the project’s existing persistence layer and migrations.
- Define request DTOs, validate them, and map database records to explicit response DTOs. Keep Swagger and the API contract aligned for any requested interface change. Use the same status, pricing, and money rules across web and Android endpoints.
- Treat NestJS as the authority for permissions, pricing, limits, balances, and state transitions. Use database constraints for uniqueness and invariants where practical. Handle checkout retries and concurrent writes with idempotency keys, transactions, row locks for shared capacity checks, and conditional state updates for single-use actions.
- Return all computed values the frontend needs, including checkout totals by quantity, pricing previews, balances, statistics, limits, and pagination. Keep these calculations in the feature that owns them and reuse them across its endpoints. Return stable error codes with plain-language messages and field-level guidance when available.

## Extend the backend when requested

- Keep feature boundaries clear. Each module owns its business rules and writes. Other modules should use its exported service methods instead of reaching into its repositories or duplicating its rules. Keep exports small and avoid circular dependencies.
- For an extension, add behavior to the owning module. Create a new module when the requested capability has its own responsibilities. Introduce an interface or shared abstraction only when there is a concrete need, such as a second implementation or shared behavior across existing features.
- Preserve existing clients and data as features grow. Prefer additive API changes, keep database migrations compatible with existing records, and coordinate breaking changes across web, Android, Swagger, and the Markdown contract. Verify existing behavior touched by an extension.
- Keep future extensions possible through clear boundaries and readable code. Build new capabilities, providers, and infrastructure when the user asks for them.

## Security

- Deny access by default. Explicitly designate public routes, verify bearer tokens, and enforce both role and resource ownership in the backend. Never let public input create an admin or set verification status, a wallet balance, or a payout. Return only fields the caller is allowed to see.
- Validate request bodies, route parameters, and query parameters. Reject unknown fields, bound input lengths and pagination, use parameterized database queries, and use generic login failures. Apply rate limits to login, referral, checkout, and receipt lookup. Restrict CORS to configured origins where browser access is needed.
- Hash passwords with a password-hashing algorithm such as Argon2id. Keep credentials and signing keys in server-side environment variables. Never commit `.env`, expose stack traces, or log passwords, access tokens, refresh tokens, receipt tokens, or delivery details.
- Simulate payments locally. Do not accept real card data, integrate a payment gateway, or use an external paid service. Calculate all amounts server-side. An order or receipt update must never create a second settlement, refund, or handover.

## Session refresh and admin sign-in

- Issue a 15-minute access token and an opaque refresh token at sign-in. Support the frontend's 15-minute refresh cycle through the [API contract](../API_CONTRACT.md#authentication-and-account). Store refresh token hashes server-side, rotate the token atomically on a successful refresh, and prevent reuse of a rotated token.
- Enforce an inactivity limit of 30 days on every session, including admin sessions. Use the server clock and the last qualifying user activity. Initialize it on sign-in and update it only after genuine authenticated activity. Automatic refresh, polling, and background requests do not extend the inactivity window. On expiry or explicit sign-out, invalidate the session and reject its tokens. Verify session validity on protected requests.
- Provision the team's existing admin account in the backend's initialization or seed step after database migrations. Run initialization idempotently. Use backend-only configuration for the admin identity and initial credentials, hash the password before storage, and preserve an existing admin's credentials. Treat an identity collision with a non-admin as a configuration error. Do not embed credentials in code or expose public admin registration.
- Keep admin sign-in behind the dedicated admin login endpoint used by the web page at `/admin`. Allow only an existing admin to sign in there and enforce the admin role on every admin API request. Use a generic invalid-credentials error for a wrong password, an unknown account, or a non-admin account.

## Keep the implementation simple and efficient

- Start with the simplest readable implementation that meets the requested behavior. Use an array for ordered results, a `Set` for repeated membership checks, or a `Map` for repeated keyed lookups only when it helps. Use SQL filtering, pagination, and aggregation for database-backed data. Avoid per-row queries and unbounded reads.
- Add an index when a constraint or a concrete query needs it. Avoid speculative caches, queues, or generic repositories. Prefer a conditional update for a single-record transition and a transaction with an explicit lock when enforcing an invariant across related records.
- Verify the requested flow and its relevant error paths using the existing checks. For money, permissions, and concurrent updates, include a check for the failure case the change is meant to prevent. Report any checks you could not run.
