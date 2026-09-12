import { describe, expect, it } from "vitest";

import { recordHttpRequest, recordHttpResponse } from "../metrics.js";

describe("metrics", () => {
  it("records an HTTP request", () => {
    expect(() => recordHttpRequest("GET")).not.toThrow();
  });

  it("records an HTTP response", () => {
    expect(() => recordHttpResponse("GET", 200, 12.5)).not.toThrow();

    expect(() => recordHttpResponse("GET", 500, 25)).not.toThrow();
  });
});
