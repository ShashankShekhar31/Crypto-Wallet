# ADR-001: Self-Custody First

## Status

Accepted

## Decision

The first 30 days will focus on building a self-custody wallet
foundation.

Exchange and custodial functionality will remain a separate
trust domain.

## Reason

Separating self-custody from exchange custody keeps the initial
security boundary smaller and avoids mixing user-controlled
wallet keys with future custodial infrastructure.

## Initial Scope

The wallet will initially support:

- Web
- iOS
- Android
- Desktop
- Browser Extension

The initial blockchain scope is:

- EVM
- Solana
- Bitcoin

## Deferred Scope

The following are explicitly deferred:

- Fiat rails
- Leveraged trading
- Institutional custody
- Broad chain coverage
- Public regulated exchange launch

## Consequence

The architecture must allow future exchange functionality to be
added without making the self-custody wallet dependent on
custodial key management.