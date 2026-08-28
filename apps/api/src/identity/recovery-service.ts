import { generateRecoveryCodes } from "./recovery-code.js";

import { RecoveryCodeRepository } from "./recovery-code-repository.js";

export interface RecoveryCodeServiceOptions {
  repository: RecoveryCodeRepository;
}

export interface CreatedRecoveryCodes {
  codes: string[];
  count: number;
}

export interface ConsumedRecoveryCode {
  consumed: true;
}

export interface RecoveryCodeStatus {
  remaining: number;
}

export interface RevokedRecoveryCodes {
  revokedCount: number;
}

export class RecoveryCodeService {
  private readonly repository: RecoveryCodeRepository;

  constructor(options: RecoveryCodeServiceOptions) {
    this.repository = options.repository;
  }

  async createCodes(identityAccountId: string): Promise<CreatedRecoveryCodes> {
    validateIdentityAccountId(identityAccountId);

    const codes = generateRecoveryCodes();

    await this.repository.createCodes(identityAccountId, codes);

    return {
      codes,
      count: codes.length,
    };
  }

  async consumeCode(identityAccountId: string, code: string): Promise<ConsumedRecoveryCode> {
    validateIdentityAccountId(identityAccountId);

    if (typeof code !== "string" || code.trim().length === 0) {
      throw new Error("Recovery code is required");
    }

    const normalizedCode = code.trim().toUpperCase();

    const consumed = await this.repository.consumeCode(identityAccountId, normalizedCode);

    if (!consumed) {
      throw new Error("Invalid or already used recovery code");
    }

    return {
      consumed: true,
    };
  }

  async getStatus(identityAccountId: string): Promise<RecoveryCodeStatus> {
    validateIdentityAccountId(identityAccountId);

    const codes = await this.repository.listUnusedCodes(identityAccountId);

    return {
      remaining: codes.length,
    };
  }

  async revokeCodes(identityAccountId: string): Promise<RevokedRecoveryCodes> {
    validateIdentityAccountId(identityAccountId);

    const revokedCount = await this.repository.revokeUnusedCodes(identityAccountId);

    return {
      revokedCount,
    };
  }
}

function validateIdentityAccountId(identityAccountId: string): void {
  if (typeof identityAccountId !== "string" || identityAccountId.trim().length === 0) {
    throw new Error("Identity account ID is required");
  }
}
