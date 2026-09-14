import { randomUUID } from "node:crypto";
import { createTemporalClient, startExchangeDepositWorkflow } from "./client.js";

const client = await createTemporalClient();

const depositId = randomUUID();

const workflow = await startExchangeDepositWorkflow(client, `exchange-deposit-${depositId}`, {
  depositId,
  exchangeAccountId: "exchange-account-demo",
  assetAccountId: "asset-account-demo",
  transactionHash: "0x-demo-transaction",
  amount: "1.25",
});

console.log(`Workflow started: ${workflow.workflowId}`);
console.log(`Run ID: ${workflow.firstExecutionRunId}`);

const result = await workflow.result();

console.log("Workflow completed:", result);

await client.connection.close();
