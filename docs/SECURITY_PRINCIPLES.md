# Security Principles

## 1. Least Privilege

Every component receives only the permissions required to perform
its function.

No service should receive unnecessary access to wallet or
application data.

---

## 2. Zero Trust

Services must not automatically trust another service simply
because it operates inside the same infrastructure.

Requests must be authenticated and authorized.

---

## 3. Secure Defaults

The safest configuration should be the default configuration.

Examples:

- Disabled access by default
- Minimal permissions
- Explicit transaction approval
- Secure storage enabled by default

---

## 4. Fail Closed

When the system cannot establish that an operation is safe, the
operation should fail rather than continue with uncertain state.

Examples:

- Unknown network
- Invalid recipient
- Unexpected transaction data
- Untrusted RPC response

---

## 5. Audit Sensitive Operations

Security-sensitive operations must generate appropriate audit
events.

Examples:

- Wallet creation
- Wallet recovery
- Wallet unlock
- Transaction approval
- Transaction signing
- Session changes
- Security configuration changes

Audit data must never contain private keys or seed phrases.

---

## 6. Secrets Are Not Application Data

Seed phrases and private keys must not be treated like ordinary
application data.

They require a dedicated security boundary.

---

## 7. Explicit User Intent

Irreversible operations require explicit user confirmation.

The user must be able to understand what they are approving.

---

## 8. Defense in Depth

No single security mechanism should be considered sufficient.

Security should exist across:

- Client
- Storage
- Authentication
- Authorization
- Network
- Backend
- Blockchain interaction
- Monitoring