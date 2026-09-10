import type { FastifyLoggerOptions } from "fastify";

const REDACTED = "[REDACTED]";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "req.body.refreshToken",
  "req.body.totpCode",
  "req.body.recoveryCode",
  "req.body.seed",
  "req.body.seedPhrase",
  "req.body.mnemonic",
  "req.body.privateKey",
  "req.body.secret",
  "req.body.token",
  "req.body.accessToken",
  "req.body.apiKey",
  "res.headers.set-cookie",
] as const;

export function createLoggerOptions(level: FastifyLoggerOptions["level"]) {
  return {
    ...(level === undefined ? {} : { level }),
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACTED,
    },
  };
}
