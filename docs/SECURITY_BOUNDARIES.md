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
