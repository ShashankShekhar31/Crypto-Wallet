import type { FastifyInstance } from "fastify";

import { health } from "../health.js";
import { healthQuerySchema } from "../validation.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Get API health status",
        description: "Returns the current health and service status of the Crypto Wallet API.",
        operationId: "getHealth",
      },
    },
    async (request) => {
      healthQuerySchema.parse(request.query);

      return {
        data: health,
        requestId: request.id,
      };
    },
  );
}
