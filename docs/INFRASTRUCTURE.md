# Infrastructure Architecture

## Purpose

This document defines the provider-neutral infrastructure boundaries for the
Crypto Wallet platform.

The infrastructure model is designed to support:

- local development
- demo environments
- staging environments
- future production deployment

The infrastructure contract must remain independent from a specific cloud
provider.

The initial cloud direction is AWS, but AWS-specific resources must not become
the application architecture itself.

---

## Infrastructure Principles

The infrastructure follows these principles:

1. Provider-neutral architecture
2. Security-first defaults
3. Least privilege
4. Private services by default
5. No public database access
6. No wallet private keys in infrastructure state
7. No wallet seed material in infrastructure state
8. Secrets must not be committed to source control
9. Environment boundaries must be explicit
10. Local development should not require paid cloud resources

---

## Environment Model

The platform currently defines three infrastructure environments:

| Environment | Purpose | Deployment Tier | Paid Resources |
|---|---|---|---|
| development | Active local development | development | false |
| staging | Pre-production validation | pre-production | false |
| demo | Demonstration and integration testing | demo | false |

Each environment uses the shared OpenTofu environment contract:

```text
infra/opentofu/modules/environment-contract