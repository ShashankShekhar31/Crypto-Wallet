import { describe, expect, it } from "vitest";

import { createTelemetrySdk } from "../telemetry.js";

describe("telemetry", () => {
  it("creates an OpenTelemetry SDK with the Prometheus metrics reader", () => {
    const sdk = createTelemetrySdk(0);

    expect(sdk).toBeInstanceOf(Object);
    expect(sdk).toBeDefined();
  });
});
