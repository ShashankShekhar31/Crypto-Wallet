import { describe, expect, it } from "vitest";

import { MockHardwareWallet } from "../device.js";
import { MockHardwareTransport } from "../transport.js";
import { decodeHardwareSignCommand, encodeHardwareSignResponse } from "../command.js";

function createWallet() {
  const transport = new MockHardwareTransport((command) => {
    const request = decodeHardwareSignCommand(command);

    return encodeHardwareSignResponse({
      chain: request.chain,
      signature: new Uint8Array(64).fill(7),
    });
  });

  const wallet = new MockHardwareWallet(transport, {
    deviceInfo: {
      vendor: "Mock Vendor",
      model: "Mock Device",
      firmwareVersion: "0.0.1",
    },
    publicKeys: [
      {
        chain: "bitcoin",
        derivationPath: "m/84'/0'/0'/0/0",
        publicKey: "02mock-public-key",
        address: "bc1qmock-address",
      },
    ],
  });

  return {
    wallet,
    transport,
  };
}

describe("MockHardwareWallet", () => {
  it("starts disconnected", () => {
    const { wallet } = createWallet();

    expect(wallet.state).toBe("disconnected");
  });

  it("connects and disconnects", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    expect(wallet.state).toBe("connected");

    await wallet.disconnect();

    expect(wallet.state).toBe("disconnected");
  });

  it("rejects device info while disconnected", async () => {
    const { wallet } = createWallet();

    await expect(wallet.getDeviceInfo()).rejects.toThrow("Hardware wallet is not connected");
  });

  it("rejects public-key access while disconnected", async () => {
    const { wallet } = createWallet();

    await expect(
      wallet.getPublicKey({
        chain: "bitcoin",
        derivationPath: "m/84'/0'/0'/0/0",
      }),
    ).rejects.toThrow("Hardware wallet is not connected");
  });

  it("rejects signing while disconnected", async () => {
    const { wallet } = createWallet();

    await expect(
      wallet.sign({
        chain: "bitcoin",
        derivationPath: "m/84'/0'/0'/0/0",
        payload: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow("Hardware wallet is not connected");
  });

  it("returns device information after connecting", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    await expect(wallet.getDeviceInfo()).resolves.toEqual({
      vendor: "Mock Vendor",
      model: "Mock Device",
      firmwareVersion: "0.0.1",
    });
  });

  it("returns a public key without exposing private key material", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    const result = await wallet.getPublicKey({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
    });

    expect(result).toEqual({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      publicKey: "02mock-public-key",
      address: "bc1qmock-address",
    });

    expect(result).not.toHaveProperty("privateKey");
    expect(result).not.toHaveProperty("seed");
    expect(result).not.toHaveProperty("mnemonic");
  });

  it("signs a payload after connecting", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    const result = await wallet.sign({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload: new Uint8Array([1, 2, 3]),
    });

    expect(result.chain).toBe("bitcoin");
    expect(result.signature).toEqual(new Uint8Array(64).fill(7));
  });

  it("returns a copy of the mock signature bytes", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    const first = await wallet.sign({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload: new Uint8Array([1]),
    });

    first.signature[0] = 99;

    const second = await wallet.sign({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload: new Uint8Array([1]),
    });

    expect(second.signature[0]).toBe(7);
  });
  it("does not mutate the caller payload during signing", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    const payload = new Uint8Array([1, 2, 3, 4]);

    await wallet.sign({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload,
    });

    expect(payload).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("accepts an empty signing payload", async () => {
    const { wallet } = createWallet();

    await wallet.connect();

    await expect(
      wallet.sign({
        chain: "bitcoin",
        derivationPath: "m/84'/0'/0'/0/0",
        payload: new Uint8Array(),
      }),
    ).resolves.toEqual({
      chain: "bitcoin",
      signature: new Uint8Array(64).fill(7),
    });
  });

  it("does not expose private-key material through the wallet API", () => {
    const { wallet } = createWallet();

    expect(wallet).not.toHaveProperty("privateKey");
    expect(wallet).not.toHaveProperty("privateKeyBytes");
    expect(wallet).not.toHaveProperty("seed");
    expect(wallet).not.toHaveProperty("mnemonic");
    expect(wallet).not.toHaveProperty("getPrivateKey");
    expect(wallet).not.toHaveProperty("exportPrivateKey");
    expect(wallet).not.toHaveProperty("getSeed");
    expect(wallet).not.toHaveProperty("getMnemonic");
  });
  it("sends the signing request through the transport", async () => {
    let receivedCommand: Uint8Array | null = null;

    const transport = new MockHardwareTransport((command) => {
      receivedCommand = new Uint8Array(command);

      const request = decodeHardwareSignCommand(command);

      return encodeHardwareSignResponse({
        chain: request.chain,
        signature: new Uint8Array(64).fill(7),
      });
    });

    const wallet = new MockHardwareWallet(transport, {
      deviceInfo: {
        vendor: "Mock Vendor",
        model: "Mock Device",
        firmwareVersion: "0.0.1",
      },
    });

    await wallet.connect();

    await wallet.sign({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload: new Uint8Array([1, 2, 3]),
    });

    expect(receivedCommand).not.toBeNull();

    const decoded = decodeHardwareSignCommand(receivedCommand!);

    expect(decoded).toEqual({
      type: "sign",
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload: "010203",
    });
  });

  it("copies the signing payload before sending it through the transport", async () => {
    let receivedCommand: Uint8Array | null = null;

    const transport = new MockHardwareTransport((command) => {
      receivedCommand = new Uint8Array(command);

      return encodeHardwareSignResponse({
        chain: "bitcoin",
        signature: new Uint8Array(64).fill(7),
      });
    });

    const wallet = new MockHardwareWallet(transport, {
      deviceInfo: {
        vendor: "Mock Vendor",
        model: "Mock Device",
        firmwareVersion: "0.0.1",
      },
    });

    await wallet.connect();

    const payload = new Uint8Array([1, 2, 3]);

    await wallet.sign({
      chain: "bitcoin",
      derivationPath: "m/84'/0'/0'/0/0",
      payload,
    });

    payload[0] = 99;

    const decoded = decodeHardwareSignCommand(receivedCommand!);

    expect(decoded.payload).toBe("010203");
  });

  it("rejects a signature returned for a different chain", async () => {
    const transport = new MockHardwareTransport(() =>
      encodeHardwareSignResponse({
        chain: "ethereum",
        signature: new Uint8Array(64).fill(7),
      }),
    );

    const wallet = new MockHardwareWallet(transport, {
      deviceInfo: {
        vendor: "Mock Vendor",
        model: "Mock Device",
        firmwareVersion: "0.0.1",
      },
    });

    await wallet.connect();

    await expect(
      wallet.sign({
        chain: "bitcoin",
        derivationPath: "m/84'/0'/0'/0/0",
        payload: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow("Hardware signature chain does not match signing request");
  });
});
