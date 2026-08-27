
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
import { AuthEventRepository } from "./auth-event-repository.js";
import { LoginRiskService } from "./login-risk-service.js";

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCK_DURATION_MS =
  15 * 60 * 1000;

export interface AuthenticateWithPasswordInput {
  normalizedEmail: string;
  password: string;
  deviceId: string;
  sourceIpHash?: string | null;
  userAgent?: string | null;
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
    private readonly authEventRepository: AuthEventRepository,
    private readonly loginRiskService: LoginRiskService,
  ) {}

  async authenticateWithPassword(
    input: AuthenticateWithPasswordInput,
  ): Promise<AuthenticatedSession> {
    const identityAccount =
      await this.identityRepository.findByEmail(
        input.normalizedEmail,
      );

    if (!identityAccount) {
      await this.authEventRepository.record({
        eventType: "password_login",
        outcome: "failure",
        failureCode: "invalid_credentials",
      });

      throw new Error("Invalid credentials");
    }

    if (identityAccount.status !== "active") {
      await this.authEventRepository.record({
        userId: identityAccount.userId,
        eventType: "password_login",
        outcome: "blocked",
        failureCode: "identity_account_not_active",
      });

      throw new Error("Identity account is not active");
    }

    const credential =
      await this.identityRepository.findPasswordCredential(
        identityAccount.id,
      );

    if (!credential) {
      await this.authEventRepository.record({
        userId: identityAccount.userId,
        eventType: "password_login",
        outcome: "failure",
        failureCode: "invalid_credentials",
      });

      throw new Error("Invalid credentials");
    }

    if (
      credential.lockedUntil !== null &&
      credential.lockedUntil > new Date()
    ) {
      await this.authEventRepository.record({
        userId: identityAccount.userId,
        eventType: "password_login",
        outcome: "blocked",
        failureCode: "password_locked",
      });

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

      await this.authEventRepository.record({
        userId: identityAccount.userId,
        eventType: "password_login",
        outcome: "failure",
        failureCode: "invalid_credentials",
      });

      throw new Error("Invalid credentials");
    }

    const device =
      await this.deviceRepository.findActiveDeviceForUser(
        input.deviceId,
        identityAccount.userId,
      );

    if (!device) {
      await this.authEventRepository.record({
        userId: identityAccount.userId,
        eventType: "password_login",
        outcome: "blocked",
        failureCode: "invalid_device",
      });

      throw new Error("Invalid device");
    }

    await this.identityRepository.resetPasswordFailures(
      identityAccount.id,
    );

    const loginRisk =
    await this.loginRiskService.evaluate({
      userId: identityAccount.userId,
      deviceId: input.deviceId,
      sourceIpHash:
        input.sourceIpHash ?? null,
    });

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

      if (loginRisk.suspicious) {
      await this.authEventRepository.record({
        userId: identityAccount.userId,
        deviceId: input.deviceId,
        sessionId: session.id,
        eventType: "login_detection",
        outcome: "suspicious",
        sourceIpHash:
          input.sourceIpHash ?? null,
        userAgent:
          input.userAgent ?? null,
        failureCode:
          loginRisk.reasons.join(","),
      });
    }

    await this.authEventRepository.record({
      userId: identityAccount.userId,
      deviceId: input.deviceId,
      sessionId: session.id,
      eventType: "password_login",
      outcome: "success",
    });

    return {
      identityAccount,
      session,
      refreshToken,
    };
  }
}
