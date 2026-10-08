import { describe, expect, it } from "vitest";
import { decodeIfEncoded } from "./decode-if-encoded";

describe("decodeIfEncoded()", () => {
  it("should decode URL-encoded commas in resolve_relations string", () => {
    const encoded = "dodoNewsItem.tags%2CgooseProductMetadata.systemGenerationRef";
    expect(decodeIfEncoded(encoded)).toBe(
      "dodoNewsItem.tags,gooseProductMetadata.systemGenerationRef",
    );
  });

  it("should decode a fully URL-encoded resolve_relations string", () => {
    const encoded =
      "dodoNewsItem.tags%2CgooseProductMetadata.systemGenerationRef%2CgooseProductMetadata.productGroupRef";
    expect(decodeIfEncoded(encoded)).toBe(
      "dodoNewsItem.tags,gooseProductMetadata.systemGenerationRef,gooseProductMetadata.productGroupRef",
    );
  });

  it("should return the original string when not URL-encoded", () => {
    const plain = "dodoNewsItem.tags,gooseProductMetadata.systemGenerationRef";
    expect(decodeIfEncoded(plain)).toBe(plain);
  });

  it("should return an empty string unchanged", () => {
    expect(decodeIfEncoded("")).toBe("");
  });

  it("should decode mixed encoded characters", () => {
    const encoded = "component.field%20with%20spaces%2Cother.field";
    expect(decodeIfEncoded(encoded)).toBe("component.field with spaces,other.field");
  });

  it("should return the original string for malformed encoding", () => {
    const malformed = "component.field%2";
    expect(decodeIfEncoded(malformed)).toBe(malformed);
  });

  it("should not double-decode already decoded strings", () => {
    const plain = "component.field,other.field";
    expect(decodeIfEncoded(plain)).toBe(plain);
  });
});
