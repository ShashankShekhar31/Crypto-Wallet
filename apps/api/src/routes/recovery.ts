import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ApiError } from "../errors.js";
import { RecoveryCodeService } from "../identity/recovery-service.js";

const identityAccountSchema = z.object({
  identityAccountId: z.string().uuid(),
});

const consumeCodeSchema = z.object({
  identityAccountId: z.string().uuid(),
  code: z.string().min(1),
});

export interface RecoveryRouteDependencies {
  recoveryCodeService: RecoveryCodeService;
}

export function createRecoveryRoutes(dependencies: RecoveryRouteDependencies) {
  return async function recoveryRoutes(app: FastifyInstance): Promise<void> {
    app.post("/auth/recovery/setup", async (request) => {
      let body: z.infer<typeof identityAccountSchema>;

      try {
        body = identityAccountSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid recovery setup request");
      }

      try {
        const result = await dependencies.recoveryCodeService.createCodes(body.identityAccountId);

        return {
          data: {
            codes: result.codes,
            count: result.count,
          },
          requestId: request.id,
        };
      } catch (error) {
        throw mapRecoveryError(error);
      }
    });

    app.post("/auth/recovery/consume", async (request) => {
      let body: z.infer<typeof consumeCodeSchema>;

      try {
        body = consumeCodeSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid recovery code request");
      }

      try {
        const result = await dependencies.recoveryCodeService.consumeCode(
          body.identityAccountId,
          body.code,
        );

        return {
          data: result,
          requestId: request.id,
        };
      } catch (error) {
        throw mapRecoveryError(error);
      }
    });

    app.post("/auth/recovery/status", async (request) => {
      let body: z.infer<typeof identityAccountSchema>;

      try {
        body = identityAccountSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid recovery status request");
      }

      try {
        const result = await dependencies.recoveryCodeService.getStatus(body.identityAccountId);

        return {
          data: result,
          requestId: request.id,
        };
      } catch (error) {
        throw mapRecoveryError(error);
      }
    });

    app.post("/auth/recovery/revoke", async (request) => {
      let body: z.infer<typeof identityAccountSchema>;

      try {
        body = identityAccountSchema.parse(request.body);
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid recovery revoke request");
      }

      try {
        const result = await dependencies.recoveryCodeService.revokeCodes(body.identityAccountId);

        return {
          data: result,
          requestId: request.id,
        };
      } catch (error) {
        throw mapRecoveryError(error);
      }
    });
  };
}

function mapRecoveryError(error: unknown): ApiError | unknown {
  if (error instanceof ApiError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return error;
  }

  switch (error.message) {
    case "Identity account ID is required":
      return new ApiError(400, "INVALID_REQUEST", "Identity account ID is required");

    case "Recovery code is required":
      return new ApiError(400, "INVALID_REQUEST", "Recovery code is required");

    case "Invalid or already used recovery code":
      return new ApiError(401, "INVALID_RECOVERY_CODE", "Invalid or already used recovery code");

    default:
      return error;
  }
}
