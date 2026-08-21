import type { FastifyInstance } from "fastify";

import { health } from "../index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return health;
  });
}