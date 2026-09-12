import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import Fastify, { type FastifyRequest } from "fastify";

import { createLoggerOptions } from "../logging.js";

describe("structured logging redaction", () => {
  it("configures redaction for authentication and wallet secrets", () => {
    const options = createLoggerOptions("info");

    expect(options.level).toBe("info");
    expect(options.redact).toEqual({
      paths: [
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
      ],
      censor: "[REDACTED]",
    });
  });

  it("omits an undefined log level instead of emitting an undefined option", () => {
    const options = createLoggerOptions(undefined);

    expect(options).not.toHaveProperty("level");
    expect(options.redact.censor).toBe("[REDACTED]");
  });
  it("redacts sensitive fields through the actual logger", async () => {
    let output = "";

    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const options = createLoggerOptions("info", stream);

    const app = Fastify({
      logger: {
        ...options,
        serializers: {
          req: (req: FastifyRequest) => req as unknown as Record<string, unknown>,
        },
      },
    });

    app.log.info(
      {
        req: {
          headers: {
            authorization: "test-value",
            cookie: "test-value",
          },
          body: {
            password: "test-value",
            refreshToken: "test-value",
            privateKey: "test-value",
          },
        },
      },
      "redaction regression test",
    );

    await app.close();

    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("test-value");
    expect(output).not.toContain("test-value");
    expect(output).not.toContain("test-value");
    expect(output).not.toContain("test-value");
    expect(output).not.toContain("test-value");
  });
});
