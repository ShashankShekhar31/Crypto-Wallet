import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { FastifyLoggerOptions } from "fastify";

const REDACTED = "[REDACTED]";

const LOG_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../logs/api.log");

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

function createLogStream(): Writable {
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  const fileStream = createWriteStream(LOG_FILE, {
    flags: "a",
  });

  return new Writable({
    write(chunk, encoding, callback) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);

      process.stdout.write(data);
      fileStream.write(data, callback);
    },

    final(callback) {
      fileStream.end(callback);
    },
  });
}

export function createLoggerOptions(
  level: FastifyLoggerOptions["level"],
  stream: Writable = createLogStream(),
) {
  return {
    ...(level === undefined ? {} : { level }),
    stream,
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACTED,
    },
  };
}
