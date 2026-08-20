# Product Scope

## Phase 1 — Self-Custody Wallet

The first 30 days focus on building a self-custody wallet.

The wallet allows users to control their own private keys.

### Included

- Wallet creation
- Wallet recovery/import
- Secure local wallet storage
- Portfolio/balance display
- Receive
- Send
- Transaction history
- Network selection
- EVM support
- Solana support
- Bitcoin support
- Multi-platform client foundation

## Separate Trust Domain

Exchange and custodial functionality will remain a separate
security and regulatory domain.

The wallet application must not directly become the custody
system for an exchange.

## Architectural Boundary

Self-custody wallet:

Client → wallet-core → blockchain providers

Exchange:

Client → exchange API → custody/ledger/risk systems

These domains must remain logically and operationally separated.