import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { AuthenticationService } from "../identity/auth-service.js";

import { AuthRateLimiter } from "../identity/auth-rate-limit.js";

import { createAuthRoutes } from "../routes/auth.js";

function createAuthenticationServiceMock() {
  return {
    authenticateWithPassword: vi.fn(),
  } as unknown as AuthenticationService;
}

function createRateLimiterMock() {
  return {
    check: vi.fn(),
  } as unknown as AuthRateLimiter;
}

function createApp(
  authenticationService: AuthenticationService,
  rateLimiter: AuthRateLimiter,
): FastifyInstance {
  const app = Fastify({
    genReqId: () => "test-request-id",
  });

  app.setErrorHandler((error, _request, reply) => {
    const apiError = error as {
      statusCode?: number;
      code?: string;
      message: string;
    };

    if (typeof apiError.statusCode === "number" && typeof apiError.code === "string") {
      return reply.status(apiError.statusCode).send({
        error: {
          code: apiError.code,
          message: apiError.message,
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

  app.register(
    createAuthRoutes({
      authenticationService,
      rateLimiter,
    }),
  );

  return app;
}

function validLoginBody() {
  return {
    email: "user@example.com",
    password: "correct-password",
    deviceId: "00000000-0000-4000-8000-000000000001",
  };
}

describe("POST /auth/login", () => {
  it("authenticates successfully", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    vi.mocked(authenticationService.authenticateWithPassword).mockResolvedValue({
      identityAccount: {
        id: "identity-id",
        userId: "user-id",
        normalizedEmail: "user@example.com",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-id",
        userId: "user-id",
        deviceId: "00000000-0000-4000-8000-000000000001",
        tokenFamilyId: "family-id",
        refreshTokenHash: "hashed-token",
        status: "active",
        issuedAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 1_000_000),
        idleExpiresAt: new Date(Date.now() + 500_000),
        rotatedAt: null,
        revokedAt: null,
        revokedReason: null,
        replacedBySessionId: null,
      },
      refreshToken: "refresh-token-value",
    });

    const app = Fastify({
      genReqId: () => "test-request-id",
    });

    app.setErrorHandler((error, _request, reply) => {
      const apiError = error as {
        statusCode?: number;
        code?: string;
        message: string;
      };

      if (typeof apiError.statusCode === "number" && typeof apiError.code === "string") {
        return reply.status(apiError.statusCode).send({
          error: {
            code: apiError.code,
            message: apiError.message,
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
      createAuthRoutes({
        authenticationService,
        rateLimiter,
      }),
    );

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: validLoginBody(),
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        userId: "user-id",
        sessionId: "session-id",
        refreshToken: "refresh-token-value",
      },
      requestId: "test-request-id",
    });

    expect(authenticationService.authenticateWithPassword).toHaveBeenCalledOnce();

    const input = vi.mocked(authenticationService.authenticateWithPassword).mock.calls[0]![0];

    expect(input.normalizedEmail).toBe("user@example.com");

    expect(input.password).toBe("correct-password");

    expect(input.deviceId).toBe("00000000-0000-4000-8000-000000000001");

    await app.close();
  });

  it("returns 401 for invalid credentials", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    vi.mocked(authenticationService.authenticateWithPassword).mockRejectedValue(
      new Error("Invalid credentials"),
    );

    const app = await createApp(authenticationService, rateLimiter);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: validLoginBody(),
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials",
      },
    });

    await app.close();
  });

  it("returns 401 for an invalid device", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    vi.mocked(authenticationService.authenticateWithPassword).mockRejectedValue(
      new Error("Invalid device"),
    );

    const app = await createApp(authenticationService, rateLimiter);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: validLoginBody(),
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_DEVICE",
        message: "Invalid device",
      },
    });

    await app.close();
  });

  it("returns 423 when the password is locked", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    vi.mocked(authenticationService.authenticateWithPassword).mockRejectedValue(
      new Error("Password credential is locked"),
    );

    const app = await createApp(authenticationService, rateLimiter);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: validLoginBody(),
    });

    expect(response.statusCode).toBe(423);

    expect(response.json()).toEqual({
      error: {
        code: "PASSWORD_LOCKED",
        message: "Password credential is locked",
      },
    });

    await app.close();
  });

  it("returns 429 when the login rate limit is exceeded", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });

    const app = await createApp(authenticationService, rateLimiter);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: validLoginBody(),
    });

    expect(response.statusCode).toBe(429);

    expect(response.json()).toEqual({
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Authentication rate limit exceeded",
      },
    });

    expect(authenticationService.authenticateWithPassword).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    const app = await createApp(authenticationService, rateLimiter);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "not-an-email",
        password: "",
        deviceId: "invalid-device-id",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid login request",
      },
    });

    expect(authenticationService.authenticateWithPassword).not.toHaveBeenCalled();

    await app.close();
  });

  it("normalizes the email before authentication", async () => {
    const authenticationService = createAuthenticationServiceMock();

    const rateLimiter = createRateLimiterMock();

    vi.mocked(rateLimiter.check).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    vi.mocked(authenticationService.authenticateWithPassword).mockResolvedValue({
      identityAccount: {
        id: "identity-id",
        userId: "user-id",
        normalizedEmail: "user@example.com",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-id",
        userId: "user-id",
        deviceId: "00000000-0000-4000-8000-000000000001",
        tokenFamilyId: "family-id",
        refreshTokenHash: "hash",
        status: "active",
        issuedAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 1_000_000),
        idleExpiresAt: new Date(Date.now() + 500_000),
        rotatedAt: null,
        revokedAt: null,
        revokedReason: null,
        replacedBySessionId: null,
      },
      refreshToken: "token",
    });

    const app = await createApp(authenticationService, rateLimiter);

    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "  USER@EXAMPLE.COM  ",
        password: "password",
        deviceId: "00000000-0000-4000-8000-000000000001",
      },
    });

    const input = vi.mocked(authenticationService.authenticateWithPassword).mock.calls[0]![0];

    expect(input.normalizedEmail).toBe("user@example.com");

    await app.close();
  });
});
