import { describe, expect, it, vi } from "vitest";

import { ApiError, handleApiError } from "../errors.js";

function createReplyMock() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));

  return {
    status,
    send,
  };
}

function createRequestMock() {
  return {
    log: {
      error: vi.fn(),
    },
  };
}

describe("handleApiError", () => {
  it("returns the status, code, and message for ApiError", () => {
    const reply = createReplyMock();
    const request = createRequestMock();

    handleApiError(
      new ApiError(401, "INVALID_CREDENTIALS", "Invalid credentials"),
      request as never,
      reply as never,
    );

    expect(request.log.error).toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.status.mock.results[0]?.value.send).toHaveBeenCalledWith({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials",
      },
    });
  });

  it("returns structured status and code for compatible errors", () => {
    const reply = createReplyMock();
    const request = createRequestMock();

    handleApiError(
      {
        statusCode: 429,
        code: "AUTH_RATE_LIMITED",
        message: "Authentication rate limit exceeded",
      },
      request as never,
      reply as never,
    );

    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.status.mock.results[0]?.value.send).toHaveBeenCalledWith({
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Authentication rate limit exceeded",
      },
    });
  });

  it("returns 500 for an unknown error", () => {
    const reply = createReplyMock();
    const request = createRequestMock();

    handleApiError(new Error("unexpected failure"), request as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.status.mock.results[0]?.value.send).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  it("uses the fallback message when a structured error has no message", () => {
    const reply = createReplyMock();
    const request = createRequestMock();

    handleApiError(
      {
        statusCode: 400,
        code: "BAD_REQUEST",
      },
      request as never,
      reply as never,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.status.mock.results[0]?.value.send).toHaveBeenCalledWith({
      error: {
        code: "BAD_REQUEST",
        message: "Internal server error",
      },
    });
  });
});
