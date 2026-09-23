# DealOS

DealOS is an independent, Nigeria-first digital-business acquisition marketplace prototype. It is not affiliated with Africa Acquisition. It demonstrates first-party authentication, seller onboarding, a multi-business marketplace, NDA-controlled document rooms, diligence, offers, simulated Naira wallets and escrow, asset transfer and deal settlement.

Sandbox uploads and simulated funding are **disabled unless explicitly enabled** with `DEALOS_DEMO_VERIFICATION_ENABLED=true`, `DEALOS_DEMO_DOCUMENTS_ENABLED=true` and `DEALOS_DEMO_FINANCE_ENABLED=true`. The sample local environment enables them for a disposable database. For public deployments, leave them disabled unless the demonstration is intentionally isolated and accepts only fabricated sample files.

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
2. **Review personal identity.** Buyers and sellers submit one synthetic identity sample under their account. The advisor opens the file and records a simulated approval. A new account is never automatically verified.
3. **Verify each business.** A seller creates a draft listing. Every listing starts with its own pending registration and revenue reviews, even if the seller already has approved businesses. Under My businesses, upload synthetic CAC, ownership and business-address evidence, plus bank-statement and profit-and-loss samples. The advisor opens each file and approves each section. Add a financial sample to the listing's confidential room before publishing. The marketplace supports search and 12-item pages, tested with 100 businesses.
4. **Start an acquisition.** The verified buyer opens a published listing and starts a transaction. Each buyer/listing combination has its own deal. The buyer reviews and signs the sample NDA before entering that deal's confidential data room.
5. **Review and negotiate.** Diligence findings and seller questions are tied to each deal; sellers can answer them. The buyer submits a Naira offer. The seller accepts or declines. One accepted offer closes that listing to competing buyers and records the agreed amount.
6. **Simulate closing.** The advisor advances the deal to the closing agreement, explicitly creates an escrow account for the accepted offer, then advances to escrow. The buyer adds demo funds to their wallet and funds this acquisition. Buyer and seller independently confirm every transfer item and sign off; the advisor confirms and releases simulated funds. The buyer's balance decreases on funding, and the seller's balance increases once on release. All actions are recorded as separate wallet and escrow ledger entries.

The workspace has separate buyer, seller and reviewer navigation, and every Documents, Due Diligence and Escrow page asks the user to choose a deal rather than opening the first listing automatically.

## Tests and operational boundaries

CI runs a clean `npm ci`, Prisma generation and migrations, one-time reviewer bootstrap checks, a **100-business** PostgreSQL seed, UI-source constraints, API tests, Next.js/NestJS production builds and an API acquisition smoke test. The web smoke test launches the production standalone Next.js build with its static browser assets, checks public and authenticated pages and drives actual Chromium sessions through buyer, seller and advisor workflows. Its complete browser journey covers registration, synthetic identity and listing verification with reviewer inspection, confidential documents, a Naira offer, seller diligence responses, simulated wallet funding, escrow, dual asset confirmation and a single simulated payout. Responsive marketplace behavior is checked at a mobile viewport. Manual visual and accessibility review remains a separate release check.

The sandbox now persists small synthetic PDF, PNG, JPEG and CSV uploads in private PostgreSQL byte fields, so a subsequent request is not dependent on the API instance that received the file. This is a demonstration storage strategy, not production-grade handling of real identity documents. A deployment accepting real sensitive documents needs durable encrypted private object storage, malware scanning, strict access controls, retention and deletion policies. Production identity verification and actual money custody require their own regulated-provider integrations and operational controls. None are simulated as genuine external verifications or payouts.

See [Operations](docs/OPERATIONS.md) for scaling, incident handling and deployment considerations.

### Verify the current branch

Run the end-to-end acquisition tests with a disposable local PostgreSQL database and a fresh seed. These commands deliberately do not run against a shared or production database:

```bash
npm ci
npm run db:generate
npm run db:deploy
DEALOS_ALLOW_DESTRUCTIVE_SEED=true DEALOS_SEED_LISTING_COUNT=100 npm run db:seed
npm run build
DEALOS_SMOKE_DEMO_PASSWORD="<your local demo fixture password>" npm run test:smoke
```

CI supplies the fixture password for its isolated ephemeral database. The full API test covers account registration, independent business review, confidential file access, two competing offers, manual escrow opening, idempotent wallet funding, asset transfer, and a single seller payout. The web test renders the public and authenticated Next.js routes against the actual API.
