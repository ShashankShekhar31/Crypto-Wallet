import type { DAppCapability, DAppPermission } from "./permissions.js";
import { hasDAppCapability, isPermissionBoundTo } from "./permissions.js";
import type { DAppRequest } from "./requests.js";

export type DAppApprovalDecision = "approve" | "reject";

export interface DAppApproval {
  readonly requestId: string;
  readonly decision: DAppApprovalDecision;
  readonly approvedAt: string;
}

export class DAppAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DAppAuthorizationError";
  }
}

function capabilityForRequest(request: DAppRequest): DAppCapability {
  switch (request.type) {
    case "connect":
      return "connect";

    case "sign":
      return "sign";

    case "transaction":
      return "transact";

    default: {
      const exhaustiveCheck: never = request;
      return exhaustiveCheck;
    }
  }
}

export function authorizeDAppRequest(
  request: DAppRequest,
  permission: DAppPermission | undefined,
): void {
  if (permission === undefined) {
    throw new DAppAuthorizationError("No permission exists for this dApp request");
  }

  if (!isPermissionBoundTo(permission, request.origin, request.accountId, request.chain)) {
    throw new DAppAuthorizationError("dApp request is not bound to the granted permission");
  }

  const requiredCapability = capabilityForRequest(request);

  if (!hasDAppCapability(permission, requiredCapability)) {
    throw new DAppAuthorizationError(`dApp request requires ${requiredCapability} capability`);
  }
}

export function createDAppApproval(
  request: DAppRequest,
  decision: DAppApprovalDecision,
): DAppApproval {
  return {
    requestId: request.id,
    decision,
    approvedAt: new Date().toISOString(),
  };
}
