export type HardwareTransportState = "disconnected" | "connected";

export interface HardwareTransport {
  readonly state: HardwareTransportState;

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  send(command: Uint8Array): Promise<Uint8Array>;
}

export type MockTransportHandler = (command: Uint8Array) => Uint8Array;

export class MockHardwareTransport implements HardwareTransport {
  private currentState: HardwareTransportState = "disconnected";

  constructor(private readonly handler: MockTransportHandler) {}

  get state(): HardwareTransportState {
    return this.currentState;
  }

  async connect(): Promise<void> {
    if (this.currentState === "connected") {
      throw new Error("Hardware transport is already connected");
    }

    this.currentState = "connected";
  }

  async disconnect(): Promise<void> {
    if (this.currentState === "disconnected") {
      return;
    }

    this.currentState = "disconnected";
  }

  async send(command: Uint8Array): Promise<Uint8Array> {
    if (this.currentState !== "connected") {
      throw new Error("Hardware transport is not connected");
    }

    const commandCopy = new Uint8Array(command);
    const response = this.handler(commandCopy);

    return new Uint8Array(response);
  }
}
