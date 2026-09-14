export interface ProcessExchangeDepositInput {
  depositId: string;
  exchangeAccountId: string;
  assetAccountId: string;
  transactionHash: string;
  amount: string;
}

export interface ProcessExchangeDepositResult {
  depositId: string;
  status: "processed";
}

export async function processExchangeDeposit(
  input: ProcessExchangeDepositInput,
): Promise<ProcessExchangeDepositResult> {
  return {
    depositId: input.depositId,
    status: "processed",
  };
}
