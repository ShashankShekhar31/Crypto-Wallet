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

| Environment | Purpose                               | Deployment Tier | Paid Resources |
| ----------- | ------------------------------------- | --------------- | -------------- |
| development | Active local development              | development     | false          |
| staging     | Pre-production validation             | pre-production  | false          |
| demo        | Demonstration and integration testing | demo            | false          |

Each environment uses the shared OpenTofu environment contract:

```text
infra/opentofu/modules/environment-contract
---

## Local Object Storage

Local development uses MinIO as the provider-neutral object-storage implementation.

The local object-storage service is defined in:

infra/local/docker-compose.yml

### Local Object Storage Configuration

- Service: MinIO
- API endpoint: http://localhost:9000
- Console endpoint: http://localhost:9001
- Persistent volume: local_minio_data
- Container: crypto-wallet-minio

The object-storage data is persisted through the named Docker volume and is independent of the lifecycle of the MinIO container.

### Persistence Verification

The local object-storage foundation has been verified through:

1. MinIO readiness check.
2. Container restart.
3. Complete Compose container recreation.
4. Creation of a test bucket.
5. Verification that the bucket survived container recreation.
6. Removal of the test bucket after verification.

No production wallet secrets, seed material, or private keys are stored in this local object-storage test.

---

## Network and Access Boundaries

The free-resource implementation does not provision paid cloud
networking or compute resources.

Production deployments must preserve the following logical
infrastructure boundaries.

### VPC Boundary

A production deployment should isolate platform infrastructure inside
a private network boundary.

The VPC concept represents the top-level network isolation boundary.

Publicly reachable components must be limited to explicitly required
edge services such as:

- DNS
- CDN
- WAF
- Public API ingress

Internal application and data services should not be directly exposed
to the public internet.

### Public and Private Subnets

The production network model separates:

- Public edge services
- Private application services
- Private data services

Databases, caches, internal services and security-sensitive
components must remain private.

The local Docker implementation does not reproduce cloud subnet
isolation. Docker networks provide the local development boundary.

### Security Groups

Production security groups must follow least privilege.

Inbound access should be explicitly allowed only when required.

Examples:

- Public HTTPS -> API ingress
- API -> internal application services
- Application -> database
- Application -> cache
- Application -> object storage

Unnecessary inbound access must remain disabled.

Database access must never be publicly exposed.

### IAM Boundary

Production infrastructure must use least-privilege identity and
access policies.

Services should receive only the permissions required for their
specific function.

Examples:

- Application service -> required database access
- Application service -> required object-storage access
- CI -> only required deployment permissions
- Operators -> explicitly authorized operational permissions

No service should receive unrestricted infrastructure privileges by
default.

### Wallet Security Boundary

Infrastructure access controls must never become a substitute for
wallet-key security.

The infrastructure layer must never store:

- Wallet seed phrases
- Wallet private keys
- User wallet signing secrets

Self-custody wallet secrets remain inside the wallet security
boundary defined by the platform architecture.

### Local Development Mapping

The local implementation maps these concepts as follows:

| Production Concept | Free / Local Equivalent |
| --- | --- |
| VPC | Docker network boundary |
| Private subnet | Non-public Docker service network |
| Security group | Explicit container ports and network rules |
| IAM | Service-level credentials and least-privilege configuration |
| Private database | Local database bound to internal services |
| Object storage | MinIO on local Docker network |
| Cloud networking | Docker Compose networking |

### Production Limitation

The local implementation provides architectural boundaries for
development and testing but does not provide the same isolation,
availability, policy enforcement or managed security guarantees as
production cloud networking.

Production cloud networking remains a future deployment concern.
```
