import { describe, expect, it } from "vitest";

import type { ComponentFolder } from "../../types";
import { buildGroupPathByUuid, expandFolderPath, mapSchemaGroupLists } from "./folders";

function folder(
  partial: Partial<ComponentFolder> & { name: string; uuid: string },
): ComponentFolder {
  return { id: 1, parent_id: null, parent_uuid: null, ...partial };
}

describe("buildGroupPathByUuid", () => {
  it("builds slugified path segments, walking the parent chain", () => {
    const layout = folder({ name: "My Layout", uuid: "layout-uuid" });
    const nested = folder({
      name: "Hero Sections",
      uuid: "nested-uuid",
      parent_uuid: "layout-uuid",
    });

    const paths = buildGroupPathByUuid([layout, nested]);

    expect(paths.get("layout-uuid")).toEqual(["my-layout"]);
    expect(paths.get("nested-uuid")).toEqual(["my-layout", "hero-sections"]);
  });

  it("returns root groups as a single slugified segment", () => {
    const paths = buildGroupPathByUuid([folder({ name: "Content", uuid: "content-uuid" })]);
    expect(paths.get("content-uuid")).toEqual(["content"]);
  });

  it("does not overflow on a self-referential group (parent_uuid === uuid)", () => {
    const loopy = folder({ name: "Loopy", uuid: "self-uuid", parent_uuid: "self-uuid" });

    const paths = buildGroupPathByUuid([loopy]);

    // Cyclic ancestry is broken: the group is treated as a path root.
    expect(paths.get("self-uuid")).toEqual(["loopy"]);
  });

  it("does not overflow on a multi-group parent cycle (A -> B -> A)", () => {
    const a = folder({ name: "A", uuid: "uuid-a", parent_uuid: "uuid-b" });
    const b = folder({ name: "B", uuid: "uuid-b", parent_uuid: "uuid-a" });

    expect(() => buildGroupPathByUuid([a, b])).not.toThrow();
  });
});

describe("expandFolderPath", () => {
  it("should expand a nested path parent-first", () => {
    expect(expandFolderPath("Layout/Heros")).toEqual([
      { name: "Layout", path: "layout", parentPath: null },
      { name: "Heros", path: "layout/heros", parentPath: "layout" },
    ]);
  });

  it("should handle a root path", () => {
    expect(expandFolderPath("Layout")).toEqual([
      { name: "Layout", path: "layout", parentPath: null },
    ]);
  });

  it("should drop a middle segment that slugifies to empty (matching slugifyPath identity)", () => {
    expect(expandFolderPath("Layout/&/Heros")).toEqual([
      { name: "Layout", path: "layout", parentPath: null },
      { name: "Heros", path: "layout/heros", parentPath: "layout" },
    ]);
  });
});

describe("mapSchemaGroupLists", () => {
  it("should map both the group whitelist and the group denylist", () => {
    const schema = {
      body: {
        type: "bloks",
        component_group_whitelist: ["path-a"],
        component_group_denylist: ["path-b"],
      },
    };

    expect(mapSchemaGroupLists(schema, (entry) => `uuid-${entry}`)).toEqual({
      body: {
        type: "bloks",
        component_group_whitelist: ["uuid-path-a"],
        component_group_denylist: ["uuid-path-b"],
      },
    });
  });

  it("should leave fields without a group list untouched and never mutate the source", () => {
    const field = { type: "bloks", component_whitelist: ["hero"] };
    const schema = { body: field };

    expect(mapSchemaGroupLists(schema, () => "mapped")).toEqual(schema);
    expect(field.component_whitelist).toEqual(["hero"]);
  });

  it("should keep non-string entries as they are", () => {
    const schema = { body: { component_group_denylist: [null, "path-a"] } };

    expect(mapSchemaGroupLists(schema, () => "mapped")).toEqual({
      body: { component_group_denylist: [null, "mapped"] },
    });
  });
});
