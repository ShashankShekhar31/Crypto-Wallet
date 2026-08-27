export type Environment = "development" | "test" | "production";

export interface AppConfig {
  environment: Environment;
  nodeEnv: string;
  port: number;

  database: {
    url: string;
  };

  redis: {
    url: string;
  };

  security: {
    logLevel: string;
    totpEncryptionKey: string;
    totpEncryptionKeyVersion: string;
    passkeyRpId: string;
    passkeyRpName: string;
    passkeyOrigin: string;
  };
}

const VALID_ENVIRONMENTS: Environment[] = ["development", "test", "production"];

const VALID_LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }

  return parsed;
}

function urlEnv(name: string): string {
  const value = requiredEnv(name);

  try {
    new URL(value);
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }

  return value;
}

function logLevelEnv(): string {
  const value = process.env.LOG_LEVEL?.trim() || "info";

  if (!VALID_LOG_LEVELS.includes(value as (typeof VALID_LOG_LEVELS)[number])) {
    throw new Error(`Invalid LOG_LEVEL: ${value}. Expected one of: ${VALID_LOG_LEVELS.join(", ")}`);
  }

  return value;
}

function secretKeyEnv(name: string): string {
  const value = requiredEnv(name);

  const key = Buffer.from(value, "base64");

  if (key.length !== 32) {
    throw new Error(
      `Environment variable ${name} must decode to exactly 32 bytes`,
    );
  }

  return value;
}

function passkeyRpIdEnv(): string {
  const value =
    process.env.PASSKEY_RP_ID?.trim() ||
    "localhost";

  if (
    value.length === 0 ||
    value.includes("/") ||
    value.includes(":") ||
    value.includes("://")
  ) {
    throw new Error(
      "Environment variable PASSKEY_RP_ID must be a valid RP ID",
    );
  }

  return value;
}

function passkeyOriginEnv(): string {
  const value =
    process.env.PASSKEY_ORIGIN?.trim() ||
    "http://localhost:3000";

  try {
    const url = new URL(value);

    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Environment variable PASSKEY_ORIGIN must be a valid origin",
    );
  }

  return value;
}

function passkeyRpNameEnv(): string {
  return (
    process.env.PASSKEY_RP_NAME?.trim() ||
    "Crypto Wallet"
  );
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";

  if (!VALID_ENVIRONMENTS.includes(nodeEnv as Environment)) {
    throw new Error(
      `Invalid NODE_ENV: ${nodeEnv}. Expected one of: ${VALID_ENVIRONMENTS.join(", ")}`,
    );
  }

  const port = numberEnv("PORT", 3000);

  if (port < 1 || port > 65535) {
    throw new Error(`Environment variable PORT must be between 1 and 65535`);
  }

  return {
    environment: nodeEnv as Environment,
    nodeEnv,

    port,

    database: {
      url: urlEnv("DATABASE_URL"),
    },

    redis: {
      url: urlEnv("REDIS_URL"),
    },

    security: {
      logLevel: logLevelEnv(),
      totpEncryptionKey: secretKeyEnv(
        "TOTP_ENCRYPTION_KEY",
      ),
      totpEncryptionKeyVersion:
        process.env.TOTP_ENCRYPTION_KEY_VERSION?.trim() ||
        "v1",
      passkeyRpId: passkeyRpIdEnv(),

      passkeyRpName: passkeyRpNameEnv(),

      passkeyOrigin: passkeyOriginEnv(),
    },
  };
}
