import { describe, expect, it } from "vitest";

import { DefaultLedgerEngine } from "../ledger-engine.js";

describe("DefaultLedgerEngine", () => {
  const debit = {
    ledgerAccountId: "account-a",
    type: "debit" as const,
    amount: "100",
  };

  const credit = {
    ledgerAccountId: "account-b",
    type: "credit" as const,
    amount: "100",
  };

  it("accepts a balanced posting", () => {
    const engine = new DefaultLedgerEngine();

    const transaction = engine.createTransaction({
      id: "ledger-tx-1",
      reference: "wallet-tx-1",
      postings: [debit, credit],
    });

    expect(transaction.id).toBe("ledger-tx-1");
    expect(transaction.reference).toBe("wallet-tx-1");
    expect(transaction.postings).toHaveLength(2);
  });

  it("rejects an unbalanced posting", () => {
    const engine = new DefaultLedgerEngine();

    expect(() =>
      engine.createTransaction({
        id: "ledger-tx-2",
        reference: "wallet-tx-2",
        postings: [
          debit,
          {
            ...credit,
            amount: "99",
          },
        ],
      }),
    ).toThrow("Ledger transaction must balance");
  });

  it("rejects a transaction without enough postings", () => {
    const engine = new DefaultLedgerEngine();

    expect(() =>
      engine.createTransaction({
        id: "ledger-tx-3",
        reference: "wallet-tx-3",
        postings: [debit],
      }),
    ).toThrow("Ledger transaction requires at least two postings");
  });

  it("rejects zero amounts", () => {
    const engine = new DefaultLedgerEngine();

    expect(() =>
      engine.createTransaction({
        id: "ledger-tx-4",
        reference: "wallet-tx-4",
        postings: [
          debit,
          {
            ...credit,
            amount: "0",
          },
        ],
      }),
    ).toThrow("Ledger posting amount must be positive");
  });

  it("rejects negative amounts", () => {
    const engine = new DefaultLedgerEngine();

    expect(() =>
      engine.createTransaction({
        id: "ledger-tx-5",
        reference: "wallet-tx-5",
        postings: [
          debit,
          {
            ...credit,
            amount: "-100",
          },
        ],
      }),
    ).toThrow("Ledger posting amount must be positive");
  });

  it("rejects duplicate transaction references", () => {
    const engine = new DefaultLedgerEngine();

    engine.createTransaction({
      id: "ledger-tx-6",
      reference: "wallet-tx-6",
      postings: [debit, credit],
    });

    expect(() =>
      engine.createTransaction({
        id: "ledger-tx-7",
        reference: "wallet-tx-6",
        postings: [debit, credit],
      }),
    ).toThrow("Ledger transaction reference already exists");
  });
  it("does not allow mutation of a created transaction", () => {
    const engine = new DefaultLedgerEngine();

    const transaction = engine.createTransaction({
      id: "ledger-tx-7",
      reference: "wallet-tx-7",
      postings: [debit, credit],
    });

    expect(() => {
      transaction.postings[0]!.amount = "999";
    }).toThrow();

    const stored = engine.getById("ledger-tx-7");

    expect(stored?.postings[0]!.amount).toBe("100");
  });

  it("does not allow mutation of the original input to alter ledger state", () => {
    const engine = new DefaultLedgerEngine();

    const input = {
      id: "ledger-tx-8",
      reference: "wallet-tx-8",
      postings: [{ ...debit }, { ...credit }],
    };

    engine.createTransaction(input);

    input.postings[0]!.amount = "999";

    const stored = engine.getById("ledger-tx-8");

    expect(stored?.postings[0]!.amount).toBe("100");
  });
  it("derives a ledger balance from postings", () => {
    const engine = new DefaultLedgerEngine();

    engine.createTransaction({
      id: "ledger-tx-9",
      reference: "wallet-tx-9",
      postings: [debit, credit],
    });

    const accountA = engine.getBalance("account-a");
    const accountB = engine.getBalance("account-b");

    expect(accountA).toEqual({
      ledgerAccountId: "account-a",
      debit: "100",
      credit: "0",
      balance: "100",
    });

    expect(accountB).toEqual({
      ledgerAccountId: "account-b",
      debit: "0",
      credit: "100",
      balance: "-100",
    });
  });

  it("returns zero balance for an account with no postings", () => {
    const engine = new DefaultLedgerEngine();

    expect(engine.getBalance("account-empty")).toEqual({
      ledgerAccountId: "account-empty",
      debit: "0",
      credit: "0",
      balance: "0",
    });
  });

  it("derives balances across multiple transactions", () => {
    const engine = new DefaultLedgerEngine();

    engine.createTransaction({
      id: "ledger-tx-10",
      reference: "wallet-tx-10",
      postings: [debit, credit],
    });

    engine.createTransaction({
      id: "ledger-tx-11",
      reference: "wallet-tx-11",
      postings: [
        {
          ledgerAccountId: "account-a",
          type: "credit",
          amount: "40",
        },
        {
          ledgerAccountId: "account-b",
          type: "debit",
          amount: "40",
        },
      ],
    });

    expect(engine.getBalance("account-a")).toEqual({
      ledgerAccountId: "account-a",
      debit: "100",
      credit: "40",
      balance: "60",
    });

    expect(engine.getBalance("account-b")).toEqual({
      ledgerAccountId: "account-b",
      debit: "40",
      credit: "100",
      balance: "-60",
    });
  });
});
