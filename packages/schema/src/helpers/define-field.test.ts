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
      'defineField: "allow" on field "body" mixes block and folder references; the editor restricts by blocks, folders, or tags, not a combination',
    );
  });

  it("should keep tag refs in allow as named tag entries", () => {
    const field = defineField("body", { type: "bloks", allow: [{ tag: "Marketing" }] });
    expect(field.allow).toEqual([{ tag: "Marketing" }]);
  });

  it("should keep tag refs in deny as named tag entries", () => {
    const field = defineField("body", { type: "bloks", deny: [{ tag: "Legacy" }] });
    expect(field.deny).toEqual([{ tag: "Legacy" }]);
  });

  it("should trim surrounding whitespace from tag refs so they match a block's tags", () => {
    const field = defineField("body", { type: "bloks", allow: [{ tag: " Marketing " }] });
    expect(field.allow).toEqual([{ tag: "Marketing" }]);
  });

  it("should drop a tag named twice in allow", () => {
    const field = defineField("body", {
      type: "bloks",
      allow: [{ tag: "Marketing" }, { tag: " Marketing" }],
    });
    expect(field.allow).toEqual([{ tag: "Marketing" }]);
  });

  it("should throw when a tag ref in allow is blank", () => {
    expect(() => defineField("body", { type: "bloks", allow: [{ tag: "   " }] })).toThrow(
      'defineField: "allow" on field "body" has an empty tag reference',
    );
  });

  it("should throw when a tag ref in deny is blank", () => {
    expect(() => defineField("body", { type: "bloks", deny: [{ tag: "" }] })).toThrow(
      'defineField: "deny" on field "body" has an empty tag reference',
    );
  });

  it("should throw when allow mixes tags and blocks", () => {
    expect(() =>
      defineField("body", { type: "bloks", allow: [{ tag: "Marketing" }, "teaser"] }),
    ).toThrow(
      'defineField: "allow" on field "body" mixes block and tag references; the editor restricts by blocks, folders, or tags, not a combination',
    );
  });

  it("should throw when allow mixes tags and folders", () => {
    const heros = defineFolder({ name: "Heros" });
    expect(() =>
      defineField("body", { type: "bloks", allow: [{ tag: "Marketing" }, heros] }),
    ).toThrow(
      'defineField: "allow" on field "body" mixes folder and tag references; the editor restricts by blocks, folders, or tags, not a combination',
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
      'defineField: "deny" on field "body" mixes block and folder references; the editor restricts by blocks, folders, or tags, not a combination',
    );
  });

  it("should throw when allow and deny are both set", () => {
    expect(() =>
      defineField("body", { type: "bloks", allow: ["teaser", "banner"], deny: ["banner"] }),
    ).toThrow(
      'defineField: "allow" and "deny" on field "body" cannot both be set; the editor ignores the denylist whenever the allow list is non-empty, so list only the blocks you want in "allow"',
    );
  });

  it("should throw when allow and deny are both set across dimensions", () => {
    const heros = defineFolder({ name: "Heros" });
    expect(() => defineField("body", { type: "bloks", allow: [heros], deny: ["teaser"] })).toThrow(
      'defineField: "allow" and "deny" on field "body" cannot both be set',
    );
  });

  it("should throw when deny is used on a field type with no denylist", () => {
    // The stricter `defineField` signature also rejects this at compile time. The
    // runtime guard still matters: schemas authored in plain JavaScript reach the
    // wire without ever being type-checked.
    // @ts-expect-error `multilink` has no denylist
    expect(() => defineField("link", { type: "multilink", deny: ["page"] })).toThrow(
      'defineField: "deny" on field "link" has no effect on a "multilink" field; only bloks and richtext fields have a block denylist',
    );
  });

  it("should allow deny on richtext as well as bloks", () => {
    expect(defineField("prose", { type: "richtext", deny: ["banner"] }).deny).toEqual(["banner"]);
    expect(defineField("body", { type: "bloks", deny: ["banner"] }).deny).toEqual(["banner"]);
  });

  it("should not throw on an empty deny list, whatever the field type", () => {
    // @ts-expect-error `text` has no denylist; the runtime guard still tolerates an empty list
    expect(() => defineField("title", { type: "text", deny: [] })).not.toThrow();
  });

  it("should not treat an empty allow list as a conflicting dimension", () => {
    const heros = defineFolder({ name: "Heros" });
    const field = defineField("body", { type: "bloks", allow: [], deny: [heros] });
    expect(field.allow).toEqual([]);
    expect(field.deny).toEqual([{ folder: "Heros" }]);
  });
});
