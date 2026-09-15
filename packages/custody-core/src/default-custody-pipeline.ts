import type {
  CustodyPipeline,
  CustodyOperationResult,
  CustodyRequest,
} from "./custody-pipeline.js";

export class DefaultCustodyPipeline implements CustodyPipeline {
  constructor(
    public readonly keyManagement: CustodyPipeline["keyManagement"],
    public readonly policy: CustodyPipeline["policy"],
    public readonly authorization: CustodyPipeline["authorization"],
    public readonly broadcaster: CustodyPipeline["broadcaster"],
    public readonly monitor: CustodyPipeline["monitor"],
  ) {}

  async execute(request: CustodyRequest): Promise<CustodyOperationResult> {
    const policyDecision = await this.policy.evaluate(request);

    if (!policyDecision.approved) {
      return Object.freeze({
        requestId: request.requestId,
        status: "rejected" as const,
      });
    }

    const authorizationDecision = await this.authorization.authorize(request, policyDecision);

    if (!authorizationDecision.approved) {
      return Object.freeze({
        requestId: request.requestId,
        status: "rejected" as const,
      });
    }

    const signature = await this.keyManagement.sign({
      key: request.key,
      chain: request.chain,
      payload: new Uint8Array(request.payload),
      correlationId: request.correlationId,
    });

    const broadcast = await this.broadcaster.broadcast(request, signature);

    const monitoring = await this.monitor.monitor(request, broadcast);

    const status =
      monitoring.status === "confirmed"
        ? "completed"
        : monitoring.status === "pending"
          ? "monitoring"
          : "failed";

    return Object.freeze({
      requestId: request.requestId,
      status,
      signature: new Uint8Array(signature.signature),
      transactionHash: broadcast.transactionHash,
    });
  }
}
