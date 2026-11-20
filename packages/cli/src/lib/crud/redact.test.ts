import { describe, expect, it } from "vitest";
import { redactedData, redactedField, redactedSet, SecretScrubber, stripSecrets } from "./redact";

const secretFields = ["secret"];
const fieldNames = { known: ["name", "description", "secret"], visible: ["name", "description"] };

describe("redactedSet", () => {
  it("should serialize a secret assignment without its value", () => {
    const options = {
      set: [redactedSet("name=a", fieldNames), redactedSet("secret=s3", fieldNames)],
    };

    expect(JSON.stringify(options)).toBe('{"set":["name=a","secret=[redacted]"]}');
    expect(String(options.set[1])).toBe("secret=s3");
  });
});

describe("redactedSet with a field it does not know", () => {
  it("should redact a mistyped or unknown field with its value, as either may hold the secret", () => {
    for (const raw of ["Secret=s3", "secret:s3cret=", "s3cret-without-equals", "a b=s3"]) {
      expect(JSON.stringify(redactedSet(raw, fieldNames))).toBe('"[redacted]"');
    }
  });
});

describe("redactedData", () => {
  it("should serialize --data with its secret fields redacted", () => {
    const data = redactedData('{"secret":"s3","name":"a"}', fieldNames);

    expect(JSON.stringify({ data })).toBe('{"data":{"secret":"[redacted]","name":"a"}}');
    expect(String(data)).toBe('{"secret":"s3","name":"a"}');
  });

  it("should serialize unparseable --data as redacted", () => {
    expect(JSON.stringify(redactedData('{"secret":"s3"', fieldNames))).toBe('"[redacted]"');
  });

  it("should serialize --data with a key it does not know as redacted", () => {
    expect(JSON.stringify(redactedData('{"secret: s3cret":1,"name":"a"}', fieldNames))).toBe(
      '"[redacted]"',
    );
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

describe("redactedField", () => {
  it("should serialize a field name, and anything else as redacted", () => {
    expect(JSON.stringify(redactedField("secret", fieldNames))).toBe('"secret"');
    expect(JSON.stringify(redactedField("whsec_s3cret", fieldNames))).toBe('"[redacted]"');
  });
});

describe("stripSecrets", () => {
  it("should replace each secret field with whether the record has one", () => {
    expect(stripSecrets({ id: 1, secret: "s3" }, ["secret"])).toEqual({ id: 1, has_secret: true });
    expect(stripSecrets({ id: 1, secret: null }, ["secret"])).toEqual({ id: 1, has_secret: false });
    expect(stripSecrets({ id: 1, secret: "" }, ["secret"])).toEqual({ id: 1, has_secret: false });
  });
});
