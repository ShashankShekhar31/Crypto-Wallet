import type { ExchangeLedgerTransaction } from "./exchange-posting-types.js";
import { validateExchangeLedgerTransaction } from "./exchange-posting-validator.js";

export interface DepositPostingInput {
  id: string;
  reference: string;
  assetLedgerAccountId: string;
  custodyLedgerAccountId: string;
  amount: string;
}

export interface WithdrawalPostingInput {
  id: string;
  reference: string;
  customerLedgerAccountId: string;
  custodyLedgerAccountId: string;
  amount: string;
}

export interface TradePostingInput {
  id: string;
  reference: string;
  buyerBaseLedgerAccountId: string;
  sellerBaseLedgerAccountId: string;
  buyerQuoteLedgerAccountId: string;
  sellerQuoteLedgerAccountId: string;
  baseAmount: string;
  quoteAmount: string;
}

export interface FeePostingInput {
  id: string;
  reference: string;
  sourceLedgerAccountId: string;
  feeLedgerAccountId: string;
  amount: string;
}

export function buildDepositPosting(
  input: DepositPostingInput,
): ExchangeLedgerTransaction {
  const transaction: ExchangeLedgerTransaction = {
    id: input.id,
    reference: input.reference,
    operation: "deposit",
    postings: [
      {
        ledgerAccountId: input.custodyLedgerAccountId,
        type: "debit",
        amount: input.amount,
      },
      {
        ledgerAccountId: input.assetLedgerAccountId,
        type: "credit",
        amount: input.amount,
      },
    ],
  };

  validateExchangeLedgerTransaction(transaction);

  return Object.freeze({
    ...transaction,
    postings: Object.freeze(
      transaction.postings.map((posting) => Object.freeze({ ...posting })),
    ),
  });
}

export function buildWithdrawalPosting(
  input: WithdrawalPostingInput,
): ExchangeLedgerTransaction {
  const transaction: ExchangeLedgerTransaction = {
    id: input.id,
    reference: input.reference,
    operation: "withdrawal",
    postings: [
      {
        ledgerAccountId: input.customerLedgerAccountId,
        type: "debit",
        amount: input.amount,
      },
      {
        ledgerAccountId: input.custodyLedgerAccountId,
        type: "credit",
        amount: input.amount,
      },
    ],
  };

  validateExchangeLedgerTransaction(transaction);

  return Object.freeze({
    ...transaction,
    postings: Object.freeze(
      transaction.postings.map((posting) => Object.freeze({ ...posting })),
    ),
  });
}

export function buildTradePosting(
  input: TradePostingInput,
): ExchangeLedgerTransaction {
  const transaction: ExchangeLedgerTransaction = {
    id: input.id,
    reference: input.reference,
    operation: "trade",
    postings: [
      {
        ledgerAccountId: input.buyerBaseLedgerAccountId,
        type: "debit",
        amount: input.baseAmount,
      },
      {
        ledgerAccountId: input.sellerBaseLedgerAccountId,
        type: "credit",
        amount: input.baseAmount,
      },
      {
        ledgerAccountId: input.buyerQuoteLedgerAccountId,
        type: "credit",
        amount: input.quoteAmount,
      },
      {
        ledgerAccountId: input.sellerQuoteLedgerAccountId,
        type: "debit",
        amount: input.quoteAmount,
      },
    ],
  };

  validateExchangeLedgerTransaction(transaction);

  return Object.freeze({
    ...transaction,
    postings: Object.freeze(
      transaction.postings.map((posting) => Object.freeze({ ...posting })),
    ),
  });
}

export function buildFeePosting(
  input: FeePostingInput,
): ExchangeLedgerTransaction {
  const transaction: ExchangeLedgerTransaction = {
    id: input.id,
    reference: input.reference,
    operation: "fee",
    postings: [
      {
        ledgerAccountId: input.sourceLedgerAccountId,
        type: "debit",
        amount: input.amount,
      },
      {
        ledgerAccountId: input.feeLedgerAccountId,
        type: "credit",
        amount: input.amount,
      },
    ],
  };

  validateExchangeLedgerTransaction(transaction);

  return Object.freeze({
    ...transaction,
    postings: Object.freeze(
      transaction.postings.map((posting) => Object.freeze({ ...posting })),
    ),
  });
}