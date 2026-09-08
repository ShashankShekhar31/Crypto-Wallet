import type { HardwareSignRequest, HardwareSignature } from "./device.js";

export interface HardwareSignCommand {
  readonly type: "sign";
  readonly chain: string;
  readonly derivationPath: string;
  readonly payload: string;
}

export interface HardwareSignResponse {
  readonly type: "signature";
  readonly chain: string;
  readonly signature: string;
}

function bytesToHex(value: Uint8Array): string {
  let result = "";

  for (const byte of value) {
    result += byte.toString(16).padStart(2, "0");
  }

  return result;
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error("Hardware signature must be valid hexadecimal");
  }

  const result = new Uint8Array(value.length / 2);

  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }

  return result;
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson<T>(value: Uint8Array): T {
  try {
    return JSON.parse(new TextDecoder().decode(value)) as T;
  } catch {
    throw new Error("Invalid hardware transport response");
  }
}

export function encodeHardwareSignCommand(request: HardwareSignRequest): Uint8Array {
  const command: HardwareSignCommand = {
    type: "sign",
    chain: request.chain,
    derivationPath: request.derivationPath,
    payload: bytesToHex(request.payload),
  };

  return encodeJson(command);
}

export function decodeHardwareSignCommand(command: Uint8Array): HardwareSignCommand {
  const decoded = decodeJson<HardwareSignCommand>(command);

  if (decoded.type !== "sign") {
    throw new Error("Invalid hardware sign command");
  }

  if (typeof decoded.chain !== "string" || decoded.chain.length === 0) {
    throw new Error("Hardware sign command chain is required");
  }

  if (typeof decoded.derivationPath !== "string" || decoded.derivationPath.length === 0) {
    throw new Error("Hardware sign command derivation path is required");
  }

  if (
    typeof decoded.payload !== "string" ||
    !/^[0-9a-fA-F]*$/.test(decoded.payload) ||
    decoded.payload.length % 2 !== 0
  ) {
    throw new Error("Hardware sign command payload is invalid");
  }

  return Object.freeze({
    type: "sign",
    chain: decoded.chain,
    derivationPath: decoded.derivationPath,
    payload: decoded.payload,
  });
}

export function encodeHardwareSignResponse(signature: HardwareSignature): Uint8Array {
  const response: HardwareSignResponse = {
    type: "signature",
    chain: signature.chain,
    signature: bytesToHex(signature.signature),
  };

  return encodeJson(response);
}

export function decodeHardwareSignResponse(response: Uint8Array): HardwareSignature {
  const decoded = decodeJson<HardwareSignResponse>(response);

  if (decoded.type !== "signature") {
    throw new Error("Invalid hardware signature response");
  }

  if (typeof decoded.chain !== "string" || decoded.chain.length === 0) {
    throw new Error("Hardware signature response chain is required");
  }

  if (typeof decoded.signature !== "string" || !/^[0-9a-fA-F]*$/.test(decoded.signature)) {
    throw new Error("Hardware signature response is invalid");
  }

  return Object.freeze({
    chain: decoded.chain,
    signature: hexToBytes(decoded.signature),
  });
}
