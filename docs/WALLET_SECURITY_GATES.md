# Wallet Security Acceptance Gates

Every wallet operation must pass the appropriate security gates
before implementation can be considered complete.

---

# Gate 1 — Wallet Creation

Before creating a wallet:

- [ ] Secure randomness source is available
- [ ] Seed generation uses an approved cryptographic library
- [ ] Seed is never logged
- [ ] Seed is never sent to the backend
- [ ] Seed is never sent to analytics
- [ ] Wallet is stored using secure local storage

---

# Gate 2 — Wallet Recovery

Before restoring a wallet:

- [ ] Mnemonic format is validated
- [ ] Invalid mnemonic is rejected
- [ ] Mnemonic is not logged
- [ ] Mnemonic is not sent to backend
- [ ] Recovery happens inside the wallet security boundary

---

# Gate 3 — Wallet Unlock

Before unlocking:

- [ ] Authentication is performed locally where appropriate
- [ ] Failed attempts are handled safely
- [ ] Sensitive values are not logged
- [ ] Unlock state has a defined lifetime
- [ ] Automatic locking is supported

---

# Gate 4 — Transaction Creation

Before constructing a transaction:

- [ ] Network is explicitly selected
- [ ] Asset is validated
- [ ] Recipient is validated
- [ ] Amount is validated
- [ ] Fee is validated where supported
- [ ] Chain identity is validated

---

# Gate 5 — Transaction Approval

Before signing:

- [ ] User sees the network
- [ ] User sees recipient
- [ ] User sees asset
- [ ] User sees amount
- [ ] User sees fee
- [ ] User explicitly approves

---

# Gate 6 — Signing

Before signing:

- [ ] Transaction matches reviewed intent
- [ ] Correct network is selected
- [ ] Correct wallet account is selected
- [ ] Private key remains inside security boundary
- [ ] Signing operation is auditable without logging secrets

---

# Gate 7 — Submission

Before submission:

- [ ] Signed transaction is valid
- [ ] Network matches intended network
- [ ] Submission target is correct
- [ ] Duplicate submission handling exists
- [ ] Submission result is tracked

---

# Gate 8 — Failure

When a security condition cannot be verified:

The operation must fail closed.

The application must not silently continue.