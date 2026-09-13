import type {
  ExchangeLedgerTransaction,
  ExchangePosting,
} from "./exchange-posting-types.js";

export function validateExchangeLedgerTransaction(
  transaction: ExchangeLedgerTransaction,
): void {
  if (transaction.id.trim().length === 0) {
    throw new Error("Exchange ledger transaction ID must not be empty");
  }

  if (transaction.reference.trim().length === 0) {
    throw new Error(
      "Exchange ledger transaction reference must not be empty",
    );
  }

  if (transaction.postings.length < 2) {
    throw new Error(
      "Exchange ledger transaction requires at least two postings",
    );
  }

  let debits = 0n;
  let credits = 0n;

  for (const posting of transaction.postings) {
    validatePosting(posting);

    const amount = BigInt(posting.amount);

    if (posting.type === "debit") {
      debits += amount;
    } else {
      credits += amount;
    }
  }

  if (debits !== credits) {
    throw new Error(
      "Exchange ledger transaction must balance",
    );
  }
}

function validatePosting(posting: ExchangePosting): void {
  if (posting.ledgerAccountId.trim().length === 0) {
    throw new Error(
      "Exchange ledger posting account ID must not be empty",
    );
  }

  if (
    !/^[0-9]+$/.test(posting.amount) ||
    BigInt(posting.amount) <= 0n
  ) {
    throw new Error(
      "Exchange ledger posting amount must be positive",
    );
  }

  if (posting.type !== "debit" && posting.type !== "credit") {
    throw new Error(
      "Exchange ledger posting type must be debit or credit",
    );
  }
}