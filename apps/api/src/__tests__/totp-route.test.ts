import Fastify, { type FastifyInstance } from "fastify";

import { describe, expect, it, vi } from "vitest";

import { TotpService } from "../identity/totp-service.js";

import { createTotpRoutes } from "../routes/totp.js";

function createTotpServiceMock() {
  return {
    createFactor: vi.fn(),
    enableFactor: vi.fn(),
    disableFactor: vi.fn(),
    verifyCode: vi.fn(),
  } as unknown as TotpService;
}

function createApp(totpService: TotpService): FastifyInstance {
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
    createTotpRoutes({
      totpService,
    }),
  );

  return app;
}

const identityAccountId = "00000000-0000-4000-8000-000000000001";

const factorId = "00000000-0000-4000-8000-000000000002";

function activeFactor() {
  return {
    id: factorId,
    identityAccountId,
    encryptedSecret: Buffer.from("encrypted-secret"),
    secretNonce: Buffer.alloc(12),
    encryptionKeyVersion: "v1",
    createdAt: new Date(),
    enabledAt: new Date(),
    disabledAt: null,
  };
}

describe("POST /auth/totp/setup", () => {
  it("creates a TOTP factor successfully", async () => {
    const totpService = createTotpServiceMock();

    vi.mocked(totpService.createFactor).mockResolvedValue({
      factor: {
        id: factorId,
        identityAccountId,
        encryptedSecret: Buffer.from("encrypted-secret"),
        secretNonce: Buffer.alloc(12),
        encryptionKeyVersion: "v1",
        createdAt: new Date(),
        enabledAt: null,
        disabledAt: null,
      },
      secret: "JBSWY3DPEHPK3PXP",
    });

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/setup",
      payload: {
        identityAccountId,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        factorId,
        secret: "JBSWY3DPEHPK3PXP",
        enabledAt: null,
      },
      requestId: "test-request-id",
    });

    expect(totpService.createFactor).toHaveBeenCalledOnce();

    expect(vi.mocked(totpService.createFactor).mock.calls[0]![0]).toBe(identityAccountId);

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const totpService = createTotpServiceMock();

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/setup",
      payload: {
        identityAccountId: "invalid-id",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid TOTP setup request",
      },
    });

    expect(totpService.createFactor).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /auth/totp/enable", () => {
  it("enables a TOTP factor successfully", async () => {
    const totpService = createTotpServiceMock();

    vi.mocked(totpService.enableFactor).mockResolvedValue(activeFactor());

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/enable",
      payload: {
        factorId,
        code: "123456",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data.factorId).toBe(factorId);

    expect(body.data.enabled).toBe(true);

    expect(body.data.enabledAt).not.toBeNull();

    expect(body.requestId).toBe("test-request-id");

    expect(totpService.enableFactor).toHaveBeenCalledOnce();

    const input = vi.mocked(totpService.enableFactor).mock.calls[0]!;

    expect(input[0]).toBe(factorId);
    expect(input[1]).toBe("123456");

    await app.close();
  });

  it("returns 401 for an invalid TOTP code", async () => {
    const totpService = createTotpServiceMock();

    vi.mocked(totpService.enableFactor).mockRejectedValue(new Error("Invalid TOTP code"));

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/enable",
      payload: {
        factorId,
        code: "123456",
      },
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_TOTP_CODE",
        message: "Invalid TOTP code",
      },
    });

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const totpService = createTotpServiceMock();

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/enable",
      payload: {
        factorId,
        code: "12345",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid TOTP enable request",
      },
    });

    expect(totpService.enableFactor).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /auth/totp/disable", () => {
  it("disables a TOTP factor successfully", async () => {
    const totpService = createTotpServiceMock();

    const disabledAt = new Date();

    vi.mocked(totpService.disableFactor).mockResolvedValue({
      ...activeFactor(),
      enabledAt: new Date(),
      disabledAt,
    });

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/disable",
      payload: {
        factorId,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        factorId,
        disabled: true,
        disabledAt: disabledAt.toISOString(),
      },
      requestId: "test-request-id",
    });

    expect(totpService.disableFactor).toHaveBeenCalledOnce();

    expect(vi.mocked(totpService.disableFactor).mock.calls[0]![0]).toBe(factorId);

    await app.close();
  });

  it("returns 404 when the factor does not exist", async () => {
    const totpService = createTotpServiceMock();

    vi.mocked(totpService.disableFactor).mockRejectedValue(
      new Error("TOTP factor not found or already disabled"),
    );

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/disable",
      payload: {
        factorId,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      error: {
        code: "TOTP_FACTOR_NOT_FOUND",
        message: "TOTP factor not found or already disabled",
      },
    });

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const totpService = createTotpServiceMock();

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/disable",
      payload: {
        factorId: "invalid-factor-id",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid TOTP disable request",
      },
    });

    expect(totpService.disableFactor).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /auth/totp/verify", () => {
  it("verifies a valid TOTP code successfully", async () => {
    const totpService = createTotpServiceMock();

    vi.mocked(totpService.verifyCode).mockResolvedValue(true);

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/verify",
      payload: {
        identityAccountId,
        code: "123456",
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        valid: true,
      },
      requestId: "test-request-id",
    });

    expect(totpService.verifyCode).toHaveBeenCalledOnce();

    const input = vi.mocked(totpService.verifyCode).mock.calls[0]![0];

    expect(input.identityAccountId).toBe(identityAccountId);

    expect(input.code).toBe("123456");

    await app.close();
  });

  it("returns 401 for an invalid TOTP code", async () => {
    const totpService = createTotpServiceMock();

    vi.mocked(totpService.verifyCode).mockResolvedValue(false);

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/verify",
      payload: {
        identityAccountId,
        code: "123456",
      },
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_TOTP_CODE",
        message: "Invalid TOTP code",
      },
    });

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const totpService = createTotpServiceMock();

    const app = createApp(totpService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/totp/verify",
      payload: {
        identityAccountId,
        code: "12345",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid TOTP verification request",
      },
    });

    expect(totpService.verifyCode).not.toHaveBeenCalled();

    await app.close();
  });
});
