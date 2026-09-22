# DealOS

DealOS is an independent acquisition workflow prototype built from publicly described marketplace requirements. It is not affiliated with Africa Acquisition.

The project demonstrates the engineering surface behind a two-sided acquisition marketplace: deal orchestration, NDA-gated data rooms, append-only audit history, multi-currency escrow state, due-diligence findings, KYC state, idempotent commands, and reliable asynchronous delivery.

## Stack

- Next.js 16 + React 19 + TypeScript
- NestJS 11 API
- PostgreSQL 16
- Prisma ORM
- Zod shared contracts
- Server-Sent Events for deal activity
- PostgreSQL outbox for reliable async side effects

## Why this architecture

This is intentionally a modular monolith. A marketplace with a few thousand weekly users benefits more from strong transactional boundaries, observability, and clean domain ownership than from premature microservices. The seams are explicit so payment processing, notifications, document storage, or diligence analysis can be extracted when operational load justifies it.

See `docs/ARCHITECTURE.md` for the full system design.

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Web: `http://localhost:3000`
API: `http://localhost:4000`

The demo ships with seeded buyer, seller, and advisor personas. The role switcher changes the active demo identity so authorization behavior can be inspected without adding an external identity provider to the proof project.

## Engineering highlights

- money stored as integer minor units, never floating point
- immutable ledger entries for escrow movement
- idempotency keys on payment and workflow commands
- optimistic version checks on deal transitions
- NDA access policy evaluated server side before data-room access
- append-only audit log for legally relevant actions
- outbox records committed in the same database transaction as domain changes
- SSE deal activity stream backed by the audit log
- explicit KYC and escrow state machines
- provider adapters instead of provider logic inside domain services
- seeded deterministic diligence engine so the demo works without an external AI key

## Product scope

The prototype focuses on the high-value workflow rather than rebuilding a full public marketplace:

1. deal pipeline from NDA through completion
2. NDA-gated data room and access logging
3. due-diligence findings and generated questions
4. multi-currency escrow funding, sign-off, and release
5. KYC status and verification evidence
6. deal notifications and audit timeline
