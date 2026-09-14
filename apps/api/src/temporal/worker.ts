import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import { processExchangeDeposit } from "./activities/exchange-deposit.js";

const temporalAddress = process.env.TEMPORAL_ADDRESS?.trim() || "127.0.0.1:7233";

const temporalNamespace = process.env.TEMPORAL_NAMESPACE?.trim() || "default";

const temporalTaskQueue = process.env.TEMPORAL_TASK_QUEUE?.trim() || "crypto-wallet.workflows";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  const worker = await Worker.create({
    connection,
    namespace: temporalNamespace,
    taskQueue: temporalTaskQueue,
    workflowsPath: fileURLToPath(new URL("./workflows", import.meta.url)),
    activities: {
      processExchangeDeposit,
    },
  });

  console.log(
    `Temporal worker started: ${temporalAddress} / ${temporalNamespace} / ${temporalTaskQueue}`,
  );

  await worker.run();
}

run().catch((error) => {
  console.error("Temporal worker failed:", error);
  process.exit(1);
});
