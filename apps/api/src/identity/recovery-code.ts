import { createHash, randomBytes } from "node:crypto";

const RECOVERY_CODE_BYTES = 16;
const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("Recovery code count must be greater than zero");
  }

  return Array.from({ length: count }, () => formatRecoveryCode(randomBytes(RECOVERY_CODE_BYTES)));
}

export function hashRecoveryCode(code: string): string {
  if (typeof code !== "string" || code.length === 0) {
    throw new Error("Recovery code must be a non-empty string");
  }

  return createHash("sha256").update(code, "utf8").digest("hex");
}

function formatRecoveryCode(bytes: Buffer): string {
  const value = bytes.toString("hex");

  return [value.slice(0, 8), value.slice(8, 16), value.slice(16, 24), value.slice(24, 32)].join(
    "-",
  );
}
