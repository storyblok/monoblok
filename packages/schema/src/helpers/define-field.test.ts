import { describe, expect, it } from "vitest";
import { defineField } from "./define-field";
import { defineFolder } from "./define-folder";

describe("defineField", () => {
  it("should normalize folder refs in allow to tagged path entries", () => {
    const heros = defineFolder({ name: "Heros", parent: defineFolder({ name: "Layout" }) });
    const field = defineField("body", { type: "bloks", allow: [heros] });
    expect(field.allow).toEqual([{ folder: "Layout/Heros" }]);
  });

  it("should throw when allow mixes blocks and folders", () => {
    const heros = defineFolder({ name: "Heros" });
    expect(() => defineField("body", { type: "bloks", allow: [heros, "teaser"] })).toThrow(
      'defineField: "allow" on field "body" mixes block and folder references; the editor restricts by either blocks or folders, not both',
    );
  });

  it("should keep block-only allow unchanged", () => {
    const field = defineField("body", { type: "bloks", allow: ["teaser"] });
    expect(field.allow).toEqual(["teaser"]);
  });

  it("should normalize block refs in deny to their names", () => {
    const hero = { name: "hero", fields: [] } as const;
    const field = defineField("body", { type: "bloks", deny: [hero, "banner"] });
    expect(field.deny).toEqual(["hero", "banner"]);
  });

  it("should normalize folder refs in deny to tagged path entries", () => {
    // A folder ref carries a `name` too, so it structurally passes for a block
    // ref; only the `path` guard tells the two apart.
    const heros = defineFolder({ name: "Heros", parent: defineFolder({ name: "Layout" }) });
    const field = defineField("body", { type: "bloks", deny: [heros] });
    expect(field.deny).toEqual([{ folder: "Layout/Heros" }]);
  });

  it("should throw when deny mixes blocks and folders", () => {
    const heros = defineFolder({ name: "Heros" });
    expect(() => defineField("body", { type: "bloks", deny: [heros, "teaser"] })).toThrow(
      'defineField: "deny" on field "body" mixes block and folder references; the editor restricts by either blocks or folders, not both',
    );
  });

  it("should keep allow and deny that restrict by the same dimension", () => {
    const field = defineField("body", {
      type: "bloks",
      allow: ["teaser", "banner"],
      deny: ["banner"],
    });
    expect(field.allow).toEqual(["teaser", "banner"]);
    expect(field.deny).toEqual(["banner"]);
  });

  it("should throw when allow and deny restrict by different dimensions", () => {
    const heros = defineFolder({ name: "Heros" });
    expect(() => defineField("body", { type: "bloks", allow: [heros], deny: ["teaser"] })).toThrow(
      'defineField: "allow" and "deny" on field "body" mix block and folder references; the editor restricts by either blocks or folders, not both',
    );
  });

  it("should throw when deny is used on a field type with no denylist", () => {
    expect(() => defineField("link", { type: "multilink", deny: ["page"] })).toThrow(
      'defineField: "deny" on field "link" has no effect on a "multilink" field; only bloks and richtext fields have a block denylist',
    );
  });

  it("should allow deny on richtext as well as bloks", () => {
    expect(defineField("prose", { type: "richtext", deny: ["banner"] }).deny).toEqual(["banner"]);
    expect(defineField("body", { type: "bloks", deny: ["banner"] }).deny).toEqual(["banner"]);
  });

  it("should not throw on an empty deny list, whatever the field type", () => {
    expect(() => defineField("title", { type: "text", deny: [] })).not.toThrow();
  });

  it("should not treat an empty allow list as a conflicting dimension", () => {
    const heros = defineFolder({ name: "Heros" });
    const field = defineField("body", { type: "bloks", allow: [], deny: [heros] });
    expect(field.allow).toEqual([]);
    expect(field.deny).toEqual([{ folder: "Heros" }]);
  });
});
