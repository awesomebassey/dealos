# Deploy DealOS API to Back4app Containers

The backend Dockerfile and .dockerignore are committed at the repository root.
Back4app must build from the repository root, not apps/api.

## Back4app setup

- Connect `awesomebassey/dealos` and deploy `main`.
- Use the repository root (`/`) as build context and `Dockerfile` as the Dockerfile path.
- Set the service port to `8080` and health check to `/api/health`.
- Supply the following runtime environment variables in the Back4app dashboard; never commit actual secrets:

```dotenv
DATABASE_URL=<your Neon PostgreSQL connection string with TLS enabled>
NODE_ENV=production
API_PORT=8080
CORS_ORIGIN=https://<your-netlify-site>.netlify.app
DEALOS_DEMO_VERIFICATION_ENABLED=false
DEALOS_DEMO_DOCUMENTS_ENABLED=false
DEALOS_DEMO_FINANCE_ENABLED=false
DEALOS_ALLOW_DESTRUCTIVE_SEED=false
```

## Database preparation

Run schema migrations once from a local checkout against the Neon database:

```bash
npm ci
npm run db:generate
npm run db:deploy
```

For a fresh database, bootstrap the first reviewer with the one-time `npm run auth:bootstrap-reviewer` command described in README.md. Do not run the destructive demo seed against production or a shared database.

## Verify and connect Netlify

After the container starts, open `https://<your-back4app-host>/api/health`. Then set Netlify's `API_INTERNAL_URL` to `https://<your-back4app-host>` and redeploy the frontend. Confirm that login, server-rendered pages, same-origin `/api/*` routes, and the SSE deal update route all work.

The Docker image builds only NestJS, the contracts workspace, and the Prisma client. It neither embeds the Neon connection string nor runs database migrations or seeding on startup. Free-container memory is constrained; the 128 MB Node heap cap helps but does not guarantee that NestJS plus Prisma fits into the full memory allowance.

The current verification, wallet, and escrow functionality is simulated. Keep demo flags disabled on an unrestricted public deployment. Use only fabricated files on access-restricted demo installations.
