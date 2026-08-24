# Security Services Mapping

## Purpose

This document maps production-oriented cloud security requirements to
free and local equivalents for the Crypto Wallet platform.

The project does not require paid cloud security services during the
30-day free-resource implementation.

The mappings below preserve the required security controls and
architectural boundaries without claiming equivalent managed-service
assurance.

---

## 1. CloudTrail — Audit Logging

### Production Requirement

CloudTrail represents centralized audit logging for infrastructure
and security-relevant activity.

### Free / Local Implementation

The free-resource implementation uses:

- Git history for infrastructure changes
- Docker/container logs for local services
- Application structured audit events
- Local log inspection during development
- CI logs for automated infrastructure validation

Security-sensitive application operations must generate appropriate
audit events.

Examples include:

- Wallet creation
- Wallet recovery
- Wallet unlock
- Transaction approval
- Transaction signing
- Session changes
- Security configuration changes

### Security Boundary

Audit data must never contain:

- Seed phrases
- Private keys
- Wallet secrets
- Authentication secrets

### Limitation

Local logs and CI logs do not provide the same centralized,
tamper-resistant, managed audit guarantees as a production cloud
audit service.

A production CloudTrail-based implementation remains a future
deployment capability.

---

## 2. GuardDuty — Threat Detection

### Production Requirement

GuardDuty represents managed detection of suspicious activity and
security threats.

### Free / Local Implementation

The free-resource implementation uses:

- Dependency auditing
- Secret scanning
- Static analysis
- Container scanning
- Application security logs
- Local infrastructure inspection
- CI security checks
- Explicit security validation rules

The existing CI quality gates remain mandatory.

### Detection Scope

The implementation should detect or prevent:

- Known vulnerable dependencies
- Accidentally committed secrets
- Unsafe infrastructure configuration
- Suspicious application behavior
- Invalid authentication activity
- Untrusted external responses
- Security boundary violations

### Limitation

Local and open-source detection does not provide the same managed
threat-intelligence coverage or continuous cloud telemetry as
GuardDuty.

GuardDuty remains a future production adapter.

---

## 3. Security Hub — Security Findings

### Production Requirement

Security Hub represents centralized aggregation and review of
security findings.

### Free / Local Implementation

Security findings are aggregated through:

- CI security checks
- Dependency audit results
- Secret scanning results
- Static analysis results
- Container scanning results
- Infrastructure validation
- Documented security reviews

Findings should be tracked by:

- Severity
- Affected component
- Description
- Mitigation
- Owner
- Status

### Security Review

Security findings must be reviewed before production deployment.

Critical security issues must block release where appropriate.

### Limitation

The free/local implementation does not provide the same centralized
managed security-service integration or compliance posture as
Security Hub.

A production Security Hub integration remains a future capability.

---

## 4. Free-Resource Security Principle

The free-resource implementation preserves the security architecture
without purchasing managed cloud security services.

No security service may introduce:

- Wallet seed storage
- Private-key storage
- Secrets committed to source control
- Secrets stored in infrastructure state
- Public database access
- Unnecessary privileged access

---

## 5. Production Migration Boundary

The architecture remains provider-neutral.

Future production deployments may add managed services such as:

- CloudTrail
- GuardDuty
- Security Hub

These services must integrate with the existing security boundaries
rather than changing the wallet security model.

The self-custody wallet must remain separate from infrastructure
security services.

---

## 6. Free-Resource Limitation

Free and local security tooling is suitable for this development and
architecture phase.

It must not be represented as equivalent to:

- Managed cloud security monitoring
- Managed threat detection
- Managed centralized security findings
- Production compliance infrastructure
- Enterprise security operations

Those capabilities remain future production requirements.
