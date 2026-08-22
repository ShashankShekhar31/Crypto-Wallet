import { describe, expect, it } from "vitest";

import { healthQuerySchema } from "../validation.js";

describe("healthQuerySchema", () => {
  it("accepts an empty query object", () => {
    expect(healthQuerySchema.parse({})).toEqual({});
  });

  it("rejects an invalid query value", () => {
    expect(() => healthQuerySchema.parse(null)).toThrow();
  });
});
