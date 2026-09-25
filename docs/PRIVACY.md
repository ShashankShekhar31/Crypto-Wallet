# Privacy Disclosure

## Purpose

This document describes the current data-handling behavior of the Crypto
Wallet project.

The project is currently intended for local development, testing, and
controlled demonstration. It is not a production consumer service.

---

## Wallet Secrets

The wallet must not send seed phrases, mnemonics, private keys, or other
signing material to backend services.

Wallet secret material remains within the wallet security boundary.

Secret material must not be placed into:

- Logs
- Analytics
- Telemetry
- Incident reports
- Screenshots
- Support tickets

---

## Analytics and Tracking

The current application does not intentionally implement:

- Advertising tracking
- Behavioral analytics
- Third-party tracking pixels
- Telemetry collection for wallet secrets
- Sale of user data

No wallet seed phrase or private-key material is intended to be collected
through analytics or tracking systems.

---

## Browser Extension Permissions

The current browser extension declares no optional browser permissions:

- `permissions`: empty
- `host_permissions`: empty

The development content script is restricted to localhost origins.

Production browser-extension permissions and host access must be reviewed
again before any public release.

---

## Network Communication

Blockchain and application network communication may occur as required by
wallet functionality.

Network providers and backend services must never receive self-custody
private keys or seed phrases.

Provider-specific data handling must be reviewed before production use.

---

## Local Storage

Local wallet state may be stored using the project's secure-storage
mechanisms.

Sensitive wallet material must remain protected by the wallet security
boundary.

---

## Production Limitation

This disclosure describes the current development architecture.

Before production or public distribution, the project must define and review:

- Production privacy policy
- Data retention requirements
- Data deletion procedures
- Third-party service disclosures
- Blockchain/RPC provider disclosures
- App-store privacy declarations
- Browser-extension store privacy declarations
- Production analytics and telemetry policy, if introduced

---

## Security Boundary

The project follows a self-custody-first architecture.

Backend services must not require possession of self-custody private keys
for normal wallet operation.
