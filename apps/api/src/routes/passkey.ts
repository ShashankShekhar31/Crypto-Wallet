import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ApiError } from "../errors.js";
import { PasskeyService } from "../identity/passkey-service.js";

import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

const ceremonySchema = z.object({
  ceremonyId: z.string().uuid(),
});

const registrationOptionsSchema = z.object({
  identityAccountId: z.string().uuid(),
});

const authenticationOptionsSchema = z.object({
  identityAccountId: z.string().uuid(),
});

const registrationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    transports: z.array(z.string()).optional(),
  }),
  type: z.string().min(1),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  authenticatorAttachment: z.string().optional(),
});

const authenticationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().nullable().optional(),
  }),
  type: z.string().min(1),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  authenticatorAttachment: z.string().optional(),
});

const finishRegistrationSchema = ceremonySchema.extend({
  response: registrationResponseSchema,
});

const finishAuthenticationSchema = ceremonySchema.extend({
  response: authenticationResponseSchema,
});

export interface PasskeyRouteDependencies {
  passkeyService: PasskeyService;
}

export function createPasskeyRoutes(dependencies: PasskeyRouteDependencies) {
  return async function passkeyRoutes(app: FastifyInstance): Promise<void> {
    app.post("/auth/passkey/register/options", async (request) => {
      let body: z.infer<typeof registrationOptionsSchema>;

      try {
        body = registrationOptionsSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid passkey registration options request");
      }

      try {
        const result = await dependencies.passkeyService.startRegistration({
          identityAccountId: body.identityAccountId,
        });

        return {
          data: {
            ceremonyId: result.ceremonyId,
            options: result.options,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapPasskeyError(error);
      }
    });

    app.post("/auth/passkey/register/verify", async (request) => {
      let body: z.infer<typeof finishRegistrationSchema>;

      try {
        body = finishRegistrationSchema.parse(request.body);
      } catch {
        throw new ApiError(
          400,
          "INVALID_REQUEST",
          "Invalid passkey registration verification request",
        );
      }

      try {
        const result = await dependencies.passkeyService.finishRegistration({
          ceremonyId: body.ceremonyId,
          response: body.response as RegistrationResponseJSON,
        });

        return {
          data: {
            identityAccountId: result.identityAccount.id,
            passkeyId: result.passkey.id,
            createdAt: result.passkey.createdAt,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapPasskeyError(error);
      }
    });

    app.post("/auth/passkey/authenticate/options", async (request) => {
      let body: z.infer<typeof authenticationOptionsSchema>;

      try {
        body = authenticationOptionsSchema.parse(request.body);
      } catch {
        throw new ApiError(
          400,
          "INVALID_REQUEST",
          "Invalid passkey authentication options request",
        );
      }

      try {
        const result = await dependencies.passkeyService.startAuthentication({
          identityAccountId: body.identityAccountId,
        });

        return {
          data: {
            ceremonyId: result.ceremonyId,
            options: result.options,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapPasskeyError(error);
      }
    });

    app.post("/auth/passkey/authenticate/verify", async (request) => {
      let body: z.infer<typeof finishAuthenticationSchema>;

      try {
        body = finishAuthenticationSchema.parse(request.body);
      } catch {
        throw new ApiError(
          400,
          "INVALID_REQUEST",
          "Invalid passkey authentication verification request",
        );
      }

      try {
        const result = await dependencies.passkeyService.finishAuthentication({
          ceremonyId: body.ceremonyId,
          response: body.response as AuthenticationResponseJSON,
        });

        return {
          data: {
            identityAccountId: result.identityAccountId,
            passkeyId: result.passkey?.id ?? null,
            authenticated: true,
            lastUsedAt: result.passkey?.lastUsedAt ?? null,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapPasskeyError(error);
      }
    });
  };
}

function mapPasskeyError(error: unknown): ApiError | unknown {
  if (error instanceof ApiError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return error;
  }

  switch (error.message) {
    case "Identity account ID is required":
      return new ApiError(400, "INVALID_REQUEST", "Identity account ID is required");

    case "Passkey ceremony ID is required":
      return new ApiError(400, "INVALID_REQUEST", "Passkey ceremony ID is required");

    case "Identity account not found":
      return new ApiError(404, "IDENTITY_ACCOUNT_NOT_FOUND", "Identity account not found");

    case "Identity account is not active":
      return new ApiError(409, "IDENTITY_ACCOUNT_NOT_ACTIVE", "Identity account is not active");

    case "No active passkey found":
      return new ApiError(404, "PASSKEY_NOT_FOUND", "No active passkey found");

    case "Passkey credential not found":
      return new ApiError(401, "PASSKEY_CREDENTIAL_NOT_FOUND", "Passkey credential not found");

    case "Passkey credential is revoked":
      return new ApiError(401, "PASSKEY_REVOKED", "Passkey credential is revoked");

    case "Passkey credential does not belong to identity account":
      return new ApiError(
        403,
        "PASSKEY_IDENTITY_MISMATCH",
        "Passkey credential does not belong to identity account",
      );

    case "Passkey challenge not found or expired":
      return new ApiError(
        401,
        "PASSKEY_CHALLENGE_INVALID",
        "Passkey challenge not found or expired",
      );

    case "Invalid passkey ceremony type":
      return new ApiError(400, "INVALID_PASSKEY_CEREMONY", "Invalid passkey ceremony type");

    case "Passkey identity account is missing":
      return new ApiError(400, "INVALID_PASSKEY_CEREMONY", "Passkey identity account is missing");

    case "Passkey credential already exists":
      return new ApiError(409, "PASSKEY_ALREADY_EXISTS", "Passkey credential already exists");

    case "Passkey registration verification failed":
      return new ApiError(
        401,
        "PASSKEY_REGISTRATION_FAILED",
        "Passkey registration verification failed",
      );

    case "Passkey registration information is missing":
      return new ApiError(
        500,
        "PASSKEY_REGISTRATION_FAILED",
        "Passkey registration information is missing",
      );

    case "Passkey authentication verification failed":
      return new ApiError(
        401,
        "PASSKEY_AUTHENTICATION_FAILED",
        "Passkey authentication verification failed",
      );

    case "Passkey signature counter rollback detected":
      return new ApiError(
        401,
        "PASSKEY_COUNTER_ROLLBACK",
        "Passkey signature counter rollback detected",
      );

    case "Failed to update passkey signature counter":
      return new ApiError(
        500,
        "PASSKEY_UPDATE_FAILED",
        "Failed to update passkey signature counter",
      );

    case "Failed to mark passkey as used":
      return new ApiError(500, "PASSKEY_UPDATE_FAILED", "Failed to mark passkey as used");

    default:
      return error;
  }
}
