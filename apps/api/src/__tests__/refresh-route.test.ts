import Fastify, { type FastifyInstance } from "fastify";

import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors.js";
import { createRefreshRoutes } from "../routes/refresh.js";

import type { RefreshService } from "../identity/refresh-service.js";

function createRefreshServiceMock() {
  return {
    refresh: vi.fn(),
  } as unknown as RefreshService;
}

async function createApp(refreshService: RefreshService): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: () => "test-request-id",
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
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
  });

  await app.register(
    createRefreshRoutes({
      refreshService,
    }),
  );

  return app;
}

function createSessionResult() {
  const issuedAt = new Date("2026-08-27T12:00:00.000Z");

  const previousSession = {
    id: "previous-session-id",
    userId: "user-id",
    deviceId: "device-id",
    tokenFamilyId: "token-family-id",
    refreshTokenHash: "old-hash",
    status: "rotated" as const,
    issuedAt,
    lastSeenAt: issuedAt,
    expiresAt: new Date("2026-09-26T12:00:00.000Z"),
    idleExpiresAt: new Date("2026-09-03T12:00:00.000Z"),
    rotatedAt: new Date("2026-08-27T12:01:00.000Z"),
    revokedAt: null,
    revokedReason: null,
    replacedBySessionId: "replacement-session-id",
  };

  const session = {
    id: "replacement-session-id",
    userId: "user-id",
    deviceId: "device-id",
    tokenFamilyId: "token-family-id",
    refreshTokenHash: "new-hash",
    status: "active" as const,
    issuedAt: new Date("2026-08-27T12:01:00.000Z"),
    lastSeenAt: new Date("2026-08-27T12:01:00.000Z"),
    expiresAt: new Date("2026-09-26T12:01:00.000Z"),
    idleExpiresAt: new Date("2026-09-03T12:01:00.000Z"),
    rotatedAt: null,
    revokedAt: null,
    revokedReason: null,
    replacedBySessionId: null,
  };

  return {
    previousSession,
    session,
    refreshToken: "new-refresh-token",
  };
}

describe("POST /auth/refresh", () => {
  it("refreshes successfully", async () => {
    const refreshService = createRefreshServiceMock();

    vi.mocked(refreshService.refresh).mockResolvedValue(createSessionResult());

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "old-refresh-token",
        },
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toEqual({
        data: {
          userId: "user-id",
          sessionId: "replacement-session-id",
          refreshToken: "new-refresh-token",
        },
        requestId: "test-request-id",
      });

      expect(refreshService.refresh).toHaveBeenCalledOnce();

      expect(refreshService.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: "old-refresh-token",
          expiresAt: expect.any(Date),
          idleExpiresAt: expect.any(Date),
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("returns 401 for an invalid refresh token", async () => {
    const refreshService = createRefreshServiceMock();

    vi.mocked(refreshService.refresh).mockRejectedValue(new Error("Invalid refresh token"));

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);

      expect(response.json()).toEqual({
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Invalid refresh token",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 when the refresh session is expired", async () => {
    const refreshService = createRefreshServiceMock();

    vi.mocked(refreshService.refresh).mockRejectedValue(new Error("Refresh session has expired"));

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "expired-token",
        },
      });

      expect(response.statusCode).toBe(401);

      expect(response.json()).toEqual({
        error: {
          code: "SESSION_EXPIRED",
          message: "Refresh session has expired",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 when the refresh session is idle expired", async () => {
    const refreshService = createRefreshServiceMock();

    vi.mocked(refreshService.refresh).mockRejectedValue(
      new Error("Refresh session is idle expired"),
    );

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "idle-expired-token",
        },
      });

      expect(response.statusCode).toBe(401);

      expect(response.json()).toEqual({
        error: {
          code: "SESSION_IDLE_EXPIRED",
          message: "Refresh session is idle expired",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 for a revoked session", async () => {
    const refreshService = createRefreshServiceMock();

    vi.mocked(refreshService.refresh).mockRejectedValue(new Error("Refresh session is not active"));

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "revoked-token",
        },
      });

      expect(response.statusCode).toBe(401);

      expect(response.json()).toEqual({
        error: {
          code: "SESSION_NOT_ACTIVE",
          message: "Refresh session is not active",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 when a rotated token is replayed", async () => {
    const refreshService = createRefreshServiceMock();

    vi.mocked(refreshService.refresh).mockRejectedValue(new Error("Refresh token replay detected"));

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "replayed-token",
        },
      });

      expect(response.statusCode).toBe(401);

      expect(response.json()).toEqual({
        error: {
          code: "REFRESH_TOKEN_REPLAY",
          message: "Refresh token replay detected",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("returns 400 for an invalid request body", async () => {
    const refreshService = createRefreshServiceMock();

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toEqual({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid refresh request",
        },
      });

      expect(refreshService.refresh).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 for an empty refresh token", async () => {
    const refreshService = createRefreshServiceMock();

    const app = await createApp(refreshService);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: "",
        },
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toEqual({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid refresh request",
        },
      });

      expect(refreshService.refresh).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
