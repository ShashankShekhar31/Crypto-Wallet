import type {
  CustodyAuthorizer,
  CustodyBroadcaster,
  CustodyMonitor,
  CustodyPolicyEvaluator,
  CustodyRequest,
} from "../custody-pipeline.js";
import { DefaultCustodyPipeline } from "../default-custody-pipeline.js";
import type {
  CustodySignRequest,
  CustodySignature,
  KeyManagementProvider,
} from "../key-management.js";
import { describe, expect, it, vi } from "vitest";

function createRequest(): CustodyRequest {
  return {
    requestId: "request-1",
    accountId: "account-1",
    key: {
      id: "local-hot-1",
      tier: "hot",
    },
    chain: "bitcoin",
    payload: new Uint8Array(32).fill(1),
    correlationId: "correlation-1",
  };
}

function createSignature(): CustodySignature {
  return {
    keyId: "local-hot-1",
    chain: "bitcoin",
    signature: new Uint8Array(65).fill(7),
  };
}

function createDependencies() {
  const signature = createSignature();

  const keyManagement: KeyManagementProvider = {
    getPublicKey: vi.fn(async () => new Uint8Array([1, 2, 3])),
    sign: vi.fn(async (_request: CustodySignRequest): Promise<CustodySignature> => {
      return {
        ...signature,
        signature: new Uint8Array(signature.signature),
      };
    }),
  };

  const policy: CustodyPolicyEvaluator = {
    evaluate: vi.fn(async () => ({
      approved: true,
      riskScore: 10,
      reason: "Low risk",
    })),
  };

  const authorization: CustodyAuthorizer = {
    authorize: vi.fn(async () => ({
      approved: true,
      authorizedBy: ["operator-1"],
    })),
  };

  const broadcaster: CustodyBroadcaster = {
    broadcast: vi.fn(async () => ({
      transactionHash: "tx-hash-1",
    })),
  };

  const monitor: CustodyMonitor = {
    monitor: vi.fn(async () => ({
      status: "confirmed" as const,
    })),
  };

  return {
    keyManagement,
    policy,
    authorization,
    broadcaster,
    monitor,
  };
}

describe("DefaultCustodyPipeline", () => {
  it("executes policy, authorization, signing, broadcast, and monitoring in order", async () => {
    const dependencies = createDependencies();
    const calls: string[] = [];

    dependencies.policy.evaluate = vi.fn(async () => {
      calls.push("policy");

      return {
        approved: true,
        riskScore: 10,
        reason: "Low risk",
      };
    });

    dependencies.authorization.authorize = vi.fn(async () => {
      calls.push("authorization");

      return {
        approved: true,
        authorizedBy: ["operator-1"],
      };
    });

    dependencies.keyManagement.sign = vi.fn(async () => {
      calls.push("signing");

      return createSignature();
    });

    dependencies.broadcaster.broadcast = vi.fn(async () => {
      calls.push("broadcast");

      return {
        transactionHash: "tx-hash-1",
      };
    });

    dependencies.monitor.monitor = vi.fn(async () => {
      calls.push("monitoring");

      return {
        status: "confirmed" as const,
      };
    });

    const pipeline = new DefaultCustodyPipeline(
      dependencies.keyManagement,
      dependencies.policy,
      dependencies.authorization,
      dependencies.broadcaster,
      dependencies.monitor,
    );

    const result = await pipeline.execute(createRequest());

    expect(calls).toEqual(["policy", "authorization", "signing", "broadcast", "monitoring"]);

    expect(result).toEqual({
      requestId: "request-1",
      status: "completed",
      signature: new Uint8Array(65).fill(7),
      transactionHash: "tx-hash-1",
    });
  });

  it("rejects before authorization when policy rejects", async () => {
    const dependencies = createDependencies();

    dependencies.policy.evaluate = vi.fn(async () => ({
      approved: false,
      riskScore: 90,
      reason: "High risk",
    }));

    const pipeline = new DefaultCustodyPipeline(
      dependencies.keyManagement,
      dependencies.policy,
      dependencies.authorization,
      dependencies.broadcaster,
      dependencies.monitor,
    );

    const result = await pipeline.execute(createRequest());

    expect(result).toEqual({
      requestId: "request-1",
      status: "rejected",
    });

    expect(dependencies.authorization.authorize).not.toHaveBeenCalled();
    expect(dependencies.keyManagement.sign).not.toHaveBeenCalled();
    expect(dependencies.broadcaster.broadcast).not.toHaveBeenCalled();
    expect(dependencies.monitor.monitor).not.toHaveBeenCalled();
  });

  it("rejects before signing when authorization rejects", async () => {
    const dependencies = createDependencies();

    dependencies.authorization.authorize = vi.fn(async () => ({
      approved: false,
      authorizedBy: [],
    }));

    const pipeline = new DefaultCustodyPipeline(
      dependencies.keyManagement,
      dependencies.policy,
      dependencies.authorization,
      dependencies.broadcaster,
      dependencies.monitor,
    );

    const result = await pipeline.execute(createRequest());

    expect(result).toEqual({
      requestId: "request-1",
      status: "rejected",
    });

    expect(dependencies.keyManagement.sign).not.toHaveBeenCalled();
    expect(dependencies.broadcaster.broadcast).not.toHaveBeenCalled();
    expect(dependencies.monitor.monitor).not.toHaveBeenCalled();
  });

  it("returns monitoring when the broadcast is pending", async () => {
    const dependencies = createDependencies();

    dependencies.monitor.monitor = vi.fn(async () => ({
      status: "pending" as const,
    }));

    const pipeline = new DefaultCustodyPipeline(
      dependencies.keyManagement,
      dependencies.policy,
      dependencies.authorization,
      dependencies.broadcaster,
      dependencies.monitor,
    );

    const result = await pipeline.execute(createRequest());

    expect(result.status).toBe("monitoring");
    expect(result.transactionHash).toBe("tx-hash-1");
  });

  it("returns failed when monitoring reports failure", async () => {
    const dependencies = createDependencies();

    dependencies.monitor.monitor = vi.fn(async () => ({
      status: "failed" as const,
    }));

    const pipeline = new DefaultCustodyPipeline(
      dependencies.keyManagement,
      dependencies.policy,
      dependencies.authorization,
      dependencies.broadcaster,
      dependencies.monitor,
    );

    const result = await pipeline.execute(createRequest());

    expect(result.status).toBe("failed");
  });

  it("does not mutate the caller signing payload", async () => {
    const dependencies = createDependencies();

    const pipeline = new DefaultCustodyPipeline(
      dependencies.keyManagement,
      dependencies.policy,
      dependencies.authorization,
      dependencies.broadcaster,
      dependencies.monitor,
    );

    const request = createRequest();
    const originalPayload = new Uint8Array(request.payload);

    await pipeline.execute(request);

    expect(request.payload).toEqual(originalPayload);
  });
});
