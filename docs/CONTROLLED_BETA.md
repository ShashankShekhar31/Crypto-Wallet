# Controlled Beta Plan

## Purpose

This document defines the controlled free-resource beta boundary for the Crypto Wallet self-custody MVP.

The beta is limited to the documented self-custody foundation and must not be treated as a public production exchange launch.

## Resource Boundary

The beta must operate using free or local infrastructure within the documented project limits.

The project must preserve:

- PostgreSQL as the authoritative database.
- Redis/Valkey for ephemeral coordination and caching only.
- Durable event semantics using free/self-hosted event infrastructure.
- Provider-neutral blockchain adapters and failover boundaries.
- Secure local wallet key storage.
- No backend, database, CI, analytics, or log storage of seed phrases or private keys.

Free-resource limits must not be interpreted as equivalent to paid production availability, SLA, security, or operational guarantees.

## Supported Beta Surfaces

The controlled beta may validate:

- Web wallet.
- Mobile wallet.
- Desktop application.
- Browser extension.

Testing should be limited to the platforms that are operationally ready and practical to validate.

## Trusted Tester Boundary

Testing should begin with a small trusted tester group.

Testers should validate:

- Wallet creation.
- Wallet restore.
- Wallet lock and unlock.
- Receive address generation.
- Receive flow.
- Transaction construction.
- Transaction approval and signing.
- Send flow.
- Transaction tracking and confirmation state.
- Transaction history.
- Failure and recovery behavior.

Testers must not be instructed to expose seed phrases or private keys to project operators, backend services, logs, analytics, screenshots, or support channels.

## Data Collection

Beta validation should collect only operationally necessary information.

The validation record should cover:

- Crash or unexpected-error observations.
- API and application latency observations.
- Transaction failure observations.
- Transaction confirmation/tracking observations.
- Usability issues.
- Platform-specific failures.
- Recovery behavior after expected failure scenarios.

Sensitive wallet material must never be included in collected beta data.

## Security Validation

Before beta expansion, verify:

- Seed phrases are never logged.
- Private keys are never sent to the backend.
- Sensitive wallet material is not present in analytics.
- Sensitive wallet material is not present in crash reports.
- Sensitive wallet material is not present in CI artifacts.
- Extension permissions remain minimal.
- Extension host permissions remain minimal.
- Transaction approval remains explicit.
- Origin validation remains enforced.
- Production-only security controls remain documented where they are not yet implemented.

## Release Boundary

The beta must not introduce unnecessary architectural changes.

Changes required to fix security, correctness, reliability, or beta-blocking defects remain permitted.

Unnecessary feature expansion should be deferred to the post-30-day roadmap.

## Known Production Limitations

The current repository documents production limitations including:

- Production TLS termination is not represented in the local repository.
- Production HTTP security headers are not currently configured in the repository.
- Production CSP deployment configuration remains a future deployment concern.
- Production reverse-proxy and deployment security configuration remain future work.
- Local custody infrastructure is not equivalent to production KMS, CloudHSM, MPC, multisig, cold storage, or managed disaster recovery.
- Independent security review remains outside the current free-resource implementation.

These limitations must remain visible when evaluating beta readiness.

## Beta Acceptance Record

Before expanding the tester group, record:

| Check                        | Status             | Evidence |
| ---------------------------- | ------------------ | -------- |
| Web wallet flow              | Pending validation |          |
| Mobile wallet flow           | Pending validation |          |
| Desktop flow                 | Pending validation |          |
| Browser extension flow       | Pending validation |          |
| Transaction failure handling | Pending validation |          |
| Crash observations           | Pending validation |          |
| Latency observations         | Pending validation |          |
| Usability observations       | Pending validation |          |
| Secret/log review            | Pending validation |          |
| CI security gates            | Pending validation |          |

A `Pending validation` status must not be interpreted as a completed test.

## Definition of Beta Boundary

The controlled beta is considered ready only when the documented self-custody foundation can be validated within the free-resource constraints and the remaining production limitations are explicitly understood and accepted for the controlled testing scope.

This document does not represent authorization for a public production exchange launch.
