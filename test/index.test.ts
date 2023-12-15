import { expect, it, describe } from "vitest";
import {
  AP_API_URL,
  CA_API_URL,
  CN_API_URL,
  EU_API_URL,
  US_API_URL,
  getRegion,
  getRegionUrl,
} from "../src";

describe("getRegion", () => {
  it("should return `eu` region", () => {
    expect(getRegion(1)).toBe("eu");
    expect(getRegion(6_000_000)).toBe("eu");
  });

  it("should return `us` region", () => {
    expect(getRegion(1_000_000)).toBe("us");
  });

  it("should return `ca` region", () => {
    expect(getRegion(2_000_000)).toBe("ca");
  });

  it("should return `ap` region", () => {
    expect(getRegion(3_000_000)).toBe("ap");
  });
});

describe("getRegionUrl", () => {
  it("should return `eu url` region", () => {
    expect(getRegionUrl("eu")).toBe(EU_API_URL);
  });

  it("should return `us url` region", () => {
    expect(getRegionUrl("us")).toBe(US_API_URL);
  });

  it("should return `cn url` region", () => {
    expect(getRegionUrl("cn")).toBe(CN_API_URL);
  });

  it("should return `ca url` region", () => {
    expect(getRegionUrl("ca")).toBe(CA_API_URL);
  });

  it("should return `ap url` region", () => {
    expect(getRegionUrl("ap")).toBe(AP_API_URL);
  });
});
