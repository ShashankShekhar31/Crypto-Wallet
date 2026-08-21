# Threat Matrix

| Threat                   | Asset                | Impact   | Primary Boundary   | Mitigation                                          |
| ------------------------ | -------------------- | -------- | ------------------ | --------------------------------------------------- |
| Seed phrase theft        | Seed                 | Critical | Wallet security    | Secure storage, no logging, no backend transmission |
| Malicious extension      | Wallet/session       | High     | Client             | Isolation, minimal permissions, explicit approval   |
| XSS                      | Client state         | High     | Client             | CSP, validation, safe rendering                     |
| Supply-chain compromise  | Application          | Critical | Build/dependencies | Dependency review and scanning                      |
| RPC manipulation         | Transaction state    | High     | Blockchain gateway | Validation, multiple providers, consistency checks  |
| Phishing                 | User/wallet          | Critical | Client/user        | Clear warnings and explicit confirmation            |
| MEV                      | Transaction          | Variable | Blockchain         | Chain-specific transaction strategy                 |
| Replay                   | Transaction          | High     | Chain boundary     | Network/chain validation                            |
| Transaction substitution | Transaction intent   | Critical | Signing boundary   | Review exact transaction before signing             |
| Insider abuse            | Application/security | High     | Backend            | Least privilege, audit, separation of duties        |
