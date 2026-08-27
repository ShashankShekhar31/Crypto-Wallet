import { createHash } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  AuthenticationService,
} from "../identity/auth-service.js";

import {
  AuthRateLimiter,
} from "../identity/auth-rate-limit.js";

import { ApiError } from "../errors.js";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_SECONDS = 60;

const SESSION_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;

const SESSION_IDLE_DURATION_MS =
  7 * 24 * 60 * 60 * 1000;

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  deviceId: z.string().uuid(),
});

export interface AuthRouteDependencies {
  authenticationService: AuthenticationService;
  rateLimiter: AuthRateLimiter;
}

export function createAuthRoutes(
  dependencies: AuthRouteDependencies,
) {
  return async function authRoutes(
    app: FastifyInstance,
  ): Promise<void> {
    app.post(
      "/auth/login",
      async (request) => {
        let body: z.infer<typeof loginBodySchema>;
          try {
            body = loginBodySchema.parse(request.body);
        } catch {
            throw new ApiError(
                400,
                "INVALID_REQUEST",
                "Invalid login request",
            );
        }

        const normalizedEmail =
          body.email.toLowerCase();

        const sourceIpHash =
          createHash("sha256")
            .update(request.ip)
            .digest("hex");

        const rateLimitKey =
          createHash("sha256")
            .update(
              `${normalizedEmail}:${sourceIpHash}`,
            )
            .digest("hex");

        const rateLimit =
          await dependencies.rateLimiter.check(
            {
              key: `auth:login:${rateLimitKey}`,
              limit: LOGIN_RATE_LIMIT,
              windowSeconds:
                LOGIN_RATE_WINDOW_SECONDS,
            },
          );

        if (!rateLimit.allowed) {
          throw new ApiError(
            429,
            "AUTH_RATE_LIMITED",
            "Authentication rate limit exceeded",
          );
        }

        const now = Date.now();

        const expiresAt = new Date(
          now + SESSION_DURATION_MS,
        );

        const idleExpiresAt = new Date(
          now + SESSION_IDLE_DURATION_MS,
        );

        try {
          const authenticated =
            await dependencies
              .authenticationService
              .authenticateWithPassword({
                normalizedEmail,
                password: body.password,
                deviceId: body.deviceId,
                sourceIpHash,
                userAgent:
                  request.headers[
                    "user-agent"
                  ] ?? null,
                expiresAt,
                idleExpiresAt,
              });

          return {
            data: {
              userId:
                authenticated
                  .identityAccount
                  .userId,
              sessionId:
                authenticated.session.id,
              refreshToken:
                authenticated.refreshToken,
            },
            requestId: request.id,
          };
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }

          if (error instanceof Error) {
            switch (error.message) {
              case "Invalid credentials":
                throw new ApiError(
                  401,
                  "INVALID_CREDENTIALS",
                  "Invalid credentials",
                );

              case "Identity account is not active":
                throw new ApiError(
                  403,
                  "IDENTITY_ACCOUNT_NOT_ACTIVE",
                  "Identity account is not active",
                );

              case "Password credential is locked":
                throw new ApiError(
                  423,
                  "PASSWORD_LOCKED",
                  "Password credential is locked",
                );

              case "Invalid device":
                throw new ApiError(
                  401,
                  "INVALID_DEVICE",
                  "Invalid device",
                );

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