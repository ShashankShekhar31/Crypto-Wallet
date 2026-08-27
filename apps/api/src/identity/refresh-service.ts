import { generateRefreshToken, hashRefreshToken } from "./token.js";

import { SessionRepository, type AuthSessionRecord } from "./session-repository.js";

export interface RefreshSessionInput {
  refreshToken: string;
  now?: Date;
  expiresAt: Date;
  idleExpiresAt: Date;
}

export interface RefreshedSession {
  previousSession: AuthSessionRecord;
  session: AuthSessionRecord;
  refreshToken: string;
}

export class RefreshService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async refresh(input: RefreshSessionInput): Promise<RefreshedSession> {
    if (typeof input.refreshToken !== "string" || input.refreshToken.length === 0) {
      throw new Error("Refresh token is required");
    }

    const now = input.now ?? new Date();

    const refreshTokenHash = hashRefreshToken(input.refreshToken);

    const session = await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new Error("Invalid refresh token");
    }

    if (session.status === "rotated") {
      await this.sessionRepository.handleRefreshTokenReplay(session.id, session.tokenFamilyId);

      throw new Error("Refresh token replay detected");
    }

    if (session.status !== "active") {
      throw new Error("Refresh session is not active");
    }

    if (session.expiresAt <= now) {
      throw new Error("Refresh session has expired");
    }

    if (session.idleExpiresAt <= now) {
      throw new Error("Refresh session is idle expired");
    }

    const newRefreshToken = generateRefreshToken();

    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    const rotated = await this.sessionRepository.rotateSession(session.id, {
      userId: session.userId,
      deviceId: session.deviceId,
      tokenFamilyId: session.tokenFamilyId,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: input.expiresAt,
      idleExpiresAt: input.idleExpiresAt,
    });

    return {
      previousSession: rotated.previousSession,
      session: rotated.replacementSession,
      refreshToken: newRefreshToken,
    };
  }
}
