# Security Policy

## Security Philosophy

This project is security-first.

The wallet is designed as a self-custody system where users
control their own wallet keys.

Security issues involving wallet secrets or transaction integrity
are treated as high priority.

---

## Sensitive Information

Never include the following in issues, pull requests or logs:

- Seed phrases
- Private keys
- Authentication secrets
- API secrets
- Recovery phrases
- Wallet passwords

---

## Security-Sensitive Components

The following areas require additional security review:

- Cryptographic operations
- Wallet creation
- Wallet recovery
- Private-key handling
- Secure storage
- Transaction signing
- Transaction construction
- Network selection
- Browser extension permissions
- Authentication
- Session management

---

## Security Development Rules

1. Do not implement custom cryptography when an appropriate
   audited library exists.

2. Never log private keys or seed phrases.

3. Never send self-custody private keys to backend services.

4. Validate blockchain network and transaction information.

5. Fail closed when security-critical information is uncertain.

6. Keep exchange/custody functionality separated from the
   self-custody wallet.

---

## Security Review

Security-sensitive changes require explicit review before
being considered production-ready.

---

## Incident Handling

Security incidents should be documented and handled using the
incident-response procedure in:

`docs/INCIDENT_RESPONSE.md`
