import {
  hashRefreshToken,
} from "./token.js";

import {
  SessionRepository,
  type AuthSessionRecord,
} from "./session-repository.js";

export interface LogoutInput {
  refreshToken: string;
}

export interface LogoutResult {
  session: AuthSessionRecord;
}

export class LogoutService {
  constructor(
    private readonly sessionRepository: SessionRepository,
  ) {}

  async logout(
    input: LogoutInput,
  ): Promise<LogoutResult> {
    if (
      typeof input.refreshToken !== "string" ||
      input.refreshToken.length === 0
    ) {
      throw new Error(
        "Refresh token is required",
      );
    }

    const refreshTokenHash =
      hashRefreshToken(
        input.refreshToken,
      );

    const session =
      await this.sessionRepository
        .findByRefreshTokenHash(
          refreshTokenHash,
        );

    if (!session) {
      throw new Error(
        "Invalid refresh token",
      );
    }

    if (session.status !== "active") {
      return {
        session,
      };
    }

    const revoked =
      await this.sessionRepository.revokeSession(
        session.id,
        "user_logout",
      );

    if (!revoked) {
      throw new Error(
        "Failed to revoke session",
      );
    }

    return {
      session: revoked,
    };
  }
}