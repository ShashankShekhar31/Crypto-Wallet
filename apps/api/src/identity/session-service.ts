import {
  generateRefreshToken,
  hashRefreshToken,
} from "./token.js";

import {
  SessionRepository,
  type AuthSessionRecord,
} from "./session-repository.js";

export interface RefreshSessionInput {
  refreshToken: string;
  idleTimeoutMs: number;
}

export interface RefreshedSession {
  previousSession: AuthSessionRecord;
  session: AuthSessionRecord;
  refreshToken: string;
}

export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
  ) {}

  async refresh(
    input: RefreshSessionInput,
  ): Promise<RefreshedSession> {
    if (input.refreshToken.length === 0) {
      throw new Error("Invalid refresh token");
    }

    if (input.idleTimeoutMs <= 0) {
      throw new Error("Invalid idle timeout");
    }

    const refreshTokenHash =
      hashRefreshToken(input.refreshToken);

    const currentSession =
      await this.sessionRepository.findByRefreshTokenHash(
        refreshTokenHash,
      );

    if (!currentSession) {
      throw new Error("Invalid refresh token");
    }

    if (currentSession.status === "rotated") {
      await this.sessionRepository.handleRefreshTokenReplay(
        currentSession.id,
        currentSession.tokenFamilyId,
      );

      throw new Error(
        "Refresh token replay detected",
      );
    }

    if (currentSession.status !== "active") {
      throw new Error("Auth session is not active");
    }

    const now = new Date();

    if (currentSession.expiresAt <= now) {
      throw new Error("Auth session has expired");
    }

    if (currentSession.idleExpiresAt <= now) {
      throw new Error("Auth session is idle-expired");
    }

    const replacementRefreshToken =
      generateRefreshToken();

    const replacementRefreshTokenHash =
      hashRefreshToken(
        replacementRefreshToken,
      );

    const replacementIdleExpiresAt =
      new Date(
        Math.min(
          currentSession.expiresAt.getTime(),
          now.getTime() +
            input.idleTimeoutMs,
        ),
      );

    const rotated =
      await this.sessionRepository.rotateSession(
        currentSession.id,
        {
          userId: currentSession.userId,
          deviceId: currentSession.deviceId,
          tokenFamilyId:
            currentSession.tokenFamilyId,
          refreshTokenHash:
            replacementRefreshTokenHash,
          expiresAt:
            currentSession.expiresAt,
          idleExpiresAt:
            replacementIdleExpiresAt,
        },
      );

    return {
      previousSession:
        rotated.previousSession,
      session:
        rotated.replacementSession,
      refreshToken:
        replacementRefreshToken,
    };
  }

  async revoke(
    sessionId: string,
    reason: string,
  ): Promise<AuthSessionRecord | null> {
    return this.sessionRepository.revokeSession(
      sessionId,
      reason,
    );
  }
}