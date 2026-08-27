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
  createPasskeyRoutes,
} from "../routes/passkey.js";

import type {
  PasskeyService,
} from "../identity/passkey-service.js";

function createPasskeyServiceMock() {
  return {
    startRegistration: vi.fn(),
    finishRegistration: vi.fn(),
    startAuthentication: vi.fn(),
    finishAuthentication: vi.fn(),
  } as unknown as PasskeyService;
}

async function createApp(
  passkeyService: PasskeyService,
): Promise<FastifyInstance> {
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
        typeof apiError.statusCode ===
          "number" &&
        typeof apiError.code ===
          "string"
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

  await app.register(
    createPasskeyRoutes({
      passkeyService,
    }),
  );

  return app;
}

function validRegistrationResponse() {
  return {
    id: "credential-id",
    rawId: "credential-id",
    response: {
      clientDataJSON: "client-data",
      attestationObject: "attestation-object",
    },
    type: "public-key",
    clientExtensionResults: {},
  };
}

function validAuthenticationResponse() {
  return {
    id: "credential-id",
    rawId: "credential-id",
    response: {
      clientDataJSON: "client-data",
      authenticatorData: "authenticator-data",
      signature: "signature",
    },
    type: "public-key",
    clientExtensionResults: {},
  };
}

describe("Passkey routes", () => {
  it("starts passkey registration successfully", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    vi.mocked(
      passkeyService.startRegistration,
    ).mockResolvedValue({
      ceremonyId:
        "00000000-0000-4000-8000-000000000001",
      options: {
        challenge: "registration-challenge",
      } as never,
    });

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/register/options",
        payload: {
          identityAccountId:
            "00000000-0000-4000-8000-000000000002",
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        ceremonyId:
          "00000000-0000-4000-8000-000000000001",
        options: {
          challenge: "registration-challenge",
        },
      },
      requestId: "test-request-id",
    });

    expect(
      passkeyService.startRegistration,
    ).toHaveBeenCalledWith({
      identityAccountId:
        "00000000-0000-4000-8000-000000000002",
    });
  });

  it("rejects invalid registration options requests", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/register/options",
        payload: {
          identityAccountId: "not-a-uuid",
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid passkey registration options request",
      },
    });

    expect(
      passkeyService.startRegistration,
    ).not.toHaveBeenCalled();
  });

  it("finishes passkey registration successfully", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    const createdAt = new Date(
      "2026-08-27T12:00:00.000Z",
    );

    vi.mocked(
      passkeyService.finishRegistration,
    ).mockResolvedValue({
      identityAccount: {
        id: "identity-id",
        userId: "user-id",
        normalizedEmail:
          "user@example.com",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      passkey: {
        id: "passkey-id",
        identityAccountId:
          "identity-id",
        credentialId: Buffer.from(
          "credential-id",
        ),
        publicKey: Buffer.from(
          "public-key",
        ),
        signCount: 0,
        backedUp: true,
        createdAt,
        lastUsedAt: null,
        revokedAt: null,
      },
    });

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/register/verify",
        payload: {
          ceremonyId:
            "00000000-0000-4000-8000-000000000001",
          response:
            validRegistrationResponse(),
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        identityAccountId: "identity-id",
        passkeyId: "passkey-id",
        createdAt:
          "2026-08-27T12:00:00.000Z",
      },
      requestId: "test-request-id",
    });

    expect(
      passkeyService.finishRegistration,
    ).toHaveBeenCalledOnce();
  });

  it("starts passkey authentication successfully", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    vi.mocked(
      passkeyService.startAuthentication,
    ).mockResolvedValue({
      ceremonyId:
        "00000000-0000-4000-8000-000000000003",
      options: {
        challenge:
          "authentication-challenge",
      } as never,
    });

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/options",
        payload: {
          identityAccountId:
            "00000000-0000-4000-8000-000000000002",
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        ceremonyId:
          "00000000-0000-4000-8000-000000000003",
        options: {
          challenge:
            "authentication-challenge",
        },
      },
      requestId: "test-request-id",
    });

    expect(
      passkeyService.startAuthentication,
    ).toHaveBeenCalledWith({
      identityAccountId:
        "00000000-0000-4000-8000-000000000002",
    });
  });

  it("rejects invalid authentication options requests", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/options",
        payload: {
          identityAccountId: "invalid",
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid passkey authentication options request",
      },
    });

    expect(
      passkeyService.startAuthentication,
    ).not.toHaveBeenCalled();
  });

  it("finishes passkey authentication successfully", async () => {
    const lastUsedAt = new Date(
      "2026-08-27T12:05:00.000Z",
    );

    const passkeyService =
      createPasskeyServiceMock();

    vi.mocked(
      passkeyService.finishAuthentication,
    ).mockResolvedValue({
      identityAccountId:
        "identity-id",
      passkey: {
        id: "passkey-id",
        identityAccountId:
          "identity-id",
        credentialId: Buffer.from(
          "credential-id",
        ),
        publicKey: Buffer.from(
          "public-key",
        ),
        signCount: 4,
        backedUp: true,
        createdAt: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        lastUsedAt,
        revokedAt: null,
      },
    });

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/verify",
        payload: {
          ceremonyId:
            "00000000-0000-4000-8000-000000000003",
          response:
            validAuthenticationResponse(),
        },
      });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: {
        identityAccountId:
          "identity-id",
        passkeyId: "passkey-id",
        authenticated: true,
        lastUsedAt:
          "2026-08-27T12:05:00.000Z",
      },
      requestId: "test-request-id",
    });

    expect(
      passkeyService.finishAuthentication,
    ).toHaveBeenCalledWith({
      ceremonyId:
        "00000000-0000-4000-8000-000000000003",
      response:
        validAuthenticationResponse(),
    });
  });

  it("maps passkey credential errors correctly", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    vi.mocked(
      passkeyService.finishAuthentication,
    ).mockRejectedValue(
      new Error(
        "Passkey credential not found",
      ),
    );

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/verify",
        payload: {
          ceremonyId:
            "00000000-0000-4000-8000-000000000003",
          response:
            validAuthenticationResponse(),
        },
      });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code:
          "PASSKEY_CREDENTIAL_NOT_FOUND",
        message:
          "Passkey credential not found",
      },
    });
  });

  it("maps identity mismatch errors correctly", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    vi.mocked(
      passkeyService.finishAuthentication,
    ).mockRejectedValue(
      new Error(
        "Passkey credential does not belong to identity account",
      ),
    );

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/verify",
        payload: {
          ceremonyId:
            "00000000-0000-4000-8000-000000000003",
          response:
            validAuthenticationResponse(),
        },
      });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      error: {
        code:
          "PASSKEY_IDENTITY_MISMATCH",
        message:
          "Passkey credential does not belong to identity account",
      },
    });
  });

  it("maps invalid passkey ceremony errors correctly", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    vi.mocked(
      passkeyService.finishAuthentication,
    ).mockRejectedValue(
      new Error(
        "Passkey challenge not found or expired",
      ),
    );

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/verify",
        payload: {
          ceremonyId:
            "00000000-0000-4000-8000-000000000003",
          response:
            validAuthenticationResponse(),
        },
      });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: {
        code:
          "PASSKEY_CHALLENGE_INVALID",
        message:
          "Passkey challenge not found or expired",
      },
    });
  });

  it("rejects malformed authentication verification requests", async () => {
    const passkeyService =
      createPasskeyServiceMock();

    const app = await createApp(
      passkeyService,
    );

    const response =
      await app.inject({
        method: "POST",
        url: "/auth/passkey/authenticate/verify",
        payload: {
          ceremonyId: "not-a-uuid",
          response: {},
        },
      });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Invalid passkey authentication verification request",
      },
    });

    expect(
      passkeyService.finishAuthentication,
    ).not.toHaveBeenCalled();
  });
});