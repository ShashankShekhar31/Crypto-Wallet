import type { CustodySignature, KeyManagementProvider, KeyReference } from "./key-management.js";

export type CustodyOperationStatus =
  | "requested"
  | "policy-approved"
  | "authorized"
  | "signed"
  | "broadcast"
  | "monitoring"
  | "completed"
  | "rejected"
  | "failed";

export interface CustodyRequest {
  readonly requestId: string;
  readonly accountId: string;
  readonly key: KeyReference;
  readonly chain: string;
  readonly payload: Uint8Array;
  readonly correlationId: string;
}

export interface PolicyRiskDecision {
  readonly approved: boolean;
  readonly riskScore: number;
  readonly reason: string;
}

export interface AuthorizationDecision {
  readonly approved: boolean;
  readonly authorizedBy: readonly string[];
}

export interface BroadcastResult {
  readonly transactionHash: string;
}

export interface MonitoringResult {
  readonly status: "pending" | "confirmed" | "failed";
}

export interface CustodyOperationResult {
  readonly requestId: string;
  readonly status: CustodyOperationStatus;
  readonly signature?: Uint8Array;
  readonly transactionHash?: string;
}

export interface CustodyPolicyEvaluator {
  evaluate(request: CustodyRequest): Promise<PolicyRiskDecision>;
}

export interface CustodyAuthorizer {
  authorize(request: CustodyRequest, decision: PolicyRiskDecision): Promise<AuthorizationDecision>;
}

export interface CustodyBroadcaster {
  broadcast(request: CustodyRequest, signature: CustodySignature): Promise<BroadcastResult>;
}

export interface CustodyMonitor {
  monitor(request: CustodyRequest, broadcast: BroadcastResult): Promise<MonitoringResult>;
}

export interface CustodyPipeline {
  readonly keyManagement: KeyManagementProvider;
  readonly policy: CustodyPolicyEvaluator;
  readonly authorization: CustodyAuthorizer;
  readonly broadcaster: CustodyBroadcaster;
  readonly monitor: CustodyMonitor;
}
