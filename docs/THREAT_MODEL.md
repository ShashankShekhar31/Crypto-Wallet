# Threat Model

## Purpose

This document defines the initial security threat model for the
self-custody cryptocurrency wallet.

The threat model focuses on protecting:

- Seed phrases
- Private keys
- Transaction integrity
- User accounts
- Wallet operations
- Client integrity
- Blockchain interactions

---

# Assets

## 1. Seed Phrase

The seed phrase is one of the highest-value secrets in the system.

Compromise can allow an attacker to recover wallet accounts and
control associated assets.

## 2. Private Keys

Private keys authorize blockchain transactions.

Private keys must remain inside the wallet security boundary.

## 3. Wallet State

Wallet state includes:

- Accounts
- Addresses
- Network configuration
- Asset information
- Transaction information

## 4. Authentication Sessions

Sessions allow access to application functionality and must not
be treated as equivalent to wallet private keys.

## 5. Transaction Intent

Transaction intent includes:

- Network
- Recipient
- Asset
- Amount
- Fee

Changing transaction intent can cause irreversible loss.

---

# Threats

## Seed Phrase Theft

### Threat

An attacker obtains the user's seed phrase.

### Potential Impact

Complete compromise of the associated wallet.

### Primary Protection

- Never log seed phrases
- Never send seed phrases to backend services
- Secure local storage
- Explicit security boundaries
- Secure wallet creation and recovery flows

---

## Malicious Browser Extensions

### Threat

A malicious extension attempts to access wallet information,
intercept requests or manipulate user interactions.

### Potential Impact

- Credential theft
- Transaction manipulation
- Phishing
- User deception

### Primary Protection

- Strict extension permissions
- Extension isolation
- Explicit transaction approval
- Origin validation
- Minimal permissions

---

## XSS

### Threat

Injected JavaScript executes in the wallet client.

### Potential Impact

An attacker may manipulate the user interface or attempt to
access sensitive application state.

### Primary Protection

- Strict content security policy
- Input validation
- Output encoding
- Avoid unsafe HTML rendering
- Minimize sensitive data exposure to browser contexts

---

## Supply-Chain Compromise

### Threat

A compromised dependency introduces malicious behavior.

### Potential Impact

Potential compromise of application or wallet operations.

### Primary Protection

- Dependency review
- Lockfile validation
- Dependency scanning
- Minimize dependencies
- Review security-sensitive libraries

---

## RPC Manipulation

### Threat

A malicious or compromised RPC provider returns incorrect
blockchain information.

### Potential Impact

- Incorrect balances
- Incorrect transaction information
- Wrong network information
- Transaction manipulation

### Primary Protection

- Chain/network validation
- Provider abstraction
- Multiple providers
- Consistency checks
- Fail-closed behavior for critical uncertainty

---

## Phishing

### Threat

An attacker tricks a user into interacting with a malicious
website, application or transaction.

### Potential Impact

- Seed phrase disclosure
- Unauthorized transaction approval
- Asset loss

### Primary Protection

- Clear transaction confirmation
- Origin/domain awareness
- Network warnings
- Explicit user approval
- Never request seed phrases through untrusted interfaces

---

## MEV

### Threat

A transaction may be observed or reordered by blockchain
participants before final settlement.

### Potential Impact

Potential transaction execution differences or economic loss.

### Primary Protection

MEV-related protections must be evaluated separately for each
supported blockchain and transaction type.

The wallet must not assume that transaction submission guarantees
a particular execution outcome.

---

## Replay Attacks

### Threat

A previously valid transaction or authorization is reused.

### Potential Impact

Unauthorized repeated execution where the underlying protocol
allows replay.

### Primary Protection

- Correct chain identification
- Correct transaction construction
- Protocol-specific replay protection
- Explicit network validation

---

## Transaction Substitution

### Threat

The transaction presented to the user differs from the
transaction actually signed or submitted.

### Potential Impact

Funds sent to an unintended recipient or network.

### Primary Protection

The confirmation UI must clearly display:

- Network
- Recipient
- Asset
- Amount
- Fee

The signed transaction must correspond to the reviewed transaction.

---

## Insider Abuse

### Threat

An employee, administrator or privileged service operator abuses
access.

### Potential Impact

Unauthorized access to systems or sensitive information.

### Primary Protection

- Least privilege
- Separation of trust domains
- Audit logging
- Minimal access
- No server-side possession of self-custody private keys