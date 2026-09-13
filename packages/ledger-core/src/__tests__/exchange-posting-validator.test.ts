import { describe, expect, it } from "vitest";
import {
  validateExchangeLedgerTransaction,
  type ExchangeLedgerTransaction,
} from "../index.js";

function createTransaction(
  overrides: Partial<ExchangeLedgerTransaction> = {},
): ExchangeLedgerTransaction {
  return {
    id: "exchange-ledger-tx-1",
    reference: "deposit-ref-1",
    operation: "deposit",
    postings: [
      {
        ledgerAccountId: "cash-account",
        type: "debit",
        amount: "1000000",
      },
      {
        ledgerAccountId: "customer-account",
        type: "credit",
        amount: "1000000",
      },
    ],
    ...overrides,
  };
}

describe("validateExchangeLedgerTransaction", () => {
  it("accepts a balanced transaction", () => {
    expect(() =>
      validateExchangeLedgerTransaction(createTransaction()),
    ).not.toThrow();
  });

  it("accepts multiple balanced postings", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          postings: [
            {
              ledgerAccountId: "account-a",
              type: "debit",
              amount: "600",
            },
            {
              ledgerAccountId: "account-b",
              type: "debit",
              amount: "400",
            },
            {
              ledgerAccountId: "account-c",
              type: "credit",
              amount: "1000",
            },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects an empty transaction ID", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          id: "   ",
        }),
      ),
    ).toThrow(
      "Exchange ledger transaction ID must not be empty",
    );
  });

  it("rejects an empty reference", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          reference: "   ",
        }),
      ),
    ).toThrow(
      "Exchange ledger transaction reference must not be empty",
    );
  });

  it("requires at least two postings", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          postings: [
            {
              ledgerAccountId: "account-a",
              type: "debit",
              amount: "100",
            },
          ],
        }),
      ),
    ).toThrow(
      "Exchange ledger transaction requires at least two postings",
    );
  });

  it("rejects unbalanced postings", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          postings: [
            {
              ledgerAccountId: "account-a",
              type: "debit",
              amount: "100",
            },
            {
              ledgerAccountId: "account-b",
              type: "credit",
              amount: "99",
            },
          ],
        }),
      ),
    ).toThrow("Exchange ledger transaction must balance");
  });

  it("rejects an empty posting account ID", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          postings: [
            {
              ledgerAccountId: "   ",
              type: "debit",
              amount: "100",
            },
            {
              ledgerAccountId: "account-b",
              type: "credit",
              amount: "100",
            },
          ],
        }),
      ),
    ).toThrow(
      "Exchange ledger posting account ID must not be empty",
    );
  });

  it("rejects a zero posting amount", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          postings: [
            {
              ledgerAccountId: "account-a",
              type: "debit",
              amount: "0",
            },
            {
              ledgerAccountId: "account-b",
              type: "credit",
              amount: "0",
            },
          ],
        }),
      ),
    ).toThrow(
      "Exchange ledger posting amount must be positive",
    );
  });

  it("rejects a fractional posting amount", () => {
    expect(() =>
      validateExchangeLedgerTransaction(
        createTransaction({
          postings: [
            {
              ledgerAccountId: "account-a",
              type: "debit",
              amount: "1.5",
            },
            {
              ledgerAccountId: "account-b",
              type: "credit",
              amount: "1.5",
            },
          ],
        }),
      ),
    ).toThrow(
      "Exchange ledger posting amount must be positive",
    );
  });
});