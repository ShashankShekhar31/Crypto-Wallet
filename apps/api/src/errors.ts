import type { FastifyReply, FastifyRequest } from "fastify";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  const apiError = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };

  if (
    error instanceof ApiError &&
    typeof apiError.statusCode === "number" &&
    typeof apiError.code === "string"
  ) {
    return reply.status(apiError.statusCode).send({
      error: {
        code: apiError.code,
        message: typeof apiError.message === "string" ? apiError.message : "Internal server error",
      },
    });
  }

  if (typeof apiError.statusCode === "number" && typeof apiError.code === "string") {
    return reply.status(apiError.statusCode).send({
      error: {
        code: apiError.code,
        message: typeof apiError.message === "string" ? apiError.message : "Internal server error",
      },
    });
  }

  return reply.status(500).send({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    },
  });
}
