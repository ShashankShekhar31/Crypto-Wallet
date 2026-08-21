# Incident Response Playbook

## Purpose

This document defines the initial response process for security
incidents affecting the wallet platform.

---

# Incident Severity

## Critical

Examples:

- Private-key exposure
- Seed phrase exposure
- Unauthorized transaction signing
- Major wallet compromise

## High

Examples:

- Authentication compromise
- Significant transaction manipulation
- Malicious production deployment
- Major supply-chain compromise

## Medium

Examples:

- Security control bypass
- Suspicious access
- Limited data exposure

## Low

Examples:

- Security configuration weakness
- Non-exploitable security issue

---

# Response Process

## 1. Detect

Identify the incident and preserve relevant evidence.

Do not modify or destroy logs unnecessarily.

---

## 2. Contain

Immediately limit the affected component.

Examples:

- Disable affected service
- Revoke affected credentials
- Block malicious requests
- Disable affected feature

---

## 3. Assess

Determine:

- What happened?
- Which systems were affected?
- Which users were affected?
- Was wallet secret material exposed?
- Was transaction integrity affected?

---

## 4. Eradicate

Remove the underlying cause.

Examples:

- Remove malicious dependency
- Fix vulnerable code
- Rotate compromised credentials
- Revoke unauthorized access

---

## 5. Recover

Restore affected services safely.

Verify security controls before returning the service to normal
operation.

---

## 6. Review

After the incident:

- Document root cause
- Document impact
- Document timeline
- Document remediation
- Create preventive actions

---

# Critical Wallet Incident

If seed phrases or private keys are suspected to be exposed:

1. Stop the affected operation.
2. Preserve evidence.
3. Determine affected wallets.
4. Determine whether unauthorized signing occurred.
5. Assess user impact.
6. Execute the approved recovery procedure.
7. Document the incident.

Do not place secret material into incident reports or logs.