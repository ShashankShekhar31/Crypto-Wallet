import Fastify, {
  type FastifyInstance,
} from "fastify";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ApiError } from "../errors.js";

import {
  createLogoutRoutes,
} from "../routes/logout.js";

import type {
  LogoutService,
} from "../identity/logout-service.js";

function createLogoutServiceMock() {
  return {
    logout: vi.fn(),
  } as unknown as LogoutService;
}

async function createApp(
  logoutService: LogoutService,
): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: () => "test-request-id",
  });

  app.setErrorHandler(
    (error, request, reply) => {
      if (error instanceof ApiError) {
        return reply.status(
          error.statusCode,
        ).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        },
      });
    },
  );

  await app.register(
    createLogoutRoutes({
      logoutService,
    }),
  );

  return app;
}

function createRevokedSessionResult() {
  const revokedAt = new Date(
    "2026-08-27T14:00:00.000Z",
  );

  return {
    session: {
      id: "session-id",
      userId: "user-id",
      deviceId: "device-id",
      tokenFamilyId: "token-family-id",
      refreshTokenHash: "hashed-refresh-token",
      status: "revoked" as const,
      issuedAt: new Date(
        "2026-08-27T12:00:00.000Z",
      ),
      lastSeenAt: new Date(
        "2026-08-27T13:00:00.000Z",
      ),
      expiresAt: new Date(
        "2026-09-26T12:00:00.000Z",
      ),
      idleExpiresAt: new Date(
        "2026-09-03T12:00:00.000Z",
      ),
      rotatedAt: null,
      revokedAt,
      revokedReason: "user_logout",
      replacedBySessionId: null,
    },
  };
}

describe("POST /auth/logout", () => {
  it("logs out successfully", async () => {
    const logoutService =
      createLogoutServiceMock();

    vi.mocked(
      logoutService.logout,
    ).mockResolvedValue(
      createRevokedSessionResult(),
    );

    const app =
      await createApp(logoutService);

    try {
      const response =
        await app.inject({
          method: "POST",
          url: "/auth/logout",
          payload: {
            refreshToken:
              "refresh-token",
          },
        });

      expect(
        response.statusCode,
      ).toBe(200);

      expect(
        response.json(),
      ).toEqual({
        data: {
          sessionId: "session-id",
          revoked: true,
        },
        requestId:
          "test-request-id",
      });

      expect(
        logoutService.logout,
      ).toHaveBeenCalledOnce();

      expect(
        logoutService.logout,
      ).toHaveBeenCalledWith({
        refreshToken:
          "refresh-token",
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 for an invalid refresh token", async () => {
    const logoutService =
      createLogoutServiceMock();

    vi.mocked(
      logoutService.logout,
    ).mockRejectedValue(
      new Error("Invalid refresh token"),
    );

    const app =
      await createApp(logoutService);

    try {
      const response =
        await app.inject({
          method: "POST",
          url: "/auth/logout",
          payload: {
            refreshToken:
              "invalid-token",
          },
        });

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        response.json(),
      ).toEqual({
        error: {
          code:
            "INVALID_REFRESH_TOKEN",
          message:
            "Invalid refresh token",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("returns 400 for an invalid request body", async () => {
    const logoutService =
      createLogoutServiceMock();

    const app =
      await createApp(logoutService);

    try {
      const response =
        await app.inject({
          method: "POST",
          url: "/auth/logout",
          payload: {},
        });

      expect(
        response.statusCode,
      ).toBe(400);

      expect(
        response.json(),
      ).toEqual({
        error: {
          code: "INVALID_REQUEST",
          message:
            "Invalid logout request",
        },
      });

      expect(
        logoutService.logout,
      ).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 for an empty refresh token", async () => {
    const logoutService =
      createLogoutServiceMock();

    const app =
      await createApp(logoutService);

    try {
      const response =
        await app.inject({
          method: "POST",
          url: "/auth/logout",
          payload: {
            refreshToken: "",
          },
        });

      expect(
        response.statusCode,
      ).toBe(400);

      expect(
        response.json(),
      ).toEqual({
        error: {
          code: "INVALID_REQUEST",
          message:
            "Invalid logout request",
        },
      });

      expect(
        logoutService.logout,
      ).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});