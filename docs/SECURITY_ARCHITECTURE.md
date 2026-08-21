# Security Architecture

## Security Objective

The wallet must protect user-controlled wallet secrets and prevent
unauthorized transaction signing.

---

# Trust Boundaries

## Boundary 1 — User / Client

The user interacts with:

- Web
- Mobile
- Desktop
- Browser Extension

The client is considered an untrusted execution environment
relative to the backend.

---

# Boundary 2 — Wallet Security Boundary

This boundary contains sensitive wallet material.

Examples:

- Seed phrase
- Private keys
- Signing operations

Private wallet secrets must not cross this boundary unnecessarily.

---

# Boundary 3 — Backend/API

The backend handles application functionality such as:

- Authentication
- Account metadata
- Portfolio information
- Transaction tracking
- Blockchain gateway functionality

The backend must not require self-custody private keys for normal
wallet operations.

---

# Boundary 4 — Blockchain Gateway

Blockchain providers and RPC endpoints are external dependencies.

Their responses must be treated as untrusted input.

The application must validate critical blockchain information.

---

# Boundary 5 — Analytics

Analytics must not receive:

- Seed phrases
- Private keys
- Sensitive authentication secrets
- Sensitive transaction-signing material

---

# Boundary 6 — Exchange/Custody

Exchange and custody functionality is a separate trust domain.

It must not share the self-custody wallet's private-key security
model.

---

# Data Flow

User
→ Client
→ Wallet Security Boundary
→ Signing
→ Blockchain Gateway
→ Blockchain

Application metadata may flow:

Client
→ API
→ Application services
→ Database

Sensitive wallet secrets must not be sent through the normal API
path.
