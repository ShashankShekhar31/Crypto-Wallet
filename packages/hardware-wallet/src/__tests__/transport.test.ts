import { describe, expect, it } from "vitest";

import { MockHardwareTransport } from "../transport.js";

describe("MockHardwareTransport", () => {
  it("starts disconnected", () => {
    const transport = new MockHardwareTransport(() => new Uint8Array([2]));

    expect(transport.state).toBe("disconnected");
  });

  it("connects and disconnects", async () => {
    const transport = new MockHardwareTransport(() => new Uint8Array([2]));

    await transport.connect();

    expect(transport.state).toBe("connected");

    await transport.disconnect();

    expect(transport.state).toBe("disconnected");
  });

  it("rejects sending while disconnected", async () => {
    const transport = new MockHardwareTransport(() => new Uint8Array([2]));

    await expect(transport.send(new Uint8Array([1]))).rejects.toThrow(
      "Hardware transport is not connected",
    );
  });

  it("rejects connecting an already connected transport", async () => {
    const transport = new MockHardwareTransport(() => new Uint8Array([2]));

    await transport.connect();

    await expect(transport.connect()).rejects.toThrow("Hardware transport is already connected");
  });

  it("sends commands through the handler", async () => {
    const transport = new MockHardwareTransport((command) => {
      expect(command).toEqual(new Uint8Array([1, 2, 3]));

      return new Uint8Array([4, 5, 6]);
    });

    await transport.connect();

    const response = await transport.send(new Uint8Array([1, 2, 3]));

    expect(response).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("copies command and response buffers", async () => {
    let receivedCommand: Uint8Array | undefined;

    const response = new Uint8Array([4, 5, 6]);

    const transport = new MockHardwareTransport((command) => {
      receivedCommand = command;

      return response;
    });

    await transport.connect();

    const command = new Uint8Array([1, 2, 3]);
    const returned = await transport.send(command);

    command[0] = 99;
    response[0] = 99;

    expect(receivedCommand).toEqual(new Uint8Array([1, 2, 3]));
    expect(returned).toEqual(new Uint8Array([4, 5, 6]));
  });
});
