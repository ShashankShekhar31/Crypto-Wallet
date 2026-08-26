
import {
  generateRefreshToken,
  hashRefreshToken,
} from "./token.js";

import {
  IdentityRepository,
  type IdentityAccountRecord,
} from "./repository.js";

import {
  SessionRepository,
  type AuthSessionRecord,
} from "./session-repository.js";

import { verifyPassword } from "./password.js";
import { DeviceRepository } from "./device-repository.js";

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCK_DURATION_MS =
  15 * 60 * 1000;

export interface AuthenticateWithPasswordInput {
  normalizedEmail: string;
  password: string;
  deviceId: string;
  expiresAt: Date;
  idleExpiresAt: Date;
}

export interface AuthenticatedSession {
  identityAccount: IdentityAccountRecord;
  session: AuthSessionRecord;
  refreshToken: string;
}

export class AuthenticationService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async authenticateWithPassword(
    input: AuthenticateWithPasswordInput,
  ): Promise<AuthenticatedSession> {
    const identityAccount =
      await this.identityRepository.findByEmail(
        input.normalizedEmail,
      );

    if (!identityAccount) {
      throw new Error("Invalid credentials");
    }

    if (identityAccount.status !== "active") {
      throw new Error("Identity account is not active");
    }

    const credential =
      await this.identityRepository.findPasswordCredential(
        identityAccount.id,
      );

    if (!credential) {
      throw new Error("Invalid credentials");
    }

    if (
      credential.lockedUntil !== null &&
      credential.lockedUntil > new Date()
    ) {
      throw new Error("Password credential is locked");
    }

    const valid = await verifyPassword(
      input.password,
      credential.passwordHash,
    );

    if (!valid) {
      await this.identityRepository.recordPasswordFailure(
        identityAccount.id,
        {
          maxAttempts:
            PASSWORD_MAX_ATTEMPTS,
          lockDurationMs:
            PASSWORD_LOCK_DURATION_MS,
        },
      );

      throw new Error("Invalid credentials");
    }

    const device =
      await this.deviceRepository.findActiveDeviceForUser(
        input.deviceId,
        identityAccount.userId,
      );

    if (!device) {
      throw new Error("Invalid device");
    }

    await this.identityRepository.resetPasswordFailures(
      identityAccount.id,
    );

    const refreshToken = generateRefreshToken();
    const refreshTokenHash =
      hashRefreshToken(refreshToken);

    const session =
      await this.sessionRepository.createSession({
        userId: identityAccount.userId,
        deviceId: input.deviceId,
        refreshTokenHash,
        expiresAt: input.expiresAt,
        idleExpiresAt: input.idleExpiresAt,
      });

    return {
      identityAccount,
      session,
      refreshToken,
    };
  }
}
