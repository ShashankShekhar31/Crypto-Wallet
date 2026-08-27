import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ApiError } from "../errors.js";
import { TotpService } from "../identity/totp-service.js";

const createFactorSchema = z.object({
  identityAccountId: z.string().uuid(),
});

const enableFactorSchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

const disableFactorSchema = z.object({
  factorId: z.string().uuid(),
});

const verifyCodeSchema = z.object({
  identityAccountId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export interface TotpRouteDependencies {
  totpService: TotpService;
}

export function createTotpRoutes(dependencies: TotpRouteDependencies) {
  return async function totpRoutes(app: FastifyInstance): Promise<void> {
    app.post("/auth/totp/setup", async (request) => {
      let body: z.infer<typeof createFactorSchema>;

      try {
        body = createFactorSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid TOTP setup request");
      }

      try {
        const result = await dependencies.totpService.createFactor(body.identityAccountId);

        return {
          data: {
            factorId: result.factor.id,
            secret: result.secret,
            enabledAt: result.factor.enabledAt,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapTotpError(error);
      }
    });

    app.post("/auth/totp/enable", async (request) => {
      let body: z.infer<typeof enableFactorSchema>;

      try {
        body = enableFactorSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid TOTP enable request");
      }

      try {
        const factor = await dependencies.totpService.enableFactor(body.factorId, body.code);

        return {
          data: {
            factorId: factor.id,
            enabled: factor.enabledAt !== null,
            enabledAt: factor.enabledAt,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapTotpError(error);
      }
    });

    app.post("/auth/totp/disable", async (request) => {
      let body: z.infer<typeof disableFactorSchema>;

      try {
        body = disableFactorSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid TOTP disable request");
      }

      try {
        const factor = await dependencies.totpService.disableFactor(body.factorId);

        return {
          data: {
            factorId: factor.id,
            disabled: true,
            disabledAt: factor.disabledAt,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapTotpError(error);
      }
    });

    app.post("/auth/totp/verify", async (request) => {
      let body: z.infer<typeof verifyCodeSchema>;

      try {
        body = verifyCodeSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid TOTP verification request");
      }

      try {
        const valid = await dependencies.totpService.verifyCode({
          identityAccountId: body.identityAccountId,
          code: body.code,
        });

        if (!valid) {
          throw new ApiError(401, "INVALID_TOTP_CODE", "Invalid TOTP code");
        }

        return {
          data: {
            valid: true,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapTotpError(error);
      }
    });
  };
}

function mapTotpError(error: unknown): ApiError | unknown {
  if (error instanceof ApiError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return error;
  }

  switch (error.message) {
    case "TOTP factor not found":
      return new ApiError(404, "TOTP_FACTOR_NOT_FOUND", "TOTP factor not found");

    case "TOTP factor is disabled":
      return new ApiError(409, "TOTP_FACTOR_DISABLED", "TOTP factor is disabled");

    case "Invalid TOTP code":
      return new ApiError(401, "INVALID_TOTP_CODE", "Invalid TOTP code");

    case "TOTP factor not found or already disabled":
      return new ApiError(
        404,
        "TOTP_FACTOR_NOT_FOUND",
        "TOTP factor not found or already disabled",
      );

    case "Identity account ID is required":
      return new ApiError(400, "INVALID_REQUEST", "Identity account ID is required");

    default:
      return error;
  }
}
