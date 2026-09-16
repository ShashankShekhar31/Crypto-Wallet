import crypto from "node:crypto";

import Fastify from "fastify";

import { connectCacheClient, createCacheClient, disconnectCacheClient } from "@crypto-wallet/cache";

import { PostgresStorage } from "@crypto-wallet/storage";

import { config } from "./index.js";

import { healthRoutes } from "./routes/health.js";

import { createAuthRoutes } from "./routes/auth.js";

import { ApiError } from "./errors.js";

import { IdentityRepository } from "./identity/repository.js";

import { DeviceRepository } from "./identity/device-repository.js";

import { SessionRepository } from "./identity/session-repository.js";

import { AuthEventRepository } from "./identity/auth-event-repository.js";

import { LoginRiskService } from "./identity/login-risk-service.js";

import { AuthenticationService } from "./identity/auth-service.js";

import { AuthRateLimiter } from "./identity/auth-rate-limit.js";

import { createRefreshRoutes } from "./routes/refresh.js";

import { RefreshService } from "./identity/refresh-service.js";

import { LogoutService } from "./identity/logout-service.js";

import { createLogoutRoutes } from "./routes/logout.js";

import { createTotpRoutes } from "./routes/totp.js";

import { TotpService } from "./identity/totp-service.js";

import { TotpRepository } from "./identity/totp-repository.js";

import { SecretEncryption } from "./identity/secret-encryption.js";

import { createRecoveryRoutes } from "./routes/recovery.js";

import { RecoveryCodeRepository } from "./identity/recovery-code-repository.js";

import { RecoveryCodeService } from "./identity/recovery-service.js";

import { createPasskeyRoutes } from "./routes/passkey.js";

import { PasskeyChallengeStore } from "./identity/passkey-challenge-store.js";

import { PasskeyService } from "./identity/passkey-service.js";

import { PasskeyRepository } from "./identity/passkey-repository.js";

import { createLoggerOptions } from "./logging.js";

import { createTelemetrySdk } from "./telemetry.js";

import { recordHttpRequest, recordHttpResponse } from "./metrics.js";

import { KafkaEventPublisher } from "./messaging/event-publisher.js";

import { OutboxPublisher } from "./messaging/outbox-publisher.js";

import { OutboxWorker } from "./messaging/outbox-worker.js";

import { KafkaEventConsumer } from "./messaging/event-consumer.js";

import { createExchangeDepositEventHandler } from "./messaging/exchange-deposit-handler.js";

import { createTemporalClient } from "./temporal/client.js";

import swagger from "@fastify/swagger";

import swaggerUi from "@fastify/swagger-ui";

const cacheClient = createCacheClient({
  url: config.redis.url,
});

const storage = new PostgresStorage(config.database.url);

const eventPublisher = new KafkaEventPublisher({
  messaging: config.messaging,
});

const outboxPublisher = new OutboxPublisher(storage, eventPublisher);

const outboxWorker = new OutboxWorker(outboxPublisher);

const temporalClient = await createTemporalClient();

const eventConsumer = new KafkaEventConsumer({
  messaging: config.messaging,
  storage,
  consumerName: "exchange-deposit-temporal",
  handler: createExchangeDepositEventHandler({
    temporalClient,
  }),
});

const identityRepository = new IdentityRepository(storage);

const deviceRepository = new DeviceRepository(storage);

const sessionRepository = new SessionRepository(storage);

const authEventRepository = new AuthEventRepository(storage);

const loginRiskService = new LoginRiskService(authEventRepository);

const authenticationService = new AuthenticationService(
  identityRepository,
  sessionRepository,
  deviceRepository,
  authEventRepository,
  loginRiskService,
);

const authRateLimiter = new AuthRateLimiter(cacheClient);

const telemetrySdk = createTelemetrySdk();
await telemetrySdk.start();

const app = Fastify({
  logger: createLoggerOptions(config.security.logLevel),
  genReqId: () => crypto.randomUUID(),
});

await app.register(swagger, {
  openapi: {
    openapi: "3.0.3",
    info: {
      title: "Crypto Wallet API",
      description: "Security-first Crypto Wallet API",
      version: "0.1.0",
    },
    servers: [
      {
        url: `http://127.0.0.1:${config.port}`,
        description: "Local development server",
      },
    ],
    tags: [
      {
        name: "health",
        description: "Health and service status",
      },
      {
        name: "auth",
        description: "Authentication and session management",
      },
      {
        name: "security",
        description: "TOTP, passkey, and account recovery",
      },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
});

app.addHook("onClose", async () => {
  await telemetrySdk.shutdown();
  await eventConsumer.disconnect();
  await outboxWorker.stop();
  await eventPublisher.disconnect();

  await temporalClient.connection.close();

  await disconnectCacheClient(cacheClient);
  await storage.disconnect();
});

app.addHook("onRequest", async (request) => {
  request.metricsStartTime = process.hrtime.bigint();

  recordHttpRequest(request.method);
});

app.addHook("onResponse", async (request, reply) => {
  const startTime = request.metricsStartTime;

  if (startTime === undefined) {
    return;
  }

  const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

  recordHttpResponse(request.method, reply.statusCode, durationMs);
});

const refreshService = new RefreshService(sessionRepository);

const logoutService = new LogoutService(sessionRepository);

const totpRepository = new TotpRepository(storage);

const secretEncryption = new SecretEncryption(
  Buffer.from(config.security.totpEncryptionKey, "base64"),
  config.security.totpEncryptionKeyVersion,
);

const totpService = new TotpService({
  secretEncryption,
  repository: totpRepository,
});

const passkeyChallengeStore = new PasskeyChallengeStore(cacheClient);

const passkeyService = new PasskeyService({
  identityRepository,
  passkeyRepository: new PasskeyRepository(storage),
  challengeStore: passkeyChallengeStore,
  rpId: config.security.passkeyRpId,
  rpName: config.security.passkeyRpName,
  origin: config.security.passkeyOrigin,
});

const recoveryCodeRepository = new RecoveryCodeRepository(storage);

const recoveryCodeService = new RecoveryCodeService({
  repository: recoveryCodeRepository,
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof Error && "code" in error && error.code === "FST_ERR_VALIDATION") {
    return reply.status(400).send({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid request",
      },
    });
  }

  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return reply.status(error.statusCode).send({
      error: {
        code: "BAD_REQUEST",
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

await app.register(healthRoutes);

await app.register(
  createAuthRoutes({
    authenticationService,
    rateLimiter: authRateLimiter,
  }),
  { prefix: "/api/v1" },
);

await app.register(
  createRefreshRoutes({
    refreshService,
  }),
  { prefix: "/api/v1" },
);

await app.register(
  createLogoutRoutes({
    logoutService,
  }),
  { prefix: "/api/v1" },
);

await app.register(
  createTotpRoutes({
    totpService,
  }),
  { prefix: "/api/v1" },
);

await app.register(
  createPasskeyRoutes({
    passkeyService,
  }),
  { prefix: "/api/v1" },
);

await app.register(
  createRecoveryRoutes({
    recoveryCodeService,
  }),
  { prefix: "/api/v1" },
);

const start = async () => {
  try {
    await storage.connect();

    await connectCacheClient(cacheClient);

    await eventPublisher.connect();
    await outboxWorker.start();
    await eventConsumer.connect();

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
