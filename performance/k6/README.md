# Performance Tests

k6-based performance checks for the Crypto Wallet API.

## Requirements

- k6 installed separately on the local development machine.
- Crypto Wallet API running locally.
- A dedicated performance identity for authenticated workloads.
- PostgreSQL, Valkey, and required local infrastructure running for infrastructure benchmarks.

## Base URL

Default:

```text
http://localhost:3000
```

## SLOs

The performance checks use the following local development SLO targets:

| Flow             | Availability target                | Latency target                       |
| ---------------- | ---------------------------------- | ------------------------------------ |
| Health endpoint  | >= 99% successful requests         | p95 < 500 ms                         |
| Auth login       | >= 95% successful requests         | p95 < 1000 ms                        |
| Auth refresh     | >= 99% successful requests         | p95 < 500 ms                         |
| Auth logout      | >= 99% successful requests         | p95 < 500 ms                         |
| Bitcoin RPC read | >= 99% successful requests         | p95 < 1000 ms                        |
| Event processing | 100% of benchmark events processed | Track p50/p95/p99 processing latency |

These are local performance-test targets, not production availability commitments.

## Benchmark Coverage

Current performance coverage includes:

- Authentication login, refresh-token rotation, and logout.
- Health endpoint scalability.
- Horizontal API-instance testing.
- Bitcoin/Esplora RPC read latency.
- PostgreSQL read/query-plan checks.
- Valkey cache throughput.
- Kafka → consumer inbox → Temporal event-processing latency.
- Event-processing retry/backlog verification.

Portfolio, asset-query, and transaction API load tests are pending until corresponding API read endpoints are available.
