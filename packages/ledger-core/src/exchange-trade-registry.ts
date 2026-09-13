import type { ExchangeTradeRecord } from "./exchange-trade-types.js";

export class ExchangeTradeRegistry {
  private readonly trades = new Map<string, ExchangeTradeRecord>();
  private readonly references = new Map<string, string>();

  create(trade: ExchangeTradeRecord): ExchangeTradeRecord {
    if (this.trades.has(trade.id)) {
      throw new Error(`Exchange trade already exists: ${trade.id}`);
    }

    if (this.references.has(trade.reference)) {
      throw new Error(`Exchange trade reference already exists: ${trade.reference}`);
    }

    this.validate(trade);

    const stored = Object.freeze({ ...trade });

    this.trades.set(trade.id, stored);
    this.references.set(trade.reference, trade.id);

    return stored;
  }

  getById(id: string): ExchangeTradeRecord | null {
    const trade = this.trades.get(id);

    if (trade === undefined) {
      return null;
    }

    return Object.freeze({ ...trade });
  }

  private validate(trade: ExchangeTradeRecord): void {
    if (trade.buyerExchangeAssetAccountId.trim().length === 0) {
      throw new Error("Exchange trade buyer asset account ID must not be empty");
    }

    if (trade.sellerExchangeAssetAccountId.trim().length === 0) {
      throw new Error("Exchange trade seller asset account ID must not be empty");
    }

    if (trade.buyerExchangeAssetAccountId === trade.sellerExchangeAssetAccountId) {
      throw new Error("Exchange trade buyer and seller asset accounts must differ");
    }

    if (trade.baseAssetId.trim().length === 0) {
      throw new Error("Exchange trade base asset ID must not be empty");
    }

    if (trade.quoteAssetId.trim().length === 0) {
      throw new Error("Exchange trade quote asset ID must not be empty");
    }

    if (trade.baseAssetId === trade.quoteAssetId) {
      throw new Error("Exchange trade base and quote assets must differ");
    }

    this.validatePositiveInteger(trade.baseAmount, "Exchange trade base amount");

    this.validatePositiveInteger(trade.quoteAmount, "Exchange trade quote amount");

    this.validatePositiveInteger(trade.priceNumerator, "Exchange trade price numerator");

    this.validatePositiveInteger(trade.priceDenominator, "Exchange trade price denominator");

    if (trade.reference.trim().length === 0) {
      throw new Error("Exchange trade reference must not be empty");
    }

    if (trade.executedAt.trim().length === 0) {
      throw new Error("Exchange trade execution time must not be empty");
    }
  }

  private validatePositiveInteger(value: string, field: string): void {
    if (!/^[0-9]+$/.test(value) || BigInt(value) <= 0n) {
      throw new Error(`${field} must be positive`);
    }
  }
}
