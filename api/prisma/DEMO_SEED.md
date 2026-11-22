# Local demo seed

By default, use a dedicated local PostgreSQL database, such as `affiliate_marketing_demo`. The seed accepts loopback hosts and database names starting with `affiliate_marketing_demo` or `affiliate_marketing_seed_test`, with optional underscore-separated suffixes. This mode rejects the database named by `DATABASE_URL` and requires `NODE_ENV=development` or `NODE_ENV=test`.

From `api/`, run `npx --no prisma migrate deploy` with a process-scoped `DATABASE_URL` pointed at the dedicated database. Then restore the normal `DATABASE_URL` or use a new shell. For seeding, set `DEMO_SEED_DATABASE_URL` to the dedicated database URL without query options. Set distinct `DEMO_ADMIN_PASSWORD` and `DEMO_ACCOUNT_PASSWORD` values of at least 12 characters and at most 72 UTF-8 bytes privately in the environment or ignored `.env`. The second password applies to all six non-admin accounts.

```powershell
$env:NODE_ENV = 'development'
npm run db:seed
```

The first run creates both fixtures in one transaction. Later runs leave the fixtures as they are, including any subsequent top-ups, sales, status changes, expiry dates, and credentials. A conflicting identifier on first run aborts the transaction. Use a fresh dedicated database to start a new rehearsal from the initial state.

## Opt in to local development seeding

For local Swagger testing, `DATABASE_URL` must identify the loopback `affiliate_marketing_dev` database. Apply the existing migrations, set the two demo passwords privately, and opt in for this invocation.

```powershell
$env:NODE_ENV = 'development'
$env:ALLOW_DEV_DEMO_SEED = '1'
try { npm run db:seed } finally { Remove-Item Env:ALLOW_DEV_DEMO_SEED }
```

This mode uses `DATABASE_URL`. The first run requires empty application tables. A rerun verifies the seed marker and expected account identities, then leaves their credentials, balances, and activity intact.

## Accounts and fixtures

Account UUIDs use the prefix `aff111a7-e000-4000-8000-` and the 12-digit suffix below. Phones are synthetic fixture identifiers.

| Scenario | Role | Phone | UUID suffix | Initial balance |
| --- | --- | --- | --- | --- |
| Live | Admin | `0999100001` | `000000000001` | No wallet |
| Live | Verified merchant | `0999100002` | `000000000002` | 100,000 SYP available |
| Live | Marketer | `0999100003` | `000000000003` | 0 SYP available |
| Live | Customer | `0999100004` | `000000000004` | 0 SYP cashback |
| Scanner | Verified merchant | `0999100005` | `000000000005` | 0 SYP available, 435,000 SYP reserved |
| Scanner | Marketer | `0999100006` | `000000000006` | 0 SYP available |
| Scanner | Customer | `0999100007` | `000000000007` | 0 SYP cashback |

The live merchant starts with no campaign. The scanner fixture has separate users, balances, campaign, membership, and pass. Both opening credits use the demo admin as the ledger actor. The scanner opening credit of 435,000 SYP is fully offset by the campaign reserve lock.

- Scanner campaign ID is `aff111a7-e000-4000-8000-000000000040`. Maamoul box costs 100,000 SYP before a 10% discount, or 90,000 SYP after discount. It is an active, open product campaign with a fixed 10,000 SYP commission, a 30-item cap, zero sales, and a 435,000 SYP locked reserve. It expires 30 days after the first seed run. The image URL is the contract’s sample placeholder.
- Approved membership ID is `aff111a7-e000-4000-8000-000000000041`. The public referral path is `/r/mk-demo01` on the demo web origin.
- The active Offer QR pass ID is `aff111a7-e000-4000-8000-000000000042`. Its human-readable code is `OF-DEMO01`. The token is generated on first run.

## Password verification format

The seed uses `bcrypt.hash(password, 10)` with a fresh salt per account. Use `bcrypt.compare(password, storedHash)` when implementing the demo login verifier, following [B4F Board’s auth service](https://github.com/b4f-cohort8-salamiyah/b4f-board-final/blob/8eb592e1606d8eadb26a7988e9230eba0be92055/api/src/auth/auth.service.ts).

Databases initialized by the earlier scrypt seed keep their original hashes when rerun. For bcrypt credentials, provision a **new** dedicated local demo database, apply the existing migrations, point `DEMO_SEED_DATABASE_URL` at it, and run the seed once. Keep the previous database if its rehearsal activity is needed. Bcrypt cannot verify scrypt hashes, and converting one requires the original password and an explicit credential migration.
