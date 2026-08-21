# MVP Features

## Wallet

### Create Wallet

User can create a new self-custody wallet.

### Import Wallet

User can restore an existing wallet.

### Wallet Balance

User can view balances for supported networks.

### Receive

User can:

- View wallet address
- Copy address
- Display QR code
- Select network

### Send

User can:

- Enter recipient
- Select asset
- Enter amount
- Review network
- Review fee
- Confirm transaction

### Transaction History

User can view:

- Transaction
- Asset
- Amount
- Network
- Status
- Timestamp

### Network Switching

User can explicitly switch between supported networks.

## MVP Security Requirements

- Private keys never sent to backend
- Seed phrases never logged
- Sensitive values never placed in analytics
- Network must be explicit
- Transaction confirmation must be explicit
- Wallet lock/unlock state must be enforced
