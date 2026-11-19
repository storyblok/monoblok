import { describe, expect, it } from "vitest";
import { redactedData, redactedSet, SecretScrubber, stripSecrets } from "./redact";

const secretFields = ["secret"];
const visibleFields = ["name", "description"];

describe("redactedSet", () => {
  it("should serialize a secret assignment without its value", () => {
    const options = {
      set: [redactedSet("name=a", visibleFields), redactedSet("secret=s3", visibleFields)],
    };

    expect(JSON.stringify(options)).toBe('{"set":["name=a","secret=[redacted]"]}');
    expect(String(options.set[1])).toBe("secret=s3");
  });
});

describe("redactedSet with a field it does not know", () => {
  it("should redact the value of a mistyped or unknown field", () => {
    expect(JSON.stringify([redactedSet("Secret=s3", visibleFields)])).toBe('["Secret=[redacted]"]');
    expect(JSON.stringify([redactedSet("s3cret-without-equals", visibleFields)])).toBe(
      '["[redacted]"]',
    );
  });
});

describe("redactedData", () => {
  it("should serialize --data with its secret fields redacted", () => {
    const data = redactedData('{"secret":"s3","name":"a"}', visibleFields);

    expect(JSON.stringify({ data })).toBe('{"data":{"secret":"[redacted]","name":"a"}}');
    expect(String(data)).toBe('{"secret":"s3","name":"a"}');
  });

  it("should serialize unparseable --data as redacted", () => {
    expect(JSON.stringify(redactedData('{"secret":"s3"', visibleFields))).toBe('"[redacted]"');
  });
});

describe("SecretScrubber", () => {
  it("should replace every secret value it has seen, however deep", () => {
    const scrubber = new SecretScrubber(secretFields);
    scrubber.collect({ secret: "s3cret-value" });

    expect(
      scrubber.scrubValue({ error: "bad s3cret-value", details: { secret: ["s3cret-value"] } }),
    ).toEqual({ error: "bad [redacted]", details: { secret: ["[redacted]"] } });
  });
});

describe("SecretScrubber with a short secret", () => {
  it("should leave text alone rather than garble it around a short value", () => {
    const scrubber = new SecretScrubber(secretFields);
    scrubber.collect({ secret: "e" });

    expect(scrubber.scrubText("can't be blank")).toBe("can't be blank");
  });
});

describe("stripSecrets", () => {
  it("should drop secret fields from a record", () => {
    expect(stripSecrets({ id: 1, secret: "s3" }, secretFields)).toEqual({ id: 1 });
  });
});
