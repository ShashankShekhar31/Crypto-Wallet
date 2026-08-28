import { randomBytes, createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { SecretEncryption } from "../identity/secret-encryption.js";

import { TotpService } from "../identity/totp-service.js";

import type { TotpFactorRecord } from "../identity/totp-repository.js";

import type { TotpRepository } from "../identity/totp-repository.js";

function createRepositoryMock() {
  return {
    createFactor: vi.fn(),
    findById: vi.fn(),
    findActiveByIdentityAccountId: vi.fn(),
    enableFactor: vi.fn(),
    disableFactor: vi.fn(),
  } as unknown as TotpRepository;
}

function createEncryption() {
  return new SecretEncryption(randomBytes(32), "v1");
}

function createFactor(encryption: SecretEncryption, secret: string): TotpFactorRecord {
  const encrypted = encryption.encrypt(secret);

  return {
    id: "factor-id",
    identityAccountId: "identity-id",
    encryptedSecret: encrypted.ciphertext,
    secretNonce: encrypted.nonce,
    encryptionKeyVersion: encrypted.keyVersion,
    createdAt: new Date(),
    enabledAt: new Date(),
    disabledAt: null,
  };
}

function generateTotpCode(secret: Buffer, timestamp: number): string {
  const counter = Math.floor(timestamp / 30);

  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", secret).update(counterBuffer).digest();

  const offset = digest[digest.length - 1]! & 0x0f;

  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of input) {
    const index = alphabet.indexOf(character);

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

describe("TotpService", () => {
  it("creates a factor with an encrypted secret", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    const encrypted = encryption.encrypt("placeholder");

    const factor: TotpFactorRecord = {
      id: "factor-id",
      identityAccountId: "identity-id",
      encryptedSecret: encrypted.ciphertext,
      secretNonce: encrypted.nonce,
      encryptionKeyVersion: encrypted.keyVersion,
      createdAt: new Date(),
      enabledAt: null,
      disabledAt: null,
    };

    vi.mocked(repository.createFactor).mockResolvedValue(factor);

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    const result = await service.createFactor("identity-id");

    expect(result.factor).toEqual(factor);

    expect(result.secret).toMatch(/^[A-Z2-7]+$/);

    expect(repository.createFactor).toHaveBeenCalledOnce();

    const input = vi.mocked(repository.createFactor).mock.calls[0]![0];

    expect(input.encryptedSecret).not.toEqual(Buffer.from(result.secret));

    expect(input.secretNonce.length).toBeGreaterThan(0);

    expect(input.encryptionKeyVersion).toBe("v1");
  });

  it("verifies a valid TOTP code", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    const secret = "JBSWY3DPEHPK3PXP";

    const factor = createFactor(encryption, secret);

    vi.mocked(repository.findActiveByIdentityAccountId).mockResolvedValue(factor);

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    const now = new Date("2026-08-27T12:00:00.000Z");

    const decoded = base32Decode(secret);

    const code = generateTotpCode(decoded, Math.floor(now.getTime() / 1000));

    await expect(
      service.verifyCode({
        identityAccountId: "identity-id",
        code,
        now,
      }),
    ).resolves.toBe(true);
  });

  it("rejects an invalid TOTP code", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    const factor = createFactor(encryption, "JBSWY3DPEHPK3PXP");

    vi.mocked(repository.findActiveByIdentityAccountId).mockResolvedValue(factor);

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    await expect(
      service.verifyCode({
        identityAccountId: "identity-id",
        code: "000000",
        now: new Date("2026-08-27T12:00:00.000Z"),
      }),
    ).resolves.toBe(false);
  });

  it("returns false when no active factor exists", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    vi.mocked(repository.findActiveByIdentityAccountId).mockResolvedValue(null);

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    await expect(
      service.verifyCode({
        identityAccountId: "identity-id",
        code: "123456",
      }),
    ).resolves.toBe(false);
  });

  it("enables a factor after valid code verification", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    const secret = "JBSWY3DPEHPK3PXP";

    const factor = createFactor(encryption, secret);

    const enabledFactor = {
      ...factor,
      enabledAt: new Date(),
    };

    vi.mocked(repository.findById).mockResolvedValue(factor);

    vi.mocked(repository.enableFactor).mockResolvedValue(enabledFactor);

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    const now = new Date("2026-08-27T12:00:00.000Z");

    const code = generateTotpCode(base32Decode(secret), Math.floor(now.getTime() / 1000));

    const result = await service.enableFactor("factor-id", code, now);

    expect(result).toEqual(enabledFactor);

    expect(repository.enableFactor).toHaveBeenCalledWith("factor-id");
  });

  it("does not enable a factor with an invalid code", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    const factor = createFactor(encryption, "JBSWY3DPEHPK3PXP");

    vi.mocked(repository.findById).mockResolvedValue(factor);

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    await expect(service.enableFactor("factor-id", "000000")).rejects.toThrow("Invalid TOTP code");

    expect(repository.enableFactor).not.toHaveBeenCalled();
  });

  it("rejects malformed TOTP codes", async () => {
    const repository = createRepositoryMock();

    const encryption = createEncryption();

    const service = new TotpService({
      repository,
      secretEncryption: encryption,
    });

    await expect(
      service.verifyCode({
        identityAccountId: "identity-id",
        code: "12345",
      }),
    ).rejects.toThrow("TOTP code must be exactly 6 digits");
  });
});
