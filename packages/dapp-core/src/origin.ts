export type DAppOrigin = string;

export class InvalidDAppOriginError extends Error {
  constructor(origin: string) {
    super(`Invalid dApp origin: ${origin}`);
    this.name = "InvalidDAppOriginError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeDAppOrigin(origin: string): DAppOrigin {
  const trimmedOrigin = origin.trim();

  if (trimmedOrigin.length === 0) {
    throw new InvalidDAppOriginError(origin);
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmedOrigin);
  } catch {
    throw new InvalidDAppOriginError(origin);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new InvalidDAppOriginError(origin);
  }

  if (parsed.username || parsed.password) {
    throw new InvalidDAppOriginError(origin);
  }

  if (!parsed.hostname) {
    throw new InvalidDAppOriginError(origin);
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new InvalidDAppOriginError(origin);
  }

  return parsed.origin;
}

export function isSameDAppOrigin(firstOrigin: string, secondOrigin: string): boolean {
  return normalizeDAppOrigin(firstOrigin) === normalizeDAppOrigin(secondOrigin);
}
