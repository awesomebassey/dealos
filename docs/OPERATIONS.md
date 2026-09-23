# Production operations

## Service level targets

A reasonable first production target for the transaction application:

- read API availability: 99.95%
- mutation API availability: 99.9%
- p95 dashboard read latency: under 300 ms excluding client network
- p95 mutation latency: under 700 ms excluding third-party payment latency
- outbox delivery lag: under 30 seconds in normal operation
- payment webhook acknowledgement: under 2 seconds after signature verification
- zero duplicate financial commands accepted for the same idempotency key

## Deployment topology

### Web

- Next.js deployed behind CDN
- horizontal scaling for dynamic routes
- immutable static assets cached aggressively

For `output: "standalone"` releases, Next.js does not copy its generated
browser assets into the standalone folder. Include `apps/web/.next/static`
as `.next/static` alongside the deployed `server.js`, and include
`apps/web/public` as `public` when it exists. Otherwise HTML renders but
registration, dialogs, form submissions and all other hydrated interactions
can remain non-functional. CI tests a served JavaScript bundle and runs
Chromium against the production standalone server.

### API

- two or more NestJS replicas behind a load balancer
- stateless process model
- graceful shutdown and health checks
- separate worker deployment once outbox throughput warrants it

### Database

- managed PostgreSQL with automated backups and point-in-time recovery
- PgBouncer or provider-native connection pooling
- multi-AZ primary for production
- read replica only for non-critical analytics and read-heavy reporting

## Database practices

- schema migrations run before application rollout using an expand-and-contract strategy
- destructive column changes separated from code deploys
- money and legal workflow tables protected from ad hoc mutation
- append-heavy audit records indexed by deal and time
- slow query logging and query plan review for endpoints above latency budget

## Backups and recovery

- point-in-time recovery enabled
- daily backup verification
- quarterly restore exercise into an isolated environment
- document storage versioning enabled
- escrow provider references retained independently of application status

Target recovery posture:

- RPO: 5 minutes or better
- RTO: 60 minutes for the transaction API

## Observability

### Logs

Structured fields:

- requestId
- correlationId
- actorId
- dealId
- route
- statusCode
- durationMs
- provider
- providerEventId

Sensitive document contents, credentials, raw KYC documents, and payment data must never be logged.

### Metrics

- request rate, error rate, latency
- database pool saturation
- deal transition conflict rate
- authorization denials
- data-room opens and denied attempts
- escrow funding success/failure
- release attempts and blockers
- webhook duplicates
- outbox pending count and oldest event age
- provider latency and availability

### Alerts

Page immediately for:

- payment webhook signature failures above baseline
- release command errors
- ledger imbalance invariant failure
- database unavailable
- outbox lag above five minutes

Ticket rather than page for:

- isolated notification failure
- increased document access denials
- individual KYC provider timeout

## Security operations

- production credentials in a secrets manager
- least-privilege database roles
- dependency and container scanning in CI
- rate limiting at edge and API
- WAF rules for common attacks
- CSP and secure cookie policy
- routine access review for staff advisor/admin roles
- immutable security audit retention consistent with legal requirements

## Capacity model

At 100,000 active users, the dominant load is still likely read-heavy listing/dashboard traffic rather than simultaneous financial mutations. Keep the critical transaction path on the primary database while scaling less sensitive reads independently.

Assume 10% daily active usage and short peaks around listing alerts. Design API replicas and pool limits from measured concurrency rather than total registered users. A few thousand concurrent browser sessions do not imply a few thousand simultaneous database queries when CDN caching, request coalescing, and short-lived caches are used properly.

## Incident examples to rehearse

1. Stripe callback accepted but application response times out.
   - replay is safe because provider event ID is unique.
2. Buyer double-clicks fund while the first request is in flight.
   - same idempotency key returns original result; different keys cannot fund a non-created escrow.
3. API crashes after deal stage commit but before notification.
   - outbox record survives and worker retries.
4. Two advisors advance the same deal.
   - one optimistic version update wins, the other receives 409.
5. Data-room URL is forwarded externally.
   - production URL expires quickly and authorization is rechecked before issuance.
6. Payment provider is unavailable.
   - local deal state does not falsely become funded; command remains retryable.
