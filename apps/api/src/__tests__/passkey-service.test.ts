import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import {
  createCacheClient,
  connectCacheClient,
  disconnectCacheClient,
  type CacheClient,
} from "@crypto-wallet/cache";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import { IdentityRepository } from "../identity/repository.js";
import { PasskeyRepository } from "../identity/passkey-repository.js";
import { PasskeyChallengeStore } from "../identity/passkey-challenge-store.js";
import { PasskeyService } from "../identity/passkey-service.js";

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: vi.fn(),
  generateRegistrationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
}));

const mockedGenerateAuthenticationOptions = vi.mocked(generateAuthenticationOptions);

const mockedGenerateRegistrationOptions = vi.mocked(generateRegistrationOptions);

const mockedVerifyAuthenticationResponse = vi.mocked(verifyAuthenticationResponse);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for passkey service tests");
}

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is required for passkey service tests");
}

const RP_ID = "localhost";
const RP_NAME = "Crypto Wallet";
const ORIGIN = "http://localhost:3000";

let cache: CacheClient;

beforeAll(async () => {
  cache = createCacheClient({
    url: redisUrl,
  });

  await connectCacheClient(cache);
});

afterAll(async () => {
  await disconnectCacheClient(cache);
});

describe("PasskeyService", () => {
  function createService(storage: PostgresStorage) {
    return new PasskeyService({
      identityRepository: new IdentityRepository(storage),
      passkeyRepository: new PasskeyRepository(storage),
      challengeStore: new PasskeyChallengeStore(cache),
      rpId: RP_ID,
      rpName: RP_NAME,
      origin: ORIGIN,
    });
  }

  async function createIdentity(
    storage: PostgresStorage,
    status: "active" | "disabled" = "active",
  ) {
    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const email = `passkey-${randomUUID()}@example.com`;

    await storage.query(
      `
        INSERT INTO users (id)
        VALUES ($1)
      `,
      [userId],
    );

    await storage.query(
      `
        INSERT INTO identity_accounts (
          id,
          user_id,
          normalized_email,
          status
        )
        VALUES ($1, $2, $3, $4)
      `,
      [identityAccountId, userId, email, status],
    );

    return {
      userId,
      identityAccountId,
      email,
    };
  }

  async function deleteUser(storage: PostgresStorage, userId: string) {
    await storage.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId],
    );
  }

  it("starts passkey registration for an active identity", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      mockedGenerateRegistrationOptions.mockResolvedValueOnce({
        challenge: "registration-challenge",
        rp: {
          id: RP_ID,
          name: RP_NAME,
        },
        user: {
          id: Buffer.from(identity.identityAccountId.replace(/-/g, ""), "hex").toString(
            "base64url",
          ),
          name: identity.email,
          displayName: identity.email,
        },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: "none",
      } as never);

      const service = createService(storage);

      const result = await service.startRegistration({
        identityAccountId: identity.identityAccountId,
      });

      expect(result.ceremonyId).toEqual(expect.any(String));

      expect(result.options.challenge).toBe("registration-challenge");

      expect(mockedGenerateRegistrationOptions).toHaveBeenCalledOnce();

      const call = mockedGenerateRegistrationOptions.mock.calls[0]?.[0];

      expect(call).toMatchObject({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: identity.email,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });

      expect(call?.excludeCredentials).toEqual([]);
    } finally {
      await storage.query(
        `
          DELETE FROM users
          WHERE id IN (
            SELECT user_id
            FROM identity_accounts
            WHERE normalized_email LIKE 'passkey-%@example.com'
          )
        `,
      );

      await storage.disconnect();
    }
  });

  it("rejects registration for an unknown identity", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const service = createService(storage);

      await expect(
        service.startRegistration({
          identityAccountId: randomUUID(),
        }),
      ).rejects.toThrow("Identity account not found");
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects registration for an inactive identity", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage, "disabled");

      const service = createService(storage);

      await expect(
        service.startRegistration({
          identityAccountId: identity.identityAccountId,
        }),
      ).rejects.toThrow("Identity account is not active");

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects authentication when the identity has no active passkey", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const service = createService(storage);

      await expect(
        service.startAuthentication({
          identityAccountId: identity.identityAccountId,
        }),
      ).rejects.toThrow("No active passkey found");

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("starts passkey authentication with active credentials", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const repository = new PasskeyRepository(storage);

      const credentialId = Buffer.from(`credential-${randomUUID()}`);

      await repository.createCredential({
        identityAccountId: identity.identityAccountId,
        credentialId,
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
      });

      mockedGenerateAuthenticationOptions.mockResolvedValueOnce({
        challenge: "authentication-challenge",
        rpId: RP_ID,
        allowCredentials: [
          {
            id: credentialId.toString("base64url"),
            type: "public-key",
          },
        ],
        userVerification: "required",
        timeout: 60000,
      } as never);

      const service = createService(storage);

      const result = await service.startAuthentication({
        identityAccountId: identity.identityAccountId,
      });

      expect(result.ceremonyId).toEqual(expect.any(String));

      expect(result.options.challenge).toBe("authentication-challenge");

      expect(mockedGenerateAuthenticationOptions).toHaveBeenCalledOnce();

      const call = mockedGenerateAuthenticationOptions.mock.calls[0]?.[0];

      expect(call).toMatchObject({
        rpID: RP_ID,
        userVerification: "required",
      });

      expect(call?.allowCredentials).toHaveLength(1);

      expect(call?.allowCredentials?.[0]?.id).toBe(credentialId.toString("base64url"));

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects authentication with an unknown ceremony", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const service = createService(storage);

      await expect(
        service.finishAuthentication({
          ceremonyId: randomUUID(),
          response: {
            id: "missing",
          } as never,
        }),
      ).rejects.toThrow("Passkey challenge not found or expired");
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects authentication with a registration ceremony", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const challengeStore = new PasskeyChallengeStore(cache);

      const ceremonyId = randomUUID();

      await challengeStore.save(ceremonyId, {
        type: "registration",
        identityAccountId: identity.identityAccountId,
        deviceId: null,
        challenge: "registration-challenge",
      });

      const service = new PasskeyService({
        identityRepository: new IdentityRepository(storage),
        passkeyRepository: new PasskeyRepository(storage),
        challengeStore,
        rpId: RP_ID,
        rpName: RP_NAME,
        origin: ORIGIN,
      });

      await expect(
        service.finishAuthentication({
          ceremonyId,
          response: {
            id: "anything",
          } as never,
        }),
      ).rejects.toThrow("Invalid passkey ceremony type");

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects authentication when the passkey does not exist", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const challengeStore = new PasskeyChallengeStore(cache);

      const ceremonyId = randomUUID();

      await challengeStore.save(ceremonyId, {
        type: "authentication",
        identityAccountId: identity.identityAccountId,
        deviceId: null,
        challenge: "authentication-challenge",
      });

      const service = new PasskeyService({
        identityRepository: new IdentityRepository(storage),
        passkeyRepository: new PasskeyRepository(storage),
        challengeStore,
        rpId: RP_ID,
        rpName: RP_NAME,
        origin: ORIGIN,
      });

      await expect(
        service.finishAuthentication({
          ceremonyId,
          response: {
            id: Buffer.from(`missing-${randomUUID()}`).toString("base64url"),
          } as never,
        }),
      ).rejects.toThrow("Passkey credential not found");

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("authenticates with a valid passkey and updates the sign counter", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const repository = new PasskeyRepository(storage);

      const credentialId = Buffer.from(`credential-${randomUUID()}`);

      const publicKey = Buffer.from(`public-key-${randomUUID()}`);

      await repository.createCredential({
        identityAccountId: identity.identityAccountId,
        credentialId,
        publicKey,
        signCount: 3,
      });

      const challengeStore = new PasskeyChallengeStore(cache);

      const ceremonyId = randomUUID();

      await challengeStore.save(ceremonyId, {
        type: "authentication",
        identityAccountId: identity.identityAccountId,
        deviceId: null,
        challenge: "authentication-challenge",
      });

      mockedVerifyAuthenticationResponse.mockResolvedValueOnce({
        verified: true,
        authenticationInfo: {
          newCounter: 4,
        },
      } as never);

      const service = new PasskeyService({
        identityRepository: new IdentityRepository(storage),
        passkeyRepository: repository,
        challengeStore,
        rpId: RP_ID,
        rpName: RP_NAME,
        origin: ORIGIN,
      });

      const result = await service.finishAuthentication({
        ceremonyId,
        response: {
          id: credentialId.toString("base64url"),
        } as never,
      });

      expect(result.identityAccountId).toBe(identity.identityAccountId);

      expect(result.passkey).not.toBeNull();

      expect(result.passkey?.signCount).toBe(4);

      expect(result.passkey?.lastUsedAt).toBeInstanceOf(Date);

      expect(mockedVerifyAuthenticationResponse).toHaveBeenCalledOnce();

      const verificationInput = mockedVerifyAuthenticationResponse.mock.calls[0]?.[0];

      expect(verificationInput).toMatchObject({
        expectedChallenge: "authentication-challenge",
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });

      const stored = await repository.findByCredentialId(credentialId);

      expect(stored?.signCount).toBe(4);
      expect(stored?.lastUsedAt).toBeInstanceOf(Date);

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects authentication when verification fails", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const repository = new PasskeyRepository(storage);

      const credential = await repository.createCredential({
        identityAccountId: identity.identityAccountId,
        credentialId: Buffer.from(`credential-${randomUUID()}`),
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
        signCount: 2,
      });

      const challengeStore = new PasskeyChallengeStore(cache);

      const ceremonyId = randomUUID();

      await challengeStore.save(ceremonyId, {
        type: "authentication",
        identityAccountId: identity.identityAccountId,
        deviceId: null,
        challenge: "authentication-challenge",
      });

      mockedVerifyAuthenticationResponse.mockResolvedValueOnce({
        verified: false,
        authenticationInfo: undefined,
      } as never);

      const service = new PasskeyService({
        identityRepository: new IdentityRepository(storage),
        passkeyRepository: repository,
        challengeStore,
        rpId: RP_ID,
        rpName: RP_NAME,
        origin: ORIGIN,
      });

      await expect(
        service.finishAuthentication({
          ceremonyId,
          response: {
            id: credential.credentialId.toString("base64url"),
          } as never,
        }),
      ).rejects.toThrow("Passkey authentication verification failed");

      const stored = await repository.findByCredentialId(credential.credentialId);

      expect(stored?.signCount).toBe(2);
      expect(stored?.lastUsedAt).toBeNull();

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects a passkey belonging to another identity", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identityA = await createIdentity(storage);

      const identityB = await createIdentity(storage);

      const repository = new PasskeyRepository(storage);

      const credential = await repository.createCredential({
        identityAccountId: identityB.identityAccountId,
        credentialId: Buffer.from(`credential-${randomUUID()}`),
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
      });

      const challengeStore = new PasskeyChallengeStore(cache);

      const ceremonyId = randomUUID();

      await challengeStore.save(ceremonyId, {
        type: "authentication",
        identityAccountId: identityA.identityAccountId,
        deviceId: null,
        challenge: "authentication-challenge",
      });

      const service = new PasskeyService({
        identityRepository: new IdentityRepository(storage),
        passkeyRepository: repository,
        challengeStore,
        rpId: RP_ID,
        rpName: RP_NAME,
        origin: ORIGIN,
      });

      await expect(
        service.finishAuthentication({
          ceremonyId,
          response: {
            id: credential.credentialId.toString("base64url"),
          } as never,
        }),
      ).rejects.toThrow("Passkey credential does not belong to identity account");

      await deleteUser(storage, identityA.userId);

      await deleteUser(storage, identityB.userId);
    } finally {
      await storage.disconnect();
    }
  });

  it("does not consume an authentication ceremony twice", async () => {
    const storage = new PostgresStorage(databaseUrl);

    try {
      await storage.connect();

      const identity = await createIdentity(storage);

      const challengeStore = new PasskeyChallengeStore(cache);

      const ceremonyId = randomUUID();

      await challengeStore.save(ceremonyId, {
        type: "authentication",
        identityAccountId: identity.identityAccountId,
        deviceId: null,
        challenge: "authentication-challenge",
      });

      const service = new PasskeyService({
        identityRepository: new IdentityRepository(storage),
        passkeyRepository: new PasskeyRepository(storage),
        challengeStore,
        rpId: RP_ID,
        rpName: RP_NAME,
        origin: ORIGIN,
      });

      await expect(
        service.finishAuthentication({
          ceremonyId,
          response: {
            id: "anything",
          } as never,
        }),
      ).rejects.toThrow("Passkey credential not found");

      await expect(
        service.finishAuthentication({
          ceremonyId,
          response: {
            id: "anything",
          } as never,
        }),
      ).rejects.toThrow("Passkey challenge not found or expired");

      await deleteUser(storage, identity.userId);
    } finally {
      await storage.disconnect();
    }
  });
});
