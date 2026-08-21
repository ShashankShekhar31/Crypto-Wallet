# Product Scope

## In Scope

### Wallet

- Create wallet
- Import wallet
- Wallet recovery
- View balances
- Receive assets
- Send assets
- Transaction history
- Network switching

### Platforms

- Web
- iOS
- Android
- Desktop
- Browser Extension

### Networks

- EVM
- Solana
- Bitcoin

## Separate Trust Domain

The exchange/custody system is outside the self-custody wallet
security domain.

Future exchange functionality may include:

- Trading
- Custody
- Internal ledger
- Deposits
- Withdrawals
- Compliance
- Risk management

These are not part of the first 30-day wallet implementation.

## Scope Principle

When a feature creates significant additional security,
regulatory or operational complexity without being necessary
for the wallet MVP, it should be deferred.
