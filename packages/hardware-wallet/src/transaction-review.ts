export interface HardwareTransactionReview {
  readonly chain: string;
  readonly recipient: string;
  readonly amount: string;
  readonly fee: string;
}

export interface HardwareTransactionReviewRequest {
  readonly review: HardwareTransactionReview;
  readonly payload: Uint8Array;
}

export function createHardwareTransactionReview(
  request: HardwareTransactionReviewRequest,
): HardwareTransactionReview {
  if (request.review.chain.trim().length === 0) {
    throw new Error("Transaction review chain is required");
  }

  if (request.review.recipient.trim().length === 0) {
    throw new Error("Transaction review recipient is required");
  }

  if (request.review.amount.trim().length === 0) {
    throw new Error("Transaction review amount is required");
  }

  if (request.review.fee.trim().length === 0) {
    throw new Error("Transaction review fee is required");
  }

  return Object.freeze({
    chain: request.review.chain,
    recipient: request.review.recipient,
    amount: request.review.amount,
    fee: request.review.fee,
  });
}
