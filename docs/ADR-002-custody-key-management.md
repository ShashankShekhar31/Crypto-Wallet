# ADR-002: Custody Key Management and Wallet Tiers

## Status

Accepted

## Decision

Exchange and custodial signing will use a dedicated custody trust domain separate from normal self-custody wallet operations.

The custody domain will use a provider-neutral key-management interface so application code does not depend directly on a specific key-management technology.

The initial local implementation exists only for development and testing. It is not considered production-grade custody.

The custody architecture is:

    Custody Core
         |
         +-- KeyManagementProvider
         |      |
         |      +-- Local provider
         |      +-- AWS KMS adapter (future)
         |      +-- AWS CloudHSM adapter (future)
         |      +-- MPC provider adapter (future)
         |
         +-- Policy / Risk
         +-- Authorization
         +-- Signing
         +-- Broadcast
         +-- Monitoring

Private keys must be referenced through opaque key identifiers at the custody boundary rather than passed through application APIs as raw private-key material.

## Custody Tiers

### Hot

Hot wallets are operational wallets intended for frequent signing activity.

They provide the highest operational availability and therefore have the greatest exposure to online systems.

Hot-wallet operations should use strict policy controls, transaction limits, risk checks, monitoring, and authorization controls.

The local project implementation does not claim to provide production-grade hot-wallet security.

### Warm

Warm wallets are restricted operational wallets used for controlled signing activity.

They should have stronger authorization requirements than hot wallets, including multiple approvers where appropriate.

Warm-wallet operations should be used for larger or less frequent transfers where immediate online availability is not required.

### Cold

Cold wallets are highly restricted wallets intended for offline or ceremony-based operations.

Private key material should remain isolated from normal online application infrastructure.

Cold operations require explicit authorization and multiple-person operational controls.

The local development environment does not provide physical cold storage. The cold-wallet definition is an architectural and operational target for future production infrastructure.

## Signing Pipeline

Custody operations follow this logical pipeline:

    request
       |
       v
    policy / risk evaluation
       |
       v
    authorization
       |
       v
    key-management signing
       |
       v
    broadcast
       |
       v
    monitoring
       |
       v
    completed / failed

Policy and authorization rejection must prevent subsequent signing and broadcast operations.

Signing failures must not be treated as successful broadcasts.

Broadcast and monitoring remain separate stages because a signed transaction is not equivalent to a transaction being accepted or confirmed by a blockchain network.

Durable application state and events will be integrated with this pipeline through the existing PostgreSQL and event-driven architecture.

## Key-Management Providers

The custody core exposes a provider-neutral interface.

The initial local provider is intended only for deterministic local development and testing.

Future production adapters may integrate:

- AWS KMS
- AWS CloudHSM
- MPC-based key-management infrastructure

AWS KMS and CloudHSM are future production adapters and are not required for the current $0 local project.

Production adapters must keep private-key material inside their security boundary and expose only the operations required by the custody interface.

Application code must not become coupled to provider-specific APIs.

## Multisig and MPC Direction

The long-term custody architecture should support multiple authorization/signing models.

Multisig may be used where the underlying blockchain supports native multisignature controls.

MPC may be used where threshold signing and distributed key control provide stronger operational separation.

The custody interface should therefore remain independent of whether signing is implemented by a single protected key, multisig coordination, an HSM, or MPC.

MPC is a future architectural direction and is not implemented in the current local project.

## Key Ceremony

Production custody keys require a documented key ceremony.

A future ceremony should include:

1. Defined participants and roles.
2. Separation of duties.
3. Controlled generation of key material.
4. Verification of generated public identifiers.
5. Independent recording and verification of key metadata.
6. Secure initialization of the production key-management system.
7. Backup creation according to the approved recovery procedure.
8. Evidence and audit records for the ceremony.
9. Verification that no unauthorized copy of private-key material was created.

No production key ceremony is performed by the current local implementation.

## Key Rotation

Production keys must have a defined rotation policy based on:

- key age;
- security events;
- suspected compromise;
- operational requirements;
- provider or infrastructure changes.

Rotation must preserve an auditable relationship between old and new key identifiers.

Existing funds and transaction history must remain attributable to the correct historical key.

Rotation must not silently invalidate existing records or destroy recovery capability.

## Backup and Recovery

Production key-management systems require protected backups and documented recovery procedures.

Backups must be:

- encrypted;
- access controlled;
- independently recoverable;
- auditable;
- protected against unauthorized modification or deletion.

Recovery procedures must define authorized personnel, required approvals, verification steps, and post-recovery validation.

The local provider does not represent a production backup or recovery system.

## Disaster Recovery

Custody disaster recovery must preserve both security and availability.

Future production DR procedures should define:

- recovery objectives;
- independent infrastructure or recovery locations;
- key-management recovery procedures;
- authorization requirements;
- database and ledger recovery;
- event-stream recovery;
- transaction reconciliation;
- post-recovery verification.

Recovery must not bypass custody authorization controls.

The existing PostgreSQL database and durable event architecture remain the source of application state and event recovery mechanisms, while key-management recovery remains a separate security concern.

## Security Boundaries

Normal self-custody wallet operations must not depend on custodial key management.

The exchange/custody domain is a separate trust domain and may contain:

- custody;
- key-management systems;
- risk controls;
- compliance controls;
- exchange APIs;
- ledger integration.

Raw private keys must not be stored in ordinary application databases, logs, events, or request payloads.

The local implementation intentionally does not claim KMS, HSM, MPC, offline-storage, or managed high-availability guarantees.

## Consequences

### Positive

- Keeps self-custody and custodial security boundaries separate.
- Prevents application code from depending on a specific key-management vendor.
- Provides a clear path from local development to KMS, CloudHSM, or MPC.
- Separates policy, authorization, signing, broadcast, and monitoring concerns.
- Establishes explicit hot, warm, and cold operational tiers.
- Provides a foundation for future multisig, MPC, rotation, backup, and disaster recovery procedures.

### Negative

- Production custody requires substantially more infrastructure and operational controls than the current local implementation.
- Provider-specific security guarantees cannot be represented by the local provider.
- Multisig, MPC, KMS, CloudHSM, offline cold storage, and production key ceremonies remain future work.

## Scope

This ADR defines the architecture and security boundaries for custody key management.

It does not implement production KMS, CloudHSM, MPC, multisig, physical cold storage, or managed disaster recovery.

Those capabilities are future production decisions.
