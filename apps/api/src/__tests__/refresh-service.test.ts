import { describe, expect, it, vi } from "vitest";

import {
  hashRefreshToken,
} from "../identity/token.js";

import {
  RefreshService,
} from "../identity/refresh-service.js";

import type {
  AuthSessionRecord,
  SessionRepository,
} from "../identity/session-repository.js";

function createRepositoryMock() {
  return {
    findByRefreshTokenHash: vi.fn(),
    rotateSession: vi.fn(),
    handleRefreshTokenReplay: vi.fn(),
  } as unknown as SessionRepository;
}

function createSession(
  overrides: Partial<AuthSessionRecord> = {},
): AuthSessionRecord {
  const issuedAt = new Date(
    "2026-08-27T10:00:00.000Z",
  );

  return {
    id: "session-id",
    userId: "user-id",
    deviceId: "device-id",
    tokenFamilyId: "token-family-id",
    refreshTokenHash: hashRefreshToken(
      "refresh-token",
    ),
    status: "active",
    issuedAt,
    lastSeenAt: issuedAt,
    expiresAt: new Date(
      "2026-08-27T20:00:00.000Z",
    ),
    idleExpiresAt: new Date(
      "2026-08-27T14:00:00.000Z",
    ),
    rotatedAt: null,
    revokedAt: null,
    revokedReason: null,
    replacedBySessionId: null,
    ...overrides,
  };
}

describe("RefreshService", () => {
  it("rotates a valid refresh token", async () => {
    const repository =
      createRepositoryMock();

    const service =
      new RefreshService(repository);

    const session =
      createSession();

    vi.mocked(
      repository.findByRefreshTokenHash,
    ).mockResolvedValue(session);

    const replacementSession =
      createSession({
        id: "replacement-session-id",
        refreshTokenHash:
          hashRefreshToken(
            "replacement-refresh-token",
          ),
      });

    vi.mocked(
      repository.rotateSession,
    ).mockResolvedValue({
      previousSession: {
        ...session,
        status: "rotated",
        rotatedAt: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        replacedBySessionId:
          replacementSession.id,
      },
      replacementSession,
    });

    const result =
      await service.refresh({
        refreshToken:
          "refresh-token",
        now: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      });

    expect(result.previousSession.status)
      .toBe("rotated");

    expect(result.session.id)
      .toBe("replacement-session-id");

    expect(result.refreshToken)
      .toMatch(/^/);

    expect(
      repository.rotateSession,
    ).toHaveBeenCalledOnce();

    const [
      previousSessionId,
      replacement,
    ] = vi.mocked(
      repository.rotateSession,
    ).mock.calls[0]!;

    expect(previousSessionId)
      .toBe(session.id);

    expect(replacement).toMatchObject({
      userId: session.userId,
      deviceId: session.deviceId,
      tokenFamilyId:
        session.tokenFamilyId,
      expiresAt: new Date(
        "2026-08-27T20:00:00.000Z",
      ),
      idleExpiresAt: new Date(
        "2026-08-27T14:00:00.000Z",
      ),
    });

    expect(
      replacement.refreshTokenHash,
    ).toBe(
      hashRefreshToken(
        result.refreshToken,
      ),
    );
  });

  it("rejects an unknown refresh token", async () => {
    const repository =
      createRepositoryMock();

    vi.mocked(
      repository.findByRefreshTokenHash,
    ).mockResolvedValue(null);

    const service =
      new RefreshService(repository);

    await expect(
      service.refresh({
        refreshToken:
          "unknown-refresh-token",
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      }),
    ).rejects.toThrow(
      "Invalid refresh token",
    );

    expect(
      repository.rotateSession,
    ).not.toHaveBeenCalled();
  });

  it("rejects an expired refresh session", async () => {
    const repository =
      createRepositoryMock();

    const session =
      createSession({
        expiresAt: new Date(
          "2026-08-27T11:00:00.000Z",
        ),
      });

    vi.mocked(
      repository.findByRefreshTokenHash,
    ).mockResolvedValue(session);

    const service =
      new RefreshService(repository);

    await expect(
      service.refresh({
        refreshToken:
          "refresh-token",
        now: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      }),
    ).rejects.toThrow(
      "Refresh session has expired",
    );

    expect(
      repository.rotateSession,
    ).not.toHaveBeenCalled();
  });

  it("rejects an idle-expired refresh session", async () => {
    const repository =
      createRepositoryMock();

    const session =
      createSession({
        idleExpiresAt: new Date(
          "2026-08-27T11:00:00.000Z",
        ),
      });

    vi.mocked(
      repository.findByRefreshTokenHash,
    ).mockResolvedValue(session);

    const service =
      new RefreshService(repository);

    await expect(
      service.refresh({
        refreshToken:
          "refresh-token",
        now: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      }),
    ).rejects.toThrow(
      "Refresh session is idle expired",
    );

    expect(
      repository.rotateSession,
    ).not.toHaveBeenCalled();
  });

  it("rejects a revoked refresh session", async () => {
    const repository =
      createRepositoryMock();

    const session =
      createSession({
        status: "revoked",
        revokedAt: new Date(
          "2026-08-27T11:30:00.000Z",
        ),
        revokedReason: "user_logout",
      });

    vi.mocked(
      repository.findByRefreshTokenHash,
    ).mockResolvedValue(session);

    const service =
      new RefreshService(repository);

    await expect(
      service.refresh({
        refreshToken:
          "refresh-token",
        now: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      }),
    ).rejects.toThrow(
      "Refresh session is not active",
    );

    expect(
      repository.rotateSession,
    ).not.toHaveBeenCalled();
  });

  it("detects reuse of a rotated refresh token", async () => {
    const repository =
      createRepositoryMock();

    const session =
      createSession({
        status: "rotated",
        rotatedAt: new Date(
          "2026-08-27T11:30:00.000Z",
        ),
        replacedBySessionId:
          "replacement-session-id",
      });

    vi.mocked(
      repository.findByRefreshTokenHash,
    ).mockResolvedValue(session);

    const service =
      new RefreshService(repository);

    await expect(
      service.refresh({
        refreshToken:
          "refresh-token",
        now: new Date(
          "2026-08-27T12:00:00.000Z",
        ),
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      }),
    ).rejects.toThrow(
      "Refresh token replay detected",
    );

    expect(
      repository.handleRefreshTokenReplay,
    ).toHaveBeenCalledOnce();

    expect(
      repository.handleRefreshTokenReplay,
    ).toHaveBeenCalledWith(
      session.id,
      session.tokenFamilyId,
    );

    expect(
      repository.rotateSession,
    ).not.toHaveBeenCalled();
  });

  it("rejects an empty refresh token", async () => {
    const repository =
      createRepositoryMock();

    const service =
      new RefreshService(repository);

    await expect(
      service.refresh({
        refreshToken: "",
        expiresAt: new Date(
          "2026-08-27T20:00:00.000Z",
        ),
        idleExpiresAt: new Date(
          "2026-08-27T14:00:00.000Z",
        ),
      }),
    ).rejects.toThrow(
      "Refresh token is required",
    );

    expect(
      repository.findByRefreshTokenHash,
    ).not.toHaveBeenCalled();
  });
});