import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { LogoutService } from "../identity/logout-service.js";

import { ApiError } from "../errors.js";

const logoutBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export interface LogoutRouteDependencies {
  logoutService: LogoutService;
}

export function createLogoutRoutes(dependencies: LogoutRouteDependencies) {
  return async function logoutRoutes(app: FastifyInstance): Promise<void> {
    app.post(
      "/auth/logout",
      {
        schema: {
          tags: ["auth"],
          summary: "Log out an authentication session",
          description:
            "Revokes the authentication session associated with the supplied refresh token.",
          operationId: "logoutSession",
          body: {
            type: "object",
            properties: {
              refreshToken: {
                type: "string",
                description: "The currently valid refresh token.",
              },
            },
          },
          response: {
            200: {
              description: "Session logged out successfully",
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    sessionId: { type: "string" },
                    revoked: { type: "boolean" },
                  },
                  required: ["sessionId", "revoked"],
                },
                requestId: { type: "string" },
              },
              required: ["data", "requestId"],
            },
            400: {
              description: "Invalid logout request",
            },
            401: {
              description: "Invalid refresh token",
            },
          },
        },
      },
      async (request) => {
        let body: z.infer<typeof logoutBodySchema>;

        try {
          body = logoutBodySchema.parse(request.body);
        } catch {
          throw new ApiError(400, "INVALID_REQUEST", "Invalid logout request");
        }

        try {
          const result = await dependencies.logoutService.logout({
            refreshToken: body.refreshToken,
          });

          return {
            data: {
              sessionId: result.session.id,
              revoked: true,
            },
            requestId: request.id,
          };
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }

          if (error instanceof Error) {
            switch (error.message) {
              case "Refresh token is required":
                throw new ApiError(400, "INVALID_REQUEST", "Invalid logout request");

              case "Invalid refresh token":
                throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");

              default:
                throw error;
            }
          }

          throw error;
        }
      },
    );
  };
}
