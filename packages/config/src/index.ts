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

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  const environment =
    (process.env.NODE_ENV as Environment | undefined) ?? "development";

  if (!["development", "test", "production"].includes(environment)) {
    throw new Error(`Invalid NODE_ENV: ${environment}`);
  }

  return {
    environment,
    nodeEnv: environment,

    port: numberEnv("PORT", 3000),

    database: {
      url: requiredEnv("DATABASE_URL"),
    },

    redis: {
      url: requiredEnv("REDIS_URL"),
    },

    security: {
      logLevel: process.env.LOG_LEVEL ?? "info",
    },
  };
}
