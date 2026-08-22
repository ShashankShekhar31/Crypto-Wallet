import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { healthRoutes } from "../routes/health.js";

describe("GET /health", () => {
  it("returns a successful health response", async () => {
    const app = Fastify({
      genReqId: () => "test-request-id",
    });

    await app.register(healthRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("requestId", "test-request-id");
  });

  it("accepts an empty query", async () => {
    const app = Fastify({
      genReqId: () => "test-request-id",
    });

    await app.register(healthRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
  });
});
