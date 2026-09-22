# Research and scope

## Public signals reviewed

The prototype is based on publicly described product and hiring requirements, not private company information.

Primary sources:

- https://www.africaacquisition.com/company/careers/senior-fullstack-engineer
- https://www.africaacquisition.com/company/careers
- https://www.africaacquisition.com/how-to-buy
- https://www.africaacquisition.com/how-to-sell
- https://www.africaacquisition.com/resources/escrow
- https://www.africaacquisition.com/resources/buyer-faq
- https://www.africaacquisition.com/resources/seller-faq
- https://www.africaacquisition.com/legal/privacy-policy
- https://www.africaacquisition.com/legal/terms-of-service

## Requirements inferred from those sources

The company describes a transaction platform where buyers and sellers move through NDA, diligence, LOI, SPA, escrow, asset transfer, and completion. The engineering role specifically emphasizes a real-time pipeline, NDA-protected data rooms, audit logging, multi-currency payment infrastructure, automated release controls, due-diligence assistance, KYC, notifications, tests, and secure authorization.

That creates five high-value engineering boundaries:

1. **Deal orchestration**: stage transitions must be ordered, concurrent-safe, and auditable.
2. **Confidential data access**: document access must depend on relationship and NDA state, not UI visibility.
3. **Financial correctness**: money movement needs idempotency, immutable accounting records, and explicit release preconditions.
4. **Verification and diligence**: KYC and diligence produce risk signals that affect transaction confidence without becoming the legal source of truth.
5. **Reliable side effects**: notifications and provider calls cannot share the same failure boundary as the core database transaction.

## Prototype boundary

### Implemented

- buyer, seller, and advisor personas
- active acquisition deal with versioned pipeline state
- signed NDA state and gated data room
- document-access audit records
- structured diligence findings and generated questions
- KYC case state
- escrow account, provider transaction record, and immutable ledger entries
- buyer and seller completion sign-off
- platform release confirmation
- idempotent funding and release commands
- transactional outbox
- audit-backed SSE activity stream
- responsive operations UI

### Represented as adapters, not faked

- Paystack
- Stripe Connect
- international wire settlement
- object storage signed URLs
- external identity and KYC providers
- production legal signature provider
- LLM enrichment

The prototype deliberately avoids pretending to custody real funds, verify real identity documents, or provide legal advice.

## Showcase narrative

The strongest walkthrough is:

1. open the seeded KoraMetrics transaction as a buyer
2. inspect diligence findings and NDA-gated documents
3. switch to advisor and advance the deal to SPA then escrow
4. switch to buyer and fund escrow with an idempotent command
5. complete buyer and seller sign-off using the role switcher
6. switch back to advisor, confirm release, and release funds
7. inspect the ledger, audit trail, and terminal deal state

This sequence demonstrates product thinking, backend correctness, authorization, concurrency, financial modeling, and UI execution in one coherent transaction.
