import { proxyActivities } from "@temporalio/workflow";
import type {
  ProcessExchangeDepositInput,
  ProcessExchangeDepositResult,
} from "../activities/exchange-deposit.js";

const { processExchangeDeposit } = proxyActivities<{
  processExchangeDeposit(input: ProcessExchangeDepositInput): Promise<ProcessExchangeDepositResult>;
}>({
  startToCloseTimeout: "1 minute",
});

export async function processExchangeDepositWorkflow(
  input: ProcessExchangeDepositInput,
): Promise<ProcessExchangeDepositResult> {
  return processExchangeDeposit(input);
}
