# Supported Blockchain Networks

## 1. EVM

Initial EVM architecture must support:

- Ethereum-compatible chains
- Chain ID validation
- RPC providers
- Native assets
- ERC-20 tokens

The exact production networks will be finalized before
mainnet deployment.

## 2. Solana

Initial support:

- SOL
- SPL tokens
- Solana addresses
- Solana transactions
- RPC providers
- Transaction confirmation

## 3. Bitcoin

Initial support:

- Bitcoin addresses
- UTXO discovery
- Fee estimation
- Transaction construction
- PSBT-based signing architecture
- Confirmation tracking

## Network Safety

Every transaction must validate:

- Network
- Chain
- Recipient
- Asset
- Amount
- Fee

The client must never blindly trust an RPC response.