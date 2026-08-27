import crypto from "node:crypto";

import Fastify from "fastify";

import {
  connectCacheClient,
  createCacheClient,
  disconnectCacheClient,
} from "@crypto-wallet/cache";

import {
  PostgresStorage,
} from "@crypto-wallet/storage";

import { config } from "./index.js";

import { healthRoutes } from "./routes/health.js";

import {
  createAuthRoutes,
} from "./routes/auth.js";

import { ApiError } from "./errors.js";

import {
  IdentityRepository,
} from "./identity/repository.js";

import {
  DeviceRepository,
} from "./identity/device-repository.js";

import {
  SessionRepository,
} from "./identity/session-repository.js";

import {
  AuthEventRepository,
} from "./identity/auth-event-repository.js";

import {
  LoginRiskService,
} from "./identity/login-risk-service.js";

import {
  AuthenticationService,
} from "./identity/auth-service.js";

import {
  AuthRateLimiter,
} from "./identity/auth-rate-limit.js";

import {
  createRefreshRoutes,
} from "./routes/refresh.js";

import {
  RefreshService,
} from "./identity/refresh-service.js";

const cacheClient = createCacheClient({
  url: config.redis.url,
});

const storage = new PostgresStorage(
  config.database.url,
);

const identityRepository =
  new IdentityRepository(storage);

const deviceRepository =
  new DeviceRepository(storage);

const sessionRepository =
  new SessionRepository(storage);

const authEventRepository =
  new AuthEventRepository(storage);

const loginRiskService =
  new LoginRiskService(
    authEventRepository,
  );

const authenticationService =
  new AuthenticationService(
    identityRepository,
    sessionRepository,
    deviceRepository,
    authEventRepository,
    loginRiskService,
  );

const authRateLimiter =
  new AuthRateLimiter(cacheClient);

const app = Fastify({
  logger: {
    level: config.security.logLevel,
  },
  genReqId: () => crypto.randomUUID(),
});

const refreshService =
  new RefreshService(
    sessionRepository,
  );

app.setErrorHandler(
  (error, request, reply) => {
    request.log.error(error);

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

app.addHook(
  "onClose",
  async () => {
    await disconnectCacheClient(
      cacheClient,
    );

    await storage.disconnect();
  },
);

await app.register(healthRoutes);

await app.register(
  createAuthRoutes({
    authenticationService,
    rateLimiter: authRateLimiter,
  }),
);

await app.register(
  createRefreshRoutes({
    refreshService,
  }),
);

const start = async () => {
  try {
    await storage.connect();

    await connectCacheClient(
      cacheClient,
    );

    await app.listen({
      host: "127.0.0.1",
      port: config.port,
    });
  } catch (error) {
    app.log.error(error);

    await app.close();

    process.exit(1);
  }
};

void start();