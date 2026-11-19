import { describe, expect, it } from "vitest";
import { composePayload, parseFlagPatch } from "./fields";
import type { ResourceFields } from "./fields";

const fields: ResourceFields = {
  envelope: "thing",
  writable: {
    name: { type: "string", required: true, nullable: false },
    note: { type: "string", required: false, nullable: true },
    tags: { type: "string[]", required: true, nullable: false },
    enabled: { type: "boolean", required: false, nullable: false },
    weight: { type: "number", required: false, nullable: false },
    config: { type: "json", required: false, nullable: true },
  },
  readOnly: ["id", "updated_at"],
};

const flags = (overrides: { set?: string[]; unset?: string[]; data?: string } = {}) => ({
  set: [],
  unset: [],
  ...overrides,
});

describe("parseFlagPatch", () => {
  it("should coerce each --set value to its field's type", () => {
    const patch = parseFlagPatch(
      fields,
      flags({
        set: ["name=a=b", "tags=x, y,,z", "enabled=false", "weight=1.5", 'config={"a":1}', "note="],
      }),
    );

    expect(composePayload(fields, undefined, patch)).toEqual({
      name: "a=b",
      tags: ["x", "y", "z"],
      enabled: false,
      weight: 1.5,
      config: { a: 1 },
      note: "",
    });
  });

  it("should reject an unknown field, naming the valid ones", () => {
    expect(() => parseFlagPatch(fields, flags({ set: ["nmae=x"] }))).toThrow(
      expect.objectContaining({
        exitCode: 2,
        message: expect.stringContaining("name, note, tags, enabled, weight, config"),
      }),
    );
  });

  it("should reject a read-only field", () => {
    expect(() => parseFlagPatch(fields, flags({ set: ["id=3"] }))).toThrow(/read-only/);
    expect(() => parseFlagPatch(fields, flags({ data: '{"updated_at":"x"}' }))).toThrow(
      /read-only/,
    );
  });

  it("should reject a value its field cannot hold without echoing the value", () => {
    expect(() => parseFlagPatch(fields, flags({ set: ["enabled=maybe"] }))).toThrow(
      expect.objectContaining({ exitCode: 2, message: expect.not.stringContaining("maybe") }),
    );
    expect(() => parseFlagPatch(fields, flags({ set: ["weight=heavy"] }))).toThrow(/number/);
  });

  it("should reject --set without a value", () => {
    expect(() => parseFlagPatch(fields, flags({ set: ["name"] }))).toThrow(/<field>=<value>/);
  });

  it("should not take keys inherited from Object.prototype as fields", () => {
    expect(() => parseFlagPatch(fields, flags({ set: ["toString=1"] }))).toThrow(/unknown field/);
    expect(() => parseFlagPatch(fields, flags({ set: ["__proto__=1"] }))).toThrow(
      /unknown field/,
    );
    expect(composePayload(fields, JSON.parse('{"constructor":1}'), parseFlagPatch(fields, flags()))).toEqual(
      {},
    );
  });

  it("should reject a wrong type in --data as a usage error", () => {
    expect(() => parseFlagPatch(fields, flags({ data: '{"enabled":"yes"}' }))).toThrow(
      expect.objectContaining({ exitCode: 2 }),
    );
  });

  it("should clear a nullable field with --unset", () => {
    const patch = parseFlagPatch(fields, flags({ unset: ["note"] }));

    expect(composePayload(fields, { note: "old" }, patch)).toEqual({ note: null });
  });

  it("should refuse to --unset a field the API cannot clear, naming the ones it can", () => {
    expect(() => parseFlagPatch(fields, flags({ unset: ["name"] }))).toThrow(
      expect.objectContaining({ exitCode: 2, message: expect.stringContaining("note, config") }),
    );
    expect(() => parseFlagPatch(fields, flags({ data: '{"tags":null}' }))).toThrow(/tags/);
  });

  it("should reject --data that is not a JSON object without echoing it", () => {
    expect(() => parseFlagPatch(fields, flags({ data: '{"note":"s3cret"' }))).toThrow(
      expect.objectContaining({ exitCode: 2, message: expect.not.stringContaining("s3cret") }),
    );
    expect(() => parseFlagPatch(fields, flags({ data: "[1]" }))).toThrow(/object/);
  });
});

describe("composePayload", () => {
  it("should apply the input line, then --data, then --set", () => {
    const patch = parseFlagPatch(
      fields,
      flags({ data: '{"name":"from-data","weight":2}', set: ["weight=3"] }),
    );

    expect(composePayload(fields, { name: "from-line", note: "kept" }, patch)).toEqual({
      name: "from-data",
      note: "kept",
      weight: 3,
    });
  });

  it("should merge --data into a json field as a merge patch", () => {
    const patch = parseFlagPatch(fields, flags({ data: '{"config":{"a":null,"b":{"c":1}}}' }));

    expect(composePayload(fields, { config: { a: 1, b: { d: 2 } } }, patch)).toEqual({
      config: { b: { c: 1, d: 2 } },
    });
  });

  it("should take only writable fields from an input line", () => {
    const line = { id: 1, updated_at: "t", _skipped: true, added_later: "x", name: "a" };

    expect(composePayload(fields, line, parseFlagPatch(fields, flags()))).toEqual({ name: "a" });
  });

  it("should fail a line whose field has the wrong type", () => {
    const patch = parseFlagPatch(fields, flags());

    expect(() => composePayload(fields, { name: 5 }, patch)).toThrow(
      expect.objectContaining({ exitCode: 1, message: expect.stringContaining('"name"') }),
    );
    expect(() => composePayload(fields, { tags: ["a", 1] }, patch)).toThrow(/list of strings/);
    expect(() => composePayload(fields, { name: null }, patch)).toThrow(/name/);
    expect(composePayload(fields, { note: null, config: [1] }, patch)).toEqual({
      note: null,
      config: [1],
    });
  });
});
