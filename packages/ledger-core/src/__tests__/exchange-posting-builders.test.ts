import { describe, expect, it } from "vitest";
import {
  buildDepositPosting,
  buildFeePosting,
  buildTradePosting,
  buildWithdrawalPosting,
} from "../index.js";

describe("exchange posting builders", () => {
  it("builds a balanced deposit posting", () => {
    const transaction = buildDepositPosting({
      id: "deposit-ledger-1",
      reference: "deposit-1",
      custodyLedgerAccountId: "custody-btc",
      assetLedgerAccountId: "customer-btc",
      amount: "1000",
    });

    expect(transaction.operation).toBe("deposit");
    expect(transaction.postings).toEqual([
      {
        ledgerAccountId: "custody-btc",
        type: "debit",
        amount: "1000",
      },
      {
        ledgerAccountId: "customer-btc",
        type: "credit",
        amount: "1000",
      },
    ]);
  });

  it("builds a balanced withdrawal posting", () => {
    const transaction = buildWithdrawalPosting({
      id: "withdrawal-ledger-1",
      reference: "withdrawal-1",
      customerLedgerAccountId: "customer-btc",
      custodyLedgerAccountId: "custody-btc",
      amount: "1000",
    });

    expect(transaction.operation).toBe("withdrawal");
    expect(transaction.postings).toEqual([
      {
        ledgerAccountId: "customer-btc",
        type: "debit",
        amount: "1000",
      },
      {
        ledgerAccountId: "custody-btc",
        type: "credit",
        amount: "1000",
      },
    ]);
  });

  it("builds a four-posting trade settlement", () => {
    const transaction = buildTradePosting({
      id: "trade-ledger-1",
      reference: "trade-1",
      buyerBaseLedgerAccountId: "buyer-btc",
      sellerBaseLedgerAccountId: "seller-btc",
      buyerQuoteLedgerAccountId: "buyer-usdc",
      sellerQuoteLedgerAccountId: "seller-usdc",
      baseAmount: "100",
      quoteAmount: "5000000",
    });

    expect(transaction.operation).toBe("trade");
    expect(transaction.postings).toEqual([
      {
        ledgerAccountId: "buyer-btc",
        type: "debit",
        amount: "100",
      },
      {
        ledgerAccountId: "seller-btc",
        type: "credit",
        amount: "100",
      },
      {
        ledgerAccountId: "buyer-usdc",
        type: "credit",
        amount: "5000000",
      },
      {
        ledgerAccountId: "seller-usdc",
        type: "debit",
        amount: "5000000",
      },
    ]);
  });

  it("builds a balanced fee posting", () => {
    const transaction = buildFeePosting({
      id: "fee-ledger-1",
      reference: "fee-1",
      sourceLedgerAccountId: "customer-usdc",
      feeLedgerAccountId: "exchange-fee-usdc",
      amount: "50000",
    });

    expect(transaction.operation).toBe("fee");
    expect(transaction.postings).toEqual([
      {
        ledgerAccountId: "customer-usdc",
        type: "debit",
        amount: "50000",
      },
      {
        ledgerAccountId: "exchange-fee-usdc",
        type: "credit",
        amount: "50000",
      },
    ]);
  });

  it("rejects invalid deposit amounts", () => {
    expect(() =>
      buildDepositPosting({
        id: "deposit-ledger-1",
        reference: "deposit-1",
        custodyLedgerAccountId: "custody-btc",
        assetLedgerAccountId: "customer-btc",
        amount: "0",
      }),
    ).toThrow("Exchange ledger posting amount must be positive");
  });

  it("rejects invalid withdrawal amounts", () => {
    expect(() =>
      buildWithdrawalPosting({
        id: "withdrawal-ledger-1",
        reference: "withdrawal-1",
        customerLedgerAccountId: "customer-btc",
        custodyLedgerAccountId: "custody-btc",
        amount: "1.5",
      }),
    ).toThrow("Exchange ledger posting amount must be positive");
  });

  it("rejects invalid trade amounts", () => {
    expect(() =>
      buildTradePosting({
        id: "trade-ledger-1",
        reference: "trade-1",
        buyerBaseLedgerAccountId: "buyer-btc",
        sellerBaseLedgerAccountId: "seller-btc",
        buyerQuoteLedgerAccountId: "buyer-usdc",
        sellerQuoteLedgerAccountId: "seller-usdc",
        baseAmount: "100",
        quoteAmount: "0",
      }),
    ).toThrow("Exchange ledger posting amount must be positive");
  });

  it("rejects invalid fee amounts", () => {
    expect(() =>
      buildFeePosting({
        id: "fee-ledger-1",
        reference: "fee-1",
        sourceLedgerAccountId: "customer-usdc",
        feeLedgerAccountId: "exchange-fee-usdc",
        amount: "0",
      }),
    ).toThrow("Exchange ledger posting amount must be positive");
  });

  it("returns immutable transactions", () => {
    const transaction = buildDepositPosting({
      id: "deposit-ledger-1",
      reference: "deposit-1",
      custodyLedgerAccountId: "custody-btc",
      assetLedgerAccountId: "customer-btc",
      amount: "1000",
    });

    expect(() => {
      transaction.postings[0]!.amount = "2000";
    }).toThrow();

    expect(transaction.postings[0]!.amount).toBe("1000");
  });
});
