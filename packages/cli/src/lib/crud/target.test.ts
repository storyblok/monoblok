import { describe, expect, it } from "vitest";
import { resolveTarget } from "./target";

const records = [
  { id: 1, name: "deploy" },
  { id: 2, name: "42" },
  { id: 3, name: "twin" },
  { id: 4, name: "twin" },
];
const noun = { singular: "webhook", plural: "webhooks" };

describe("resolveTarget", () => {
  it("should resolve an all-digit target as an id", () => {
    expect(resolveTarget("1", records, { nameField: "name", noun })).toEqual(records[0]);
  });

  it("should fall back to a name when no id matches", () => {
    expect(resolveTarget("42", records, { nameField: "name", noun })).toEqual(records[1]);
    expect(resolveTarget("deploy", records, { nameField: "name", noun })).toEqual(records[0]);
  });

  it("should fail when nothing matches, without repeating the target", () => {
    expect(() => resolveTarget("nope", records, { nameField: "name", noun })).toThrow(
      expect.objectContaining({ exitCode: 1, message: expect.not.stringContaining("nope") }),
    );
  });

  it("should fail on a name several records share, listing their ids", () => {
    expect(() => resolveTarget("twin", records, { nameField: "name", noun })).toThrow(
      expect.objectContaining({ exitCode: 1, message: expect.stringContaining("3, 4") }),
    );
  });

  it("should only take ids when the resource has no unique name", () => {
    expect(() => resolveTarget("deploy", records, { noun })).toThrow(/ID\./);
  });
});
