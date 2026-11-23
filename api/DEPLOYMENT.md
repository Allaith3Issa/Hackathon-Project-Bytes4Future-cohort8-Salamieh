# Backend deployment and database readiness

## Render service configuration

Use a Node Web Service with root directory `api`. Choose a Node version supported by [package.json](./package.json). From that directory use:

| Setting | Value |
| --- | --- |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health Check Path | `/api/v1/health` |

The build generates Prisma Client and compiles TypeScript. The server listens on `0.0.0.0:$PORT` after verifying database connectivity. Nest shutdown hooks close the Prisma-owned PostgreSQL pool when Render sends SIGTERM. [Render web service configuration](https://render.com/docs/web-services) · [Render health checks](https://render.com/docs/health-checks)

## Production environment

Set values privately on the API service. Keep deployment secrets out of example files, client variables, shell history, and logs.

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production`, which enables startup configuration validation |
| `DATABASE_URL` | Required PostgreSQL URL with the intended database name and Neon TLS settings |
| `JWT_SECRET` | Required random signing secret of at least 32 bytes |
| `WEB_BASE_URL` | Required public HTTPS web origin, without a path or embedded credentials |
| `PORT` | Render provides the port. Outside Render it defaults to `3000`. |
| `CASHBACK_MILESTONE_PURCHASES` | Optional. Defaults to `5`. |
| `CASHBACK_MILESTONE_SPEND_SYP` | Optional. Defaults to `50000` in new SYP minor units. |

[.env.example](./.env.example) is for local development. `ALLOW_DEV_DEMO_SEED`, `DEMO_SEED_DATABASE_URL`, `DEMO_ADMIN_PASSWORD`, and `DEMO_ACCOUNT_PASSWORD` are local seed settings. The bootstrap has its own temporary `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PHONE`, and `BOOTSTRAP_ADMIN_PASSWORD`; see [ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md).

The integration tests use dedicated URLs supplied to the test process. `HEALTH_INTEGRATION_DATABASE_URL` must point to a fresh migrated database named `affiliate_marketing_health_test_<suffix>` on `127.0.0.1` with no URL options. Other suites use their own `*_INTEGRATION_DATABASE_URL` or `MVP_E2E_DATABASE_URL` and enforce their own database-name guards. Keep these inputs out of production.

## Neon, migrations, and bootstrap

Confirm the Neon project, branch, and database before running release commands. Use a TLS connection string, preferably with `sslmode=verify-full` for the Node PostgreSQL runtime, and keep the connection options supported by Neon. The API uses one PostgreSQL pool per process for Prisma and for readiness probes. Size the deployment for Neon connection limits across all API instances. A Neon pooled runtime URL is available when the deployment needs connection sharing. [Neon Prisma guidance](https://neon.com/docs/guides/prisma)

Migrations are a separate release step. In a controlled job or trusted shell, inject the **direct** Neon connection as `DATABASE_URL` and run from `api`:

```sh
npx --no prisma migrate deploy --config prisma7.config.ts
npx --no prisma migrate status --config prisma7.config.ts
```

Run them once per release before sending traffic to that schema. Use a Render pre-deploy step where available or a separate authorized release job. Startup applies no migrations. After the initial migration, provision the first admin manually using the [bootstrap guide](./ADMIN_BOOTSTRAP.md) and remove the bootstrap secrets afterward. [Render deploy steps](https://render.com/docs/deploys)

## Verification and recovery

- A healthy `GET /api/v1/health` returns `200 {"status":"ok"}`. The readiness probe checks the same PostgreSQL pool used by Prisma with a read-only `SELECT 1` and a 2.5-second deadline. A missing, unavailable, or unresponsive database returns `503 DATABASE_UNAVAILABLE` with a generic public message.
- From a controlled shell, use `npm run db:check` with the intended runtime configuration to verify connectivity. Use Prisma migration status separately to verify schema history. The health check only measures connectivity.
- If startup or readiness fails, verify the environment, port, Neon status, TLS settings, and database privileges privately. Correct the configuration and retry. If migration status shows a failed migration, investigate the release failure before retrying. Recover using the last known-good deployment when it is compatible with the database schema. Avoid resetting, reseeding, or overwriting the hosted database.
