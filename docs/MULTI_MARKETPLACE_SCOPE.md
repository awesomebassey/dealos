# DealOS: multi-business transaction design

## Product journey
Buyer: register -> submit identity evidence -> review (sandbox advisor) -> browse paginated published listings -> open an acquisition -> sign the deal NDA -> view that deal's documents -> raise diligence questions -> submit an offer -> seller accepts -> advisor reviews diligence and closing agreement -> fund demo wallet -> fund deal escrow -> confirm transferred assets -> dual sign-off -> advisor releases simulated funds.

Seller: register -> submit identity, business and revenue evidence -> advisor reviews -> create and publish one or more business listings -> upload confidential listing documents -> review offers by deal -> accept one offer -> prepare asset transfer -> sign off -> see simulated seller wallet credited.

Advisor: review account verification cases, inspect active deals, move stages after their preconditions, check assets/sign-offs, approve simulated release. No external verification service and no real money.

## Domain isolation
Every document belongs to a listing and is accessed through an explicitly authorized deal. Every diligence finding, question, offer, escrow account and asset-transfer item belongs to a deal. All UX routes after starting an acquisition carry the actual deal ID. Global navigation shows deal selection, never automatically selects the first result. Sellers own listings through an organization membership, and buyers only see published listings.

## Persistence and concurrency
Use PostgreSQL/Prisma transactions for offers, stage changes, publication and simulated financial movements. Every simulated wallet top-up and escrow transfer accepts an idempotency key and writes the result in the same transaction as its ledger movements. Conditioned balance decrements prevent overspending under concurrent requests. Existing escrow ledger remains append-only. External side effects use the transactional outbox. A deal stage change keeps optimistic version checks; offers must be accepted through a single-winner database constraint.

## Verification and files
Personal: any ONE of NIN slip, BVN confirmation, driver's license, voter card. Seller additional requirements: CAC certificate, ownership proof, business address evidence; revenue: recent bank statement and profit/loss statement. Uploaded files are private, bound to the authenticated user/listing, MIME and size restricted, and given random storage keys. Evidence metadata is in PostgreSQL; object contents are stored outside static public assets. Demo approval is a separate advisor action, visibly labelled simulated; no real identity verification. Never upload real government IDs or bank statements to public previews or seed fixtures. For production, replace demo storage with encrypted private object storage, malware scanning and defined retention/erasure policies.

## Simulated money
Naira only. Display `Demo balance`; no provider calls, account numbers, payout promises or bank verification. Wallet top-up writes sandbox ledger records; escrow funding debits the buyer wallet and credits escrow, release credits the seller wallet. A committed escrow release may occur once only. Full real-world custody and KYC require regulated providers and operational controls not supplied by this proof product.

## Scale target
Seed at least 10 unrelated sellers/listings, optionally generate 100. Search/paginate marketplace (12/page) and select a deal for document, diligence, transfer and escrow pages. Add indexes for listing status/category/date, participant user/deal, deal listing, evidence case/category and wallet transactions. Exercise tests with 100 listings and multiple active deals for one buyer; verify no cross-listing document or escrow leakage.

## Rollout and validation
Migration additive. Run `npm ci`, Prisma generate and database push/migrate against a disposable database, seed, static UI tests, API unit/integration tests, production builds and a full buyer/seller/advisor smoke test. Do not run the destructive seed against a real shared or production database.

## Fresh installation without seeded accounts
After applying migrations to a new database, create the first advisor with the one-time first-party CLI, without invoking the destructive seed. Set `DEALOS_BOOTSTRAP_REVIEWER=true` only for the command, along with `DEALOS_REVIEWER_NAME` and `DEALOS_REVIEWER_EMAIL`. Supply `DEALOS_REVIEWER_PASSWORD` through a hidden shell prompt, not in a committed env file. Run `npm run auth:bootstrap-reviewer`, then unset the password and the bootstrap flag. The operation refuses to run when any advisor or admin already exists and never promotes an existing account.

Example:
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

This is an initial trust-root operation. Do not grant reviewer privileges through the normal buyer/seller registration API. Restrict production database access and rotate the initial password after setup.
