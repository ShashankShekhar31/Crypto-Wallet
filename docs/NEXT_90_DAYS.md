# Next 90-Day Roadmap

## Purpose

This roadmap defines post-30-day development priorities for the Crypto Wallet self-custody foundation.

The 30-day free-resource implementation remains the baseline. Future capabilities must not weaken the existing security boundaries.

## Phase 1 Stabilization and Beta Feedback

### Objectives

- Review controlled-beta findings.
- Fix security and correctness issues.
- Fix transaction lifecycle failures.
- Improve reliability and error handling.
- Improve observability based on real beta behavior.
- Improve usability without changing core trust boundaries.
- Maintain the existing CI quality gates.

### Validation Areas

- Wallet creation and restore.
- Wallet lock and unlock.
- Receive flows.
- Send flows.
- Transaction tracking.
- RPC failure handling.
- Duplicate request handling.
- Delayed confirmation handling.
- Reorganization handling.
- Session and device recovery.

## Phase 2 Additional Blockchain and dApp Capabilities

Potential future work:

- Additional blockchain networks.
- Expanded chain adapter capabilities.
- dApp connection support.
- Wallet connection permissions.
- Origin-aware transaction approval.
- Stronger provider failover.
- Additional blockchain transaction lifecycle handling.

All new integrations must preserve explicit user approval and existing security boundaries.

## Phase 3 Wallet and User Experience

Potential future work:

- Improved portfolio presentation.
- Token and asset discovery.
- Transaction history improvements.
- Address book capabilities.
- Improved transaction simulation and review.
- Improved mobile experience.
- Improved desktop experience.
- Improved browser-extension experience.

Sensitive wallet material must remain client-side.

## Phase 4 Swaps and Transaction Infrastructure

Potential future work:

- Swap architecture.
- Quote aggregation.
- Slippage and fee controls.
- Transaction simulation.
- Provider routing.
- Failure recovery.
- Transaction monitoring improvements.

Swap functionality must remain separate from signing authority and must not require backend custody of self-custody keys.

## Phase 5 Custody and Exchange Architecture

Custody and exchange capabilities are future trust domains and must not be introduced into the self-custody wallet boundary without deliberate architectural and compliance decisions.

Potential future areas include:

- Custody architecture.
- Ledger services.
- Exchange services.
- Institutional workflows.
- Fiat integration.
- Compliance systems.
- Managed key infrastructure.
- KMS/CloudHSM integration.
- MPC.
- Multisig.
- Protected cold storage.
- Disaster recovery infrastructure.

These capabilities require substantially stronger operational, security, legal, and compliance controls than the current free-resource implementation.

## Architecture Constraints

The following constraints remain in force:

- PostgreSQL remains the authoritative ledger/database where applicable.
- Redis/Valkey remains ephemeral.
- Durable event semantics must be preserved.
- Blockchain providers remain behind provider abstractions.
- Seed phrases and private keys must never be stored in backend services, databases, CI variables, analytics, or logs.
- Self-custody signing authority remains client-side.
- Security boundaries must remain explicit.
- Least privilege remains mandatory.
- Production cloud capabilities must not be assumed to exist merely because they are planned for the future.

## Release Discipline

Future development should prioritize:

1. Security.
2. Correctness.
3. Reliability.
4. Observability.
5. User experience.
6. New capabilities.

Unnecessary architectural changes should remain frozen while the controlled beta is being evaluated.

## 90-Day Outcome

The intended outcome is a more thoroughly validated self-custody wallet foundation with improved reliability, additional wallet capabilities, expanded chain/dApp support where justified, and clearly separated future custody/exchange architecture.

This roadmap does not represent a commitment to deploy regulated exchange or custody services without the required infrastructure, security review, legal, compliance, and operational controls.
