import { describe, expect, it } from "vitest";

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
});
