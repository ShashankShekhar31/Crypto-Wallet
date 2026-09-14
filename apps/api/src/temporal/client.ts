import { Connection, Client } from "@temporalio/client";

import type { ProcessExchangeDepositInput } from "./activities/exchange-deposit.js";

const temporalAddress = process.env.TEMPORAL_ADDRESS?.trim() || "127.0.0.1:7233";

const temporalNamespace = process.env.TEMPORAL_NAMESPACE?.trim() || "default";

const temporalTaskQueue = process.env.TEMPORAL_TASK_QUEUE?.trim() || "crypto-wallet.workflows";

export type TemporalWorkflowClient = Client;

export async function createTemporalClient(): Promise<Client> {
  const connection = await Connection.connect({
    address: temporalAddress,
  });

  return new Client({
    connection,
    namespace: temporalNamespace,
  });
}

export async function startExchangeDepositWorkflow(
  client: Client,
  workflowId: string,
  input: ProcessExchangeDepositInput,
) {
  return client.workflow.start("processExchangeDepositWorkflow", {
    taskQueue: temporalTaskQueue,
    workflowId,
    args: [input],
  });
}
