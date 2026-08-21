import type { FastifyInstance } from "fastify";

import { health } from "../index.js";
import { healthQuerySchema } from "../validation.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (request) => {
    healthQuerySchema.parse(request.query);

    return {
      data: health,
    };
  });
}