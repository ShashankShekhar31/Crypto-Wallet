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

## 1. CloudTrail � Audit Logging

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

## 2. GuardDuty � Threat Detection

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

## 3. Security Hub � Security Findings

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

## 7. Identity and Device Security

### Production Requirement

The identity boundary must provide secure authentication,
session management, device binding, recovery controls, and
authentication-risk detection without exposing wallet private keys
or self-custody wallet secrets.

### Free / Local Implementation

The current implementation provides:

- Password-based authentication
- Password failure tracking and credential lockout
- Session creation with refresh tokens
- Refresh-token hashing
- Session expiration and idle expiration
- Session revocation and logout
- Device-bound authentication
- Device revocation checks
- Suspicious-login detection
- Authentication rate limiting
- Passkey/WebAuthn-ready authentication
- TOTP-based authentication fallback
- Recovery-code controls
- Structured authentication security events

### Passkey / WebAuthn Boundary

Passkey authentication is implemented behind a dedicated identity
service boundary.

Passkey credentials contain:

- Credential identifiers
- Public keys
- Sign counters
- Backup state
- Creation timestamps
- Last-used timestamps
- Revocation state

Passkey private authentication material must never be stored by the
server.

Passkey ceremonies use short-lived challenges stored in the cache
layer.

Registration and authentication ceremonies are explicitly separated.

Authentication ceremonies require:

- A valid non-expired challenge
- The correct ceremony type
- A valid identity account
- A valid passkey credential
- Successful cryptographic verification
- Sign-counter validation where applicable

Authentication ceremonies are single-use and must not be accepted
after the challenge has been consumed.

### Device Security

Authentication sessions are bound to registered devices.

Authentication must reject:

- Unknown devices
- Devices belonging to another user
- Revoked devices

Suspicious authentication activity is recorded through structured
authentication events.

Examples include:

- First login from a new device
- Invalid authentication attempts
- Invalid device attempts
- Suspicious login detection
- Password credential lockout
- Session security changes

### Session Security

Sessions use server-side records and hashed refresh-token material.

Security controls include:

- Refresh-token rotation
- Session expiration
- Idle session expiration
- Session revocation
- Device/session association
- Authentication event recording

Raw refresh tokens must not be persisted as server-side credential
material.

### Recovery and MFA

TOTP and recovery controls provide additional authentication paths
without coupling authentication credentials to wallet private keys.

Recovery mechanisms must not expose:

- Seed phrases
- Private keys
- Wallet secrets

Recovery and authentication secrets remain within the identity
security boundary.

### Wallet Security Boundary

Identity authentication is completely separate from wallet key
material.

Authentication credentials, sessions, passkeys, TOTP secrets, and
recovery mechanisms must never become a storage mechanism for:

- Wallet seed phrases
- Private keys
- Wallet signing secrets

The self-custody wallet security model remains independent from the
identity authentication boundary.

### Limitation

The free/local implementation provides the application-level
security controls required for this architecture phase.

It does not provide the managed assurance, hardware-backed key
protection, centralized identity operations, or enterprise security
monitoring that may be required in a production deployment.

Production identity infrastructure may introduce additional managed
security capabilities without changing the wallet security boundary.