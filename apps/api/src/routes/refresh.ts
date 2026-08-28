import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ApiError } from "../errors.js";
import { RefreshService } from "../identity/refresh-service.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_IDLE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export interface RefreshRouteDependencies {
  refreshService: RefreshService;
}

export function createRefreshRoutes(dependencies: RefreshRouteDependencies) {
  return async function refreshRoutes(app: FastifyInstance): Promise<void> {
    app.post("/auth/refresh", async (request) => {
      let body: z.infer<typeof refreshBodySchema>;

      try {
        body = refreshBodySchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid refresh request");
      }

      const now = Date.now();

      try {
        const result = await dependencies.refreshService.refresh({
          refreshToken: body.refreshToken,
          expiresAt: new Date(now + SESSION_DURATION_MS),
          idleExpiresAt: new Date(now + SESSION_IDLE_DURATION_MS),
        });

        return {
          data: {
            userId: result.session.userId,
            sessionId: result.session.id,
            refreshToken: result.refreshToken,
          },
          requestId: request.id,
        };
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof Error) {
          switch (error.message) {
            case "Invalid refresh token":
              throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");

            case "Refresh token replay detected":
              throw new ApiError(401, "REFRESH_TOKEN_REPLAY", "Refresh token replay detected");

            case "Refresh session is not active":
              throw new ApiError(401, "SESSION_NOT_ACTIVE", "Refresh session is not active");

            case "Refresh session has expired":
              throw new ApiError(401, "SESSION_EXPIRED", "Refresh session has expired");

            case "Refresh session is idle expired":
              throw new ApiError(401, "SESSION_IDLE_EXPIRED", "Refresh session is idle expired");

            default:
              throw error;
          }
        }

        throw error;
      }
    });
  };
}
