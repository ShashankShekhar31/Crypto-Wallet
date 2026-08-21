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
  };
}

const VALID_ENVIRONMENTS: Environment[] = [
  "development",
  "test",
  "production",
];

const VALID_LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

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
    throw new Error(
      `Environment variable ${name} must be an integer`,
    );
  }

  return parsed;
}

function urlEnv(name: string): string {
  const value = requiredEnv(name);

  try {
    new URL(value);
  } catch {
    throw new Error(
      `Environment variable ${name} must be a valid URL`,
    );
  }

  return value;
}

function logLevelEnv(): string {
  const value = process.env.LOG_LEVEL?.trim() || "info";

  if (!VALID_LOG_LEVELS.includes(value as (typeof VALID_LOG_LEVELS)[number])) {
    throw new Error(
      `Invalid LOG_LEVEL: ${value}. Expected one of: ${VALID_LOG_LEVELS.join(", ")}`,
    );
  }

  return value;
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
    throw new Error(
      `Environment variable PORT must be between 1 and 65535`,
    );
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
    },
  };
}