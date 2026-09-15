# Initial Architecture

## Client Layer

The platform will eventually support:

- Web
- Mobile
- Desktop
- Browser Extension

## Shared Packages

Shared functionality will be organized into:

- ui
- wallet-core
- custody-core
- chain-core
- crypto
- storage
- config
- telemetry
- shared-types

## Blockchain Layer

The initial blockchain abstraction will support:

- EVM
- Solana
- Bitcoin

Chain-specific functionality will be implemented behind common
interfaces.

## Self-Custody Boundary

Private keys and seed material belong to the wallet security
boundary.

The backend must not become the holder of user wallet private
keys for normal self-custody wallet operations.

## Future Exchange Boundary

The future exchange/custody platform will be treated as a
separate trust domain.

It will eventually contain its own:

- API
- Ledger
- Custody
- Risk controls
- Compliance controls
- Key-management systems

The exchange architecture must not collapse the self-custody
wallet and custodial exchange into the same security boundary.

Custodial key-management functionality is implemented behind a dedicated custody-core boundary.

The custody boundary is provider-neutral and is intended to support future production key-management adapters such as AWS KMS, AWS CloudHSM, and MPC without coupling the self-custody wallet to custodial infrastructure.
