# DealOS

DealOS is an independent, Nigeria-first digital-business acquisition marketplace prototype. It is not affiliated with Africa Acquisition. It demonstrates first-party authentication, seller onboarding, a multi-business marketplace, NDA-controlled document rooms, diligence, offers, simulated Naira wallets and escrow, asset transfer and deal settlement.

**Demonstration only.** Verification decisions use synthetic documents. Wallet balances and escrow transactions are simulated. Do not upload real NIN, BVN, identity, customer or banking documents or treat demo balances as real funds.

## Technology

Next.js 16, React 19 and TypeScript power the web application. NestJS 11 owns HTTP APIs and domain services. PostgreSQL and Prisma provide transactional persistence, indexes, append-only audit activity, optimistic deal versioning, idempotency records and an outbox for reliable in-app notifications. Server-Sent Events update active deal screens. The application uses first-party scrypt password hashing and server-stored opaque sessions with HttpOnly cookies and CSRF protection.

The prototype is a modular monolith so deal, offer, identity and money-like sandbox movements can share atomic database transactions. See [Architecture](docs/ARCHITECTURE.md) and [Marketplace scope](docs/MULTI_MARKETPLACE_SCOPE.md).

## Local installation

Use Node.js 22 or newer, npm and Docker with PostgreSQL.

```bash
cp .env.example .env
# Add your local DATABASE_URL to .env
docker compose up -d
npm ci
npm run db:generate
npm run db:deploy
```

The example env file enables synthetic evidence uploads, private sample documents and demo wallet activity for local testing. It disables destructive seeding by default. To load **10 independent businesses** into a disposable development database:

```bash
DEALOS_ALLOW_DESTRUCTIVE_SEED=true DEALOS_SEED_LISTING_COUNT=10 npm run db:seed
npm run dev
```

To test the larger marketplace, set `DEALOS_SEED_LISTING_COUNT=100` instead. **Seeding deletes existing accounts, listings and transaction history. Never run it against a production or shared database.**

Open the web application at `http://localhost:3000`; the API uses `http://localhost:4000`.

### Seeded local accounts

| Role | Email | Password |
| --- | --- | --- |
| Buyer | `amara@northstar.capital` | `DealOS2026!` |
| Seller | `tunde@korametrics.example` | `DealOS2026!` |
| Advisor | `nia@dealos.example` | `DealOS2026!` |

These credentials are **only for the disposable demonstration database**. The local seed creates multiple independent deals so documents, diligence and escrow can be explored for different businesses.

### Starting with an empty database

After migrations, create the first reviewer without seeding:

```bash
read -s DEALOS_REVIEWER_PASSWORD
echo
DEALOS_BOOTSTRAP_REVIEWER=true \
DEALOS_REVIEWER_NAME="Deal Reviewer" \
DEALOS_REVIEWER_EMAIL="reviewer@example.com" \
DEALOS_REVIEWER_PASSWORD="$DEALOS_REVIEWER_PASSWORD" \
npm run auth:bootstrap-reviewer
unset DEALOS_REVIEWER_PASSWORD
```

Replace the example email. This one-time command refuses to run if a reviewer or admin already exists and does not promote an existing account. Ordinary registration is restricted to buyer or seller accounts.

## End-to-end product journey

1. **Create accounts.** Register separate buyer and seller accounts. Log in as the reviewer when their demonstration evidence is ready.
2. **Review identity.** The buyer submits one fabricated sample resembling an accepted identity document. A seller submits fabricated identity, business ownership/registration/address and revenue evidence. The reviewer opens each sample and records an explicit simulated approval.
3. **List a business.** The verified seller creates a draft, uploads at least one synthetic financial document and publishes the business. The public marketplace supports search and 12-item pages, including a 100-listing test.
4. **Start an acquisition.** The verified buyer opens a published listing and starts a transaction. Each buyer/listing combination has its own deal. The buyer reviews and signs the sample NDA before entering that deal's confidential data room.
5. **Review and negotiate.** Diligence findings and seller questions are tied to the deal, and the seller can answer questions. The buyer submits a Naira offer. The seller accepts or declines. One accepted offer closes that listing to competing buyers and opens a dedicated escrow record.
6. **Simulate closing.** The advisor advances the deal after the required checks. The buyer adds fabricated funds to a demo wallet and funds this deal's escrow. Buyer and seller confirm each handover item independently, sign off, and the advisor records the simulated release. The seller's demo wallet is credited exactly once.

The workspace has separate buyer, seller and reviewer navigation, and every Documents, Due Diligence and Escrow page asks the user to choose a deal rather than opening the first listing automatically.

## Tests and operational boundaries

CI runs a clean `npm ci`, Prisma generation and migrations, one-time reviewer bootstrap checks, a **100-business** PostgreSQL seed, UI-source constraints, API tests, Next.js/NestJS production builds, the complete API acquisition smoke test and a web-route smoke test for public and authenticated pages. A real browser interaction and visual review remain separate from these automated checks.

The bundled private-file implementation is intended for a **single-process sandbox** and does not constitute production-grade identity-document storage. A multi-replica deployment needs durable encrypted private object storage, malware scanning, access controls, retention and deletion policies. Production identity verification and actual money custody require their own regulated-provider integrations and operational controls. None are simulated as genuine external verifications or payouts.

See [Operations](docs/OPERATIONS.md) for scaling, incident handling and deployment considerations.
