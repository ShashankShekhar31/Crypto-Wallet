import type { HardwareSignRequest } from "./device.js";
import type { HardwareTransactionReview } from "./transaction-review.js";

export interface HardwareTransactionApproval {
  readonly review: HardwareTransactionReview;
  readonly signRequest: HardwareSignRequest;
}

export interface HardwareTransactionApprovalRequest {
  readonly review: HardwareTransactionReview;
  readonly signRequest: HardwareSignRequest;
}

export function createHardwareTransactionApproval(
  request: HardwareTransactionApprovalRequest,
): HardwareTransactionApproval {
  if (request.review.chain !== request.signRequest.chain) {
    throw new Error("Transaction review chain does not match signing request chain");
  }

  return Object.freeze({
    review: request.review,
    signRequest: Object.freeze({
      chain: request.signRequest.chain,
      derivationPath: request.signRequest.derivationPath,
      payload: new Uint8Array(request.signRequest.payload),
    }),
  });
}
