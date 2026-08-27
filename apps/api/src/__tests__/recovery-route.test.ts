import Fastify, {
  type FastifyInstance,
} from "fastify";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  RecoveryCodeService,
} from "../identity/recovery-service.js";

import {
  createRecoveryRoutes,
} from "../routes/recovery.js";

function createRecoveryServiceMock() {
  return {
    createCodes: vi.fn(),
    consumeCode: vi.fn(),
    getStatus: vi.fn(),
    revokeCodes: vi.fn(),
  } as unknown as RecoveryCodeService;
}

function createApp(
  recoveryCodeService: RecoveryCodeService,
): FastifyInstance {
  const app = Fastify({
    genReqId: () => "test-request-id",
  });

  app.setErrorHandler(
    (error, _request, reply) => {
      const apiError = error as {
        statusCode?: number;
        code?: string;
        message: string;
      };

      if (
        typeof apiError.statusCode === "number" &&
        typeof apiError.code === "string"
      ) {
        return reply
          .status(apiError.statusCode)
          .send({
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
    },
  );

  app.register(
    createRecoveryRoutes({
      recoveryCodeService,
    }),
  );

  return app;
}

const identityAccountId =
  "00000000-0000-4000-8000-000000000001";

describe("POST /auth/recovery/setup", () => {
  it("creates recovery codes successfully", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    const codes = [
      "11111111-22222222-33333333-44444444",
      "aaaaaaaa-bbbbbbbb-cccccccc-dddddddd",
    ];

    vi.mocked(
      recoveryCodeService.createCodes,
    ).mockResolvedValue({
      codes,
      count: codes.length,
    });

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/setup",
        payload: {
          identityAccountId,
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        codes,
        count: 2,
      },
      requestId: "test-request-id",
    });

    expect(
      recoveryCodeService.createCodes,
    ).toHaveBeenCalledOnce();

    expect(
      vi.mocked(
        recoveryCodeService.createCodes,
      ).mock.calls[0]![0],
    ).toBe(identityAccountId);

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/setup",
        payload: {
          identityAccountId: "invalid-id",
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid recovery setup request",
      },
    });

    expect(
      recoveryCodeService.createCodes,
    ).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /auth/recovery/consume", () => {
  it("consumes a recovery code successfully", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    vi.mocked(
      recoveryCodeService.consumeCode,
    ).mockResolvedValue({
      consumed: true,
    });

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/consume",
        payload: {
          identityAccountId,
          code: "11111111-22222222-33333333-44444444",
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        consumed: true,
      },
      requestId: "test-request-id",
    });

    expect(
      recoveryCodeService.consumeCode,
    ).toHaveBeenCalledOnce();

    const call =
      vi.mocked(
        recoveryCodeService.consumeCode,
      ).mock.calls[0]!;

    expect(call[0]).toBe(identityAccountId);

    expect(call[1]).toBe(
      "11111111-22222222-33333333-44444444",
    );

    await app.close();
  });

  it("returns 401 for an invalid recovery code", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    vi.mocked(
      recoveryCodeService.consumeCode,
    ).mockRejectedValue(
      new Error(
        "Invalid or already used recovery code",
      ),
    );

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/consume",
        payload: {
          identityAccountId,
          code: "11111111-22222222-33333333-44444444",
        },
      });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_RECOVERY_CODE",
        message:
          "Invalid or already used recovery code",
      },
    });

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/consume",
        payload: {
          identityAccountId,
          code: "",
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid recovery code request",
      },
    });

    expect(
      recoveryCodeService.consumeCode,
    ).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /auth/recovery/status", () => {
  it("returns the remaining recovery-code count", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    vi.mocked(
      recoveryCodeService.getStatus,
    ).mockResolvedValue({
      remaining: 7,
    });

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/status",
        payload: {
          identityAccountId,
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        remaining: 7,
      },
      requestId: "test-request-id",
    });

    expect(
      recoveryCodeService.getStatus,
    ).toHaveBeenCalledOnce();

    expect(
      vi.mocked(
        recoveryCodeService.getStatus,
      ).mock.calls[0]![0],
    ).toBe(identityAccountId);

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/status",
        payload: {
          identityAccountId: "invalid-id",
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid recovery status request",
      },
    });

    expect(
      recoveryCodeService.getStatus,
    ).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /auth/recovery/revoke", () => {
  it("revokes unused recovery codes successfully", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    vi.mocked(
      recoveryCodeService.revokeCodes,
    ).mockResolvedValue({
      revokedCount: 7,
    });

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/revoke",
        payload: {
          identityAccountId,
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        revokedCount: 7,
      },
      requestId: "test-request-id",
    });

    expect(
      recoveryCodeService.revokeCodes,
    ).toHaveBeenCalledOnce();

    expect(
      vi.mocked(
        recoveryCodeService.revokeCodes,
      ).mock.calls[0]![0],
    ).toBe(identityAccountId);

    await app.close();
  });

  it("returns 400 for an invalid request body", async () => {
    const recoveryCodeService =
      createRecoveryServiceMock();

    const app = createApp(
      recoveryCodeService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/recovery/revoke",
        payload: {
          identityAccountId: "invalid-id",
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid recovery revoke request",
      },
    });

    expect(
      recoveryCodeService.revokeCodes,
    ).not.toHaveBeenCalled();

    await app.close();
  });
});