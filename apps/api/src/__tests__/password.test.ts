import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../identity/password.js";

describe("password hashing", () => {
  it("hashes and verifies the correct password", async () => {
    const password = "CorrectHorseBatteryStaple!123";

    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("CorrectHorseBatteryStaple!123");

    expect(await verifyPassword("WrongPassword!123", hash)).toBe(false);
  });

  it("generates different hashes for the same password", async () => {
    const password = "CorrectHorseBatteryStaple!123";

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);

    expect(await verifyPassword(password, firstHash)).toBe(true);
    expect(await verifyPassword(password, secondHash)).toBe(true);
  });

  it("rejects an empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow("Password must be a non-empty string");
  });

  it("rejects an invalid stored hash", async () => {
    await expect(verifyPassword("CorrectHorseBatteryStaple!123", "invalid-hash")).rejects.toThrow(
      "Invalid password hash format",
    );
  });

  it("rejects an unsupported hash version", async () => {
    const hash = await hashPassword("CorrectHorseBatteryStaple!123");

    const unsupportedHash = hash.replace("scrypt-v1", "scrypt-v999");

    await expect(verifyPassword("CorrectHorseBatteryStaple!123", unsupportedHash)).rejects.toThrow(
      "Unsupported password hash version",
    );
  });
});
