import type { CacheClient } from "@crypto-wallet/cache";

const CHALLENGE_TTL_SECONDS = 5 * 60;

export type PasskeyChallengeType =
  | "registration"
  | "authentication";

export interface PasskeyChallenge {
  type: PasskeyChallengeType;
  identityAccountId: string | null;
  deviceId: string | null;
  challenge: string;
}

export class PasskeyChallengeStore {
  constructor(
    private readonly cache: CacheClient,
  ) {}

  async save(
    ceremonyId: string,
    value: PasskeyChallenge,
  ): Promise<void> {
    await this.cache.setEx(
      this.key(ceremonyId),
      CHALLENGE_TTL_SECONDS,
      JSON.stringify(value),
    );
  }

  async get(
    ceremonyId: string,
  ): Promise<PasskeyChallenge | null> {
    const value =
      await this.cache.get(
        this.key(ceremonyId),
      );

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as PasskeyChallenge;
    } catch {
      return null;
    }
  }

  async consume(
    ceremonyId: string,
  ): Promise<PasskeyChallenge | null> {
    const value =
      await this.get(ceremonyId);

    if (!value) {
      return null;
    }

    await this.cache.del(
      this.key(ceremonyId),
    );

    return value;
  }

  private key(ceremonyId: string): string {
    return `auth:passkey:challenge:${ceremonyId}`;
  }
}