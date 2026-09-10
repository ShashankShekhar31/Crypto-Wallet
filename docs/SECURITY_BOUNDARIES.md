# Security Boundaries

```text
┌──────────────────────────────────────────────────────────┐
│                        USER                              │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                       CLIENT                             │
│                                                          │
│ Web / Mobile / Desktop / Extension                      │
└───────────────┬──────────────────────────┬───────────────┘
                │                          │
                │                          │
                ▼                          ▼
┌──────────────────────────┐     ┌────────────────────────┐
│ WALLET SECURITY          │     │ API                    │
│ BOUNDARY                 │     │                        │
│                          │     │ Auth                   │
│ Seed                     │     │ Application data       │
│ Private Keys             │     │ Transaction tracking   │
│ Signing                  │     │ RPC coordination       │
└────────────┬─────────────┘     └────────────┬───────────┘
             │                                │
             │                                ▼
             │                      ┌─────────────────────┐
             │                      │ BLOCKCHAIN GATEWAY  │
             │                      └──────────┬──────────┘
             │                                 │
             └────────────────┬────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │     BLOCKCHAIN      │
                    │                     │
                    │ EVM / Solana / BTC  │
                    └─────────────────────┘


                 SEPARATE TRUST DOMAIN

                    ┌──────────────────┐
                    │ EXCHANGE/CUSTODY │
                    │                  │
                    │ Ledger           │
                    │ Custody          │
                    │ Risk             │
                    │ Compliance       │
                    └──────────────────┘
```

## Hardware Wallet Boundary

Hardware wallets are treated as an external signing boundary within the wallet
security domain.

The software wallet communicates with hardware devices through a vendor-neutral
`HardwareTransport` and `HardwareWallet` interface. Hardware devices may expose
device information, public keys, addresses, and signatures, but private keys,
seed phrases, and mnemonic material are never exported through the hardware
wallet interface.

Transaction signing is separated from transaction review. Before signing, the
wallet can construct a review containing:

- chain
- recipient
- amount
- fee

The signing payload is kept separate from the transaction review so that
sensitive signing material is not exposed as part of the review object.

### Hardware Wallet Testing

The repository currently provides mock transport and mock hardware-wallet
implementations so that connection, disconnection, public-key retrieval,
transaction signing, and failure behavior can be tested without requiring a
physical device.

Real-device validation is intentionally deferred as optional future work.
Future hardware integration testing should validate:

- device discovery and connection
- device information retrieval
- public-key/address retrieval for supported derivation paths
- transaction review and user-confirmation flow
- signing through the device
- disconnect and reconnect behavior
- device rejection and transport failure handling
- vendor- and firmware-specific behavior

## Security Validation and Residual Risks

Security validation performed during the Day 20 hardening pass covers
dependency scanning, SAST, secret scanning, HTTP authentication boundaries,
client message validation, wallet-vault tamper resistance, and local container
image scanning.

### Validation Results

| Control               | Result | Evidence                                                               |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| Dependency audit      | PASS   | `pnpm audit` reports no known vulnerabilities                          |
| SAST                  | PASS   | Semgrep scan completed with 0 findings                                 |
| Secret scanning       | PASS   | Gitleaks scan completed with no leaks detected                         |
| Vault security tests  | PASS   | Secure-storage suite: 72 tests passed                                  |
| Authentication tests  | PASS   | Auth route: 8 tests passed                                             |
| Refresh/session tests | PASS   | Refresh route: 9 tests; session service: 5 tests                       |
| CORS boundary         | PASS*  | No permissive cross-origin response observed                           |
| CSRF boundary         | PASS*  | No cookie-based credential flow identified; JSON contract enforced     |
| Session fixation      | PASS   | Login creates a fresh session; refresh tokens rotate                   |
| Malicious deep links  | PASS   | External Bitcoin URLs use validated transaction IDs and fixed hostname |
| XSS sink review       | PASS*  | No obvious unsafe DOM HTML/script sinks identified                     |
| Container scanning    | OPEN   | PostgreSQL and MinIO images retain Trivy findings                      |

\* These results represent the current application design and local validation.
Production deployment configuration must preserve the same security boundary.

### Residual Risk Register

| Risk                                 | Severity | Current State                                                                                                                                                                                            | Mitigation                                                                                                                                                         | Owner           | Status     |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ---------- |
| PostgreSQL container vulnerabilities | High     | Trivy identified unresolved OS/package vulnerabilities in the local PostgreSQL Alpine image. The tested `17.11-bookworm` candidate produced a substantially higher vulnerability count and was rejected. | Select a supported PostgreSQL image/version with an acceptable vulnerability profile, rescan, and pin the validated image digest                                   | Platform/DevOps | Open       |
| MinIO container vulnerabilities      | Critical | Trivy identified unresolved OS and Go dependency vulnerabilities in the local MinIO image                                                                                                                | Select a supported/patched MinIO release or replace the local object-storage image, then rescan before production use                                              | Platform/DevOps | Open       |
| Production TLS enforcement           | High     | TLS termination is not represented in the repository; the API currently binds to `127.0.0.1`                                                                                                             | Enforce HTTPS at the production ingress/load-balancer/reverse-proxy boundary and document the trusted proxy boundary                                               | Platform/DevOps | Open       |
| Production HTTP security headers     | Medium   | No application/deployment security-header configuration is currently tracked                                                                                                                             | Configure security headers at the production web/edge layer, including HSTS, X-Content-Type-Options, Referrer-Policy, and appropriate framing/permissions policies | Platform/DevOps | Open       |
| Production CSP                       | Medium   | CSP is identified as a client security control but is not currently configured in the repository                                                                                                         | Deploy a restrictive CSP with the production web application and validate it against the Web/Mobile/Desktop/Extension architecture                                 | Web/Platform    | Open       |
| CORS/CSRF boundary regression        | Medium   | Current API tests reject unauthorized cross-origin preflight behavior and the authentication contract uses JSON request bodies rather than cookies                                                       | Preserve the no-wildcard-CORS policy and JSON/token authentication boundary; add regression coverage if browser credential handling changes                        | API/Security    | Monitoring |
| Deployment security configuration    | Medium   | No production reverse-proxy, TLS, or web-header configuration is currently tracked                                                                                                                       | Add deployment security configuration when the production hosting boundary is selected and validate it as part of release security checks                          | Platform/DevOps | Open       |

### Security Acceptance Criteria for Remaining Risks

The open risks above should be considered resolved only when:

1. PostgreSQL and MinIO container images produce an acceptable Trivy result after
   selecting supported patched versions.
2. Production traffic is served exclusively over HTTPS.
3. Production web responses include the approved security headers.
4. The production web application has a tested CSP appropriate for the wallet
   client.
5. Deployment configuration preserves the current CORS, CSRF, authentication,
   session-rotation, and client security boundaries.
