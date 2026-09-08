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
