import { describe, expect, it } from "vitest";

import type { Component, ComponentFolder, Datasource, InternalTag } from "../../types";
import type { LocalFolder, NormalizedSchema } from "./types";
import { remoteToNormalized } from "./actions";
import { diffSchema } from "./diff-schema";

type Dimension = Datasource["dimensions"][number];

function makeComponent(name: string, schema: Record<string, unknown>) {
  return { id: 1, name, created_at: "", updated_at: "", schema } as unknown as Component;
}

/** A datasource as a schema file defines it: no API-assigned dimension list. */
function makeDatasource(name: string, slug: string) {
  return { id: 1, name, slug, created_at: "", updated_at: "" } as unknown as Datasource;
}

/** A datasource as a space returns it, dimension list included. */
function makeDimensionedDatasource(
  name: string,
  slug: string,
  dimensions: Dimension[],
): Datasource {
  return { ...makeDatasource(name, slug), dimensions };
}

/** Builds a {@link NormalizedSchema} the way a schema loaded from code is built. */
function normalized(
  components: Component[] = [],
  datasources: Datasource[] = [],
  folders: LocalFolder[] = [],
): NormalizedSchema {
  return {
    components: new Map(components.map((c) => [c.name, c])),
    datasources: new Map(datasources.map((d) => [d.name, d])),
    folders: new Map(folders.map((f) => [f.path, f])),
  };
}

/**
 * Builds a {@link NormalizedSchema} the way a schema read from a space is built,
 * so group uuids resolve to slug paths exactly as they do in the command.
 */
function normalizedRemote(
  components: Component[] = [],
  groups: { uuid: string; name: string; parent_uuid?: string | null }[] = [],
  datasources: Datasource[] = [],
  tags: { id: number; name: string }[] = [],
): NormalizedSchema {
  const componentFolders = new Map<string, ComponentFolder>(
    groups.map((group) => [
      group.name,
      {
        id: 1,
        uuid: group.uuid,
        name: group.name,
        parent_uuid: group.parent_uuid ?? null,
      } as unknown as ComponentFolder,
    ]),
  );
  return remoteToNormalized({
    components: new Map(components.map((c) => [c.name, c])),
    datasources: new Map(datasources.map((d) => [d.name, d])),
    componentFolders,
    internalTags: new Map(tags.map((tag) => [tag.name, tag as unknown as InternalTag])),
  });
}

// `diffSchema(from, to)` describes how to get from base (`from`) to target (`to`).
// For push semantics, from = remote, to = local.
describe("diffSchema", () => {
  it("should detect entities only in the target as create", () => {
    const from = normalized();
    const to = normalized([makeComponent("page", { title: { type: "text", pos: 0 } })]);

    const result = diffSchema(from, to);

    expect(result.creates).toBe(1);
    expect(result.diffs[0].action).toBe("create");
    expect(result.diffs[0].name).toBe("page");
    expect(result.diffs[0].after).toMatchObject({ name: "page" });
  });

  it("should detect unchanged entities", () => {
    const comp = makeComponent("page", { title: { type: "text", pos: 0 } });
    const from = normalized([{ ...comp, id: 99 } as Component]);
    const to = normalized([comp]);

    const result = diffSchema(from, to);

    expect(result.unchanged).toBe(1);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should detect updated entities with field-level changes", () => {
    const remoteComp = makeComponent("page", { title: { type: "text", pos: 0, max_length: 60 } });
    const localComp = makeComponent("page", { title: { type: "text", pos: 0, max_length: 70 } });

    const result = diffSchema(
      normalized([{ ...remoteComp, id: 99 } as Component]),
      normalized([localComp]),
    );

    expect(result.updates).toBe(1);
    expect(result.diffs[0].action).toBe("update");
    const titleChange = result.diffs[0].changes.find((c) => c.field === "schema.title.max_length");
    expect(titleChange?.change).toBe("modified");
    expect(titleChange?.before).toBe(60);
    expect(titleChange?.after).toBe(70);
  });

  it("should report an added schema field as an added change", () => {
    const remoteComp = makeComponent("page", { title: { type: "text", pos: 0 } });
    const localComp = makeComponent("page", {
      title: { type: "text", pos: 0 },
      subtitle: { type: "text", pos: 1 },
    });

    const result = diffSchema(
      normalized([{ ...remoteComp, id: 99 } as Component]),
      normalized([localComp]),
    );

    const subtitle = result.diffs[0].changes.find((c) => c.field === "schema.subtitle");
    expect(subtitle?.change).toBe("added");
    expect(subtitle?.after).toMatchObject({ type: "text" });
  });

  it("should report a removed schema field as a removed change", () => {
    const remoteComp = makeComponent("page", {
      title: { type: "text", pos: 0 },
      subtitle: { type: "text", pos: 1 },
    });
    const localComp = makeComponent("page", { title: { type: "text", pos: 0 } });

    const result = diffSchema(
      normalized([{ ...remoteComp, id: 99 } as Component]),
      normalized([localComp]),
    );

    const subtitle = result.diffs[0].changes.find((c) => c.field === "schema.subtitle");
    expect(subtitle?.change).toBe("removed");
    expect(subtitle?.before).toMatchObject({ type: "text" });
  });

  it("should detect entities only in the base as stale", () => {
    const from = normalized([makeComponent("footer", {})]);
    const to = normalized();

    const result = diffSchema(from, to);

    expect(result.stale).toBe(1);
    expect(result.diffs[0].action).toBe("stale");
    expect(result.diffs[0].name).toBe("footer");
    expect(result.diffs[0].before).toMatchObject({ name: "footer" });
  });

  it("should not show a change for auto-populated defaults (e.g. internal_tag_ids)", () => {
    const localComp = makeComponent("page", { title: { type: "text", pos: 0 } });
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: [],
    } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it("should show a change when target explicitly sets internal_tag_ids differently", () => {
    const localComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: [10],
    } as unknown as Component;
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: [],
    } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some((c) => c.field === "internal_tag_ids")).toBe(true);
  });

  it("should not show a change when base has an empty description and target does not set it", () => {
    const localComp = makeComponent("test", { title: { type: "text", pos: 0 } });
    const remoteComp = {
      ...makeComponent("test", { title: { type: "text", pos: 0 } }),
      description: "",
    } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it("should show a change when the target removes a base description", () => {
    const localComp = makeComponent("test", { title: { type: "text", pos: 0 } });
    const remoteComp = {
      ...makeComponent("test", { title: { type: "text", pos: 0 } }),
      description: "A test block",
    } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some((c) => c.field === "description")).toBe(true);
  });

  it("should report the datasource dimension that changed rather than the whole list", () => {
    const dimensions = (entryValue: string): Dimension[] => [
      { id: 1, name: "de", entry_value: "farben" },
      { id: 2, name: "fr", entry_value: entryValue },
    ];
    const from = normalized(
      [],
      [makeDimensionedDatasource("Colors", "colors", dimensions("couleurs"))],
    );
    const to = normalized(
      [],
      [makeDimensionedDatasource("Colors", "colors", dimensions("teintes"))],
    );

    const result = diffSchema(from, to);

    expect(result.diffs[0].changes).toEqual([
      {
        field: "dimensions.fr.entry_value",
        change: "modified",
        before: "couleurs",
        after: "teintes",
      },
    ]);
  });

  it("should not report a reordered dimension list as a change without saying what changed", () => {
    const de: Dimension = { id: 1, name: "de", entry_value: "farben" };
    const fr: Dimension = { id: 2, name: "fr", entry_value: "couleurs" };
    const from = normalized([], [makeDimensionedDatasource("Colors", "colors", [de, fr])]);
    const to = normalized([], [makeDimensionedDatasource("Colors", "colors", [fr, de])]);

    const changes = diffSchema(from, to).diffs[0].changes;
    expect(changes.map((c) => c.field)).toEqual(["dimensions"]);
  });

  it("should treat a datasource without dimensions as unchanged when base has empty dimensions", () => {
    const from = normalized([], [makeDimensionedDatasource("Colors", "colors", [])]);
    const to = normalized([], [makeDatasource("Colors", "colors")]);

    const result = diffSchema(from, to);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it("should not diff component_group_uuid when the target does not opt into the escape hatch", () => {
    const localComp = makeComponent("page", { title: { type: "text", pos: 0 } });
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      component_group_uuid: "group-uuid",
    } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]), {
      compareGroupUuid: true,
    });

    expect(result.unchanged).toBe(1);
    expect(result.updates).toBe(0);
  });

  it("should diff component_group_uuid when the target sets it (group escape hatch)", () => {
    const localComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      component_group_uuid: "new-group",
    } as Component;
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      component_group_uuid: "old-group",
    } as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]), {
      compareGroupUuid: true,
    });

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some((c) => c.field === "component_group_uuid")).toBe(true);
  });

  it("should not show a change when a raw internal_tag_ids entry differs only in JS type", () => {
    // The component serializer returns tag ids as strings; a schema managing tags
    // by raw id usually holds the numbers they were pasted from.
    const localComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: [219987616121914],
    } as unknown as Component;
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: ["219987616121914"],
    } as unknown as Component;

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should not show a change when the target names the tags the base holds as ids", () => {
    const localComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      tags: ["Marketing"],
    } as unknown as Component;
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: ["7"],
    } as unknown as Component;

    const result = diffSchema(
      normalizedRemote([remoteComp], [], [], [{ id: 7, name: "Marketing" }]),
      normalized([localComp]),
    );

    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should show a change when the target names a different tag than the base holds", () => {
    const localComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      tags: ["Editorial"],
    } as unknown as Component;
    const remoteComp = {
      ...makeComponent("page", { title: { type: "text", pos: 0 } }),
      internal_tag_ids: ["7"],
    } as unknown as Component;

    const result = diffSchema(
      normalizedRemote([remoteComp], [], [], [{ id: 7, name: "Marketing" }]),
      normalized([localComp]),
    );

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes.some((c) => c.field === "tags")).toBe(true);
  });

  it("should compare a field tag list in name space", () => {
    const localComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, component_tag_whitelist: ["Marketing"] },
    });
    const remoteComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, component_tag_whitelist: [7] },
    });

    const result = diffSchema(
      normalizedRemote([remoteComp], [], [], [{ id: 7, name: "Marketing" }]),
      normalized([localComp]),
    );

    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should compare tags by name when the base is the block written in code", () => {
    // `--from <file> --to <space>` is the same comparison as push, reversed; the
    // side declaring `tags` is the base here.
    const localComp = {
      ...makeComponent("page", {}),
      tags: ["Marketing"],
    } as unknown as Component;
    const remoteComp = {
      ...makeComponent("page", {}),
      internal_tag_ids: ["7"],
    } as unknown as Component;

    const result = diffSchema(
      normalized([localComp]),
      normalizedRemote([remoteComp], [], [], [{ id: 7, name: "Marketing" }]),
    );

    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should report a tag the target space dropped from a block written in code", () => {
    const localComp = {
      ...makeComponent("page", {}),
      tags: ["Marketing"],
    } as unknown as Component;
    const remoteComp = {
      ...makeComponent("page", {}),
      internal_tag_ids: [],
    } as unknown as Component;

    const result = diffSchema(
      normalized([localComp]),
      normalizedRemote([remoteComp], [], [], [{ id: 7, name: "Marketing" }]),
    );

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes).toContainEqual(
      expect.objectContaining({ field: "tags", before: ["Marketing"], after: [] }),
    );
  });

  it("should name the base space's tags when the target schema does not mention tags", () => {
    // `schema init` emits no `tags` key for an untagged block, so this is the
    // shape a user most often diffs a space against.
    const remoteComp = {
      ...makeComponent("hero", {}),
      internal_tag_ids: ["220685625652618"],
    } as unknown as Component;

    const diff = diffSchema(
      normalizedRemote([remoteComp], [], [], [{ id: 220685625652618, name: "promo" }]),
      normalized([makeComponent("hero", {})]),
    ).diffs[0];

    expect(diff.changes).toContainEqual(
      expect.objectContaining({ field: "tags", before: ["promo"], after: [] }),
    );
    expect(JSON.stringify(diff.changes)).not.toContain("220685625652618");
  });

  it("should treat two spaces naming a block's tags the same as unchanged", () => {
    // Tag ids are per-space. Neither side carries a `tags` key (the API returns
    // ids), so without resolving both to names every tagged block in the space
    // would report as changed.
    const inSpaceA = {
      ...makeComponent("hero", {}),
      internal_tag_ids: ["100"],
    } as unknown as Component;
    const inSpaceB = {
      ...makeComponent("hero", {}),
      internal_tag_ids: ["200"],
    } as unknown as Component;

    const result = diffSchema(
      normalizedRemote([inSpaceA], [], [], [{ id: 100, name: "Marketing" }]),
      normalizedRemote([inSpaceB], [], [], [{ id: 200, name: "Marketing" }]),
    );

    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should show a change when two spaces tag a block differently", () => {
    const inSpaceA = {
      ...makeComponent("hero", {}),
      internal_tag_ids: ["100"],
    } as unknown as Component;
    const inSpaceB = {
      ...makeComponent("hero", {}),
      internal_tag_ids: ["200"],
    } as unknown as Component;

    const result = diffSchema(
      normalizedRemote([inSpaceA], [], [], [{ id: 100, name: "Marketing" }]),
      normalizedRemote([inSpaceB], [], [], [{ id: 200, name: "Editorial" }]),
    );

    expect(result.updates).toBe(1);
    expect(result.diffs[0].changes).toContainEqual(
      expect.objectContaining({ field: "tags", before: ["Marketing"], after: ["Editorial"] }),
    );
  });

  it("should resolve a target's raw tag id against the base space", () => {
    // `schema init` emits raw ids, so a local block can hold an id the space it
    // was pulled from is the only side able to name.
    const localComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, component_tag_whitelist: [7] },
    });
    const remoteComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, component_tag_whitelist: ["Marketing"] },
    });

    const result = diffSchema(
      normalizedRemote([remoteComp], [], [], [{ id: 7, name: "Marketing" }]),
      normalized([localComp]),
    );

    expect(result.updates).toBe(0);
    expect(result.diffs[0].action).toBe("unchanged");
  });

  it("should treat components differing only by component_group_uuid as unchanged for space-to-space diffs", () => {
    // Group UUIDs are per-space identifiers; without opting in (the default, as
    // used for space-to-space diffs) they must not surface as a change.
    const spaceA = {
      ...makeComponent("hero", { title: { type: "text", pos: 0 } }),
      component_group_uuid: "group-a",
    } as Component;
    const spaceB = {
      ...makeComponent("hero", { title: { type: "text", pos: 0 } }),
      component_group_uuid: "group-b",
    } as Component;

    const result = diffSchema(normalized([spaceA]), normalized([spaceB]));

    expect(result.updates).toBe(0);
    expect(result.unchanged).toBe(1);
    expect(result.diffs[0].changes.some((c) => c.field === "component_group_uuid")).toBe(false);
  });

  it("should report the individual property that changed inside a schema field", () => {
    const remoteComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, maximum: 10, description: "Main content" },
    });
    const localComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, maximum: 12, description: "Main content" },
    });

    const result = diffSchema(
      normalized([{ ...remoteComp, id: 99 } as Component]),
      normalized([localComp]),
    );

    expect(result.diffs[0].changes).toEqual([
      { field: "schema.body.maximum", change: "modified", before: 10, after: 12 },
    ]);
  });

  it("should keep a schema field distinct from a top-level property of the same name", () => {
    const remoteComp = { ...makeComponent("page", { folder: { type: "text", pos: 0 } }) };
    const localComp = {
      ...makeComponent("page", { folder: { type: "textarea", pos: 0 } }),
      folder: "layout",
    } as Component;

    const result = diffSchema(
      normalizedRemote([remoteComp as Component], [{ uuid: "u1", name: "Layout" }]),
      normalized([localComp]),
    );

    const fields = result.diffs.find((d) => d.name === "page")?.changes.map((c) => c.field);
    expect(fields).toContain("folder");
    expect(fields).toContain("schema.folder.type");
  });

  it("should report folders present only in the target as create", () => {
    const result = diffSchema(
      normalizedRemote(),
      normalized([], [], [{ name: "Layout", path: "layout", parentPath: null }]),
    );

    expect(result.diffs).toContainEqual(
      expect.objectContaining({ type: "folder", name: "layout", action: "create" }),
    );
  });

  it("should report folders present only in the base as stale", () => {
    const result = diffSchema(normalizedRemote([], [{ uuid: "u1", name: "Old" }]), normalized());

    expect(result.diffs).toContainEqual(
      expect.objectContaining({ type: "folder", name: "old", action: "stale" }),
    );
  });

  it("should match folders case-insensitively via slug paths", () => {
    const result = diffSchema(
      normalizedRemote([], [{ uuid: "u1", name: "Layout" }]),
      normalized([], [], [{ name: "layout", path: "layout", parentPath: null }]),
    );

    expect(result.diffs).toContainEqual(
      expect.objectContaining({ type: "folder", name: "layout", action: "unchanged" }),
    );
  });

  it("should diff a block's group membership in slug-path space", () => {
    const remoteComp = {
      ...makeComponent("hero", {}),
      component_group_uuid: "u-other",
    } as Component;
    const localComp = { ...makeComponent("hero", {}), folder: "layout" } as Component;

    const result = diffSchema(
      normalizedRemote(
        [remoteComp],
        [
          { uuid: "u1", name: "Layout" },
          { uuid: "u-other", name: "Other" },
        ],
      ),
      normalized([localComp], [], [{ name: "Layout", path: "layout", parentPath: null }]),
    );

    const hero = result.diffs.find((d) => d.type === "component" && d.name === "hero");
    expect(hero?.action).toBe("update");
    expect(hero?.changes).toContainEqual(
      expect.objectContaining({ field: "folder", before: "other", after: "layout" }),
    );
  });

  it("should report an explicitly ungrouped target block as null, not the cleaning sentinel", () => {
    const remoteComp = { ...makeComponent("hero", {}), folder: "layout" } as unknown as Component;
    const localComp = { ...makeComponent("hero", {}), folder: null } as unknown as Component;

    const diff = diffSchema(normalized([remoteComp]), normalized([localComp])).diffs[0];

    expect(diff.changes).toContainEqual(
      expect.objectContaining({ field: "folder", before: "layout", after: null }),
    );
    expect(JSON.stringify(diff)).not.toContain("FOLDER_UNGROUPED");
  });

  it("should carry an ungrouped block's folder as null into the payload of a one-sided entity", () => {
    const localComp = { ...makeComponent("hero", {}), folder: null } as unknown as Component;

    const diff = diffSchema(normalized(), normalized([localComp])).diffs[0];

    expect(diff.action).toBe("create");
    expect(diff.after).toMatchObject({ folder: null });
    expect(JSON.stringify(diff)).not.toContain("FOLDER_UNGROUPED");
  });

  it("should treat a grouped remote block as unchanged when the target declares no folder", () => {
    // A block without a `folder` key does not manage its group, so the remote UI
    // grouping must not surface as a change and must not be pushed away.
    const remoteComp = {
      ...makeComponent("hero", {}),
      component_group_uuid: "u-layout",
    } as Component;

    const result = diffSchema(
      normalizedRemote([remoteComp], [{ uuid: "u-layout", name: "Layout" }]),
      normalized([makeComponent("hero", {})]),
    );

    const hero = result.diffs.find((d) => d.type === "component" && d.name === "hero");
    expect(hero?.action).toBe("unchanged");
  });

  it("should treat a target folder path as unchanged against the remote group it names", () => {
    const remoteComp = {
      ...makeComponent("hero", {}),
      component_group_uuid: "u-layout",
    } as Component;
    const localComp = { ...makeComponent("hero", {}), folder: "layout" } as Component;

    const result = diffSchema(
      normalizedRemote([remoteComp], [{ uuid: "u-layout", name: "Layout" }]),
      normalized([localComp], [], [{ name: "Layout", path: "layout", parentPath: null }]),
    );

    const hero = result.diffs.find((d) => d.type === "component" && d.name === "hero");
    expect(hero?.action).toBe("unchanged");
  });

  it("should carry the folder of a block the target alone holds", () => {
    // Replaying a `create` has to put the block in the folder the diff also
    // reports creating; without `folder` on the payload it lands ungrouped.
    const remoteComp = {
      ...makeComponent("quote", {}),
      component_group_uuid: "u-editorial",
    } as Component;

    const result = diffSchema(
      normalized(),
      normalizedRemote([remoteComp], [{ uuid: "u-editorial", name: "Editorial" }]),
    );

    const quote = result.diffs.find((d) => d.type === "component" && d.name === "quote");
    expect(quote?.action).toBe("create");
    expect(quote?.after).toMatchObject({ folder: "editorial" });
  });

  it("should carry the declared folder of a local block the base does not hold", () => {
    const localComp = { ...makeComponent("promo", {}), folder: "promo-folder" } as Component;

    const result = diffSchema(
      normalized(),
      normalized(
        [localComp],
        [],
        [{ name: "Promo Folder", path: "promo-folder", parentPath: null }],
      ),
    );

    const promo = result.diffs.find((d) => d.type === "component" && d.name === "promo");
    expect(promo?.after).toMatchObject({ folder: "promo-folder" });
  });

  it("should carry the folder of a stale block the base alone holds", () => {
    const remoteComp = {
      ...makeComponent("quote", {}),
      component_group_uuid: "u-editorial",
    } as Component;

    const result = diffSchema(
      normalizedRemote([remoteComp], [{ uuid: "u-editorial", name: "Editorial" }]),
      normalized(),
    );

    const quote = result.diffs.find((d) => d.type === "component" && d.name === "quote");
    expect(quote?.action).toBe("stale");
    expect(quote?.before).toMatchObject({ folder: "editorial" });
  });

  it("should treat an empty restriction list as equal to an omitted one", () => {
    const remoteComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, component_group_whitelist: [], component_whitelist: [] },
    });
    const localComp = makeComponent("page", { body: { type: "bloks", pos: 0 } });

    const result = diffSchema(normalized([remoteComp]), normalized([localComp]));

    expect(result.diffs.find((d) => d.name === "page")?.action).toBe("unchanged");
  });

  it("should translate component_group_whitelist uuids to slug paths before comparing", () => {
    const remoteComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, restrict_components: true, component_group_whitelist: ["u1"] },
    });
    const localComp = makeComponent("page", {
      body: {
        type: "bloks",
        pos: 0,
        restrict_components: true,
        component_group_whitelist: ["layout"],
      },
    });

    const result = diffSchema(
      normalizedRemote([remoteComp], [{ uuid: "u1", name: "Layout" }]),
      normalized([localComp], [], [{ name: "Layout", path: "layout", parentPath: null }]),
    );

    expect(result.diffs.find((d) => d.name === "page")?.action).toBe("unchanged");
  });

  it("should translate component_group_denylist uuids to slug paths before comparing", () => {
    const remoteComp = makeComponent("page", {
      body: { type: "bloks", pos: 0, restrict_components: true, component_group_denylist: ["u1"] },
    });
    const localComp = makeComponent("page", {
      body: {
        type: "bloks",
        pos: 0,
        restrict_components: true,
        component_group_denylist: ["layout"],
      },
    });

    const result = diffSchema(
      normalizedRemote([remoteComp], [{ uuid: "u1", name: "Layout" }]),
      normalized([localComp], [], [{ name: "Layout", path: "layout", parentPath: null }]),
    );

    expect(result.diffs.find((d) => d.name === "page")?.action).toBe("unchanged");
  });

  it("should treat a target uuid whitelist as unchanged against the same remote uuid", () => {
    // `schema init` emits raw uuid whitelists locally; both sides translate uuid
    // to slug path so a pulled schema does not diff dirty forever.
    const whitelistField = {
      type: "bloks",
      pos: 0,
      restrict_components: true,
      component_group_whitelist: ["u1"],
    };

    const result = diffSchema(
      normalizedRemote(
        [makeComponent("page", { body: whitelistField })],
        [{ uuid: "u1", name: "Layout" }],
      ),
      normalized(
        [makeComponent("page", { body: whitelistField })],
        [],
        [{ name: "Layout", path: "layout", parentPath: null }],
      ),
    );

    expect(result.diffs.find((d) => d.name === "page")?.action).toBe("unchanged");
  });

  it("should treat two spaces with the same group layout as unchanged", () => {
    const spaceA = normalizedRemote(
      [
        {
          ...makeComponent("hero", {
            body: {
              type: "bloks",
              pos: 0,
              restrict_components: true,
              component_group_whitelist: ["a-uuid"],
            },
          }),
          component_group_uuid: "a-uuid",
        } as Component,
      ],
      [{ uuid: "a-uuid", name: "Layout" }],
    );
    const spaceB = normalizedRemote(
      [
        {
          ...makeComponent("hero", {
            body: {
              type: "bloks",
              pos: 0,
              restrict_components: true,
              component_group_whitelist: ["b-uuid"],
            },
          }),
          component_group_uuid: "b-uuid",
        } as Component,
      ],
      [{ uuid: "b-uuid", name: "Layout" }],
    );

    const result = diffSchema(spaceA, spaceB);

    expect(result.updates).toBe(0);
    expect(result.diffs.find((d) => d.name === "hero")?.action).toBe("unchanged");
  });

  it("should not mutate the source schemas across repeated diffs", () => {
    const remoteComp = {
      ...makeComponent("hero", {
        body: {
          type: "bloks",
          pos: 0,
          restrict_components: true,
          component_group_whitelist: ["u1"],
        },
      }),
      component_group_uuid: "u1",
    } as Component;
    const localComp = { ...makeComponent("hero", {}), folder: "layout" } as Component;
    const from = normalizedRemote([remoteComp], [{ uuid: "u1", name: "Layout" }]);
    const to = normalized([localComp], [], [{ name: "Layout", path: "layout", parentPath: null }]);

    const first = diffSchema(from, to);
    const snapshot = JSON.stringify(remoteComp);
    const second = diffSchema(from, to);

    expect(JSON.stringify(remoteComp)).toBe(snapshot);
    expect(second.diffs).toEqual(first.diffs);
  });

  it("should omit both sides from an unchanged folder", () => {
    const folders = [{ name: "Layout", path: "layout", parentPath: null }];

    const result = diffSchema(normalized([], [], folders), normalized([], [], folders));

    expect(result.diffs[0]).toMatchObject({
      type: "folder",
      action: "unchanged",
      before: null,
      after: null,
    });
  });

  it("should omit both sides from an unchanged entity", () => {
    const comp = makeComponent("page", { title: { type: "text", pos: 0 } });

    const result = diffSchema(normalized([{ ...comp, id: 99 } as Component]), normalized([comp]));

    expect(result.diffs[0]).toMatchObject({ action: "unchanged", before: null, after: null });
  });

  it("should strip API-assigned fields from the reported sides", () => {
    const comp = { ...makeComponent("page", {}), id: 42, created_at: "2024-01-01" } as Component;

    const result = diffSchema(normalized(), normalized([comp]));

    expect(result.diffs[0].after).not.toHaveProperty("id");
    expect(result.diffs[0].after).not.toHaveProperty("created_at");
  });

  it("should handle all entity types together", () => {
    const to = normalized(
      [makeComponent("page", {})],
      [makeDatasource("Colors", "colors")],
      [{ name: "Layout", path: "layout", parentPath: null }],
    );

    const result = diffSchema(normalized(), to);

    expect(result.creates).toBe(3);
    expect(result.diffs.map((d) => d.type)).toEqual(["folder", "component", "datasource"]);
  });
  it("should order entities by name so a base-only block sits with its neighbours", () => {
    // The base-only block must not be flushed to the end: a reader scanning for
    // "zebra" should find it where the alphabet puts it, whichever side holds it.
    const from = normalized([makeComponent("alpha", {}), makeComponent("zebra", {})]);
    const to = normalized([makeComponent("mid", {}), makeComponent("alpha", {})]);

    const names = diffSchema(from, to)
      .diffs.filter((d) => d.type === "component")
      .map((d) => d.name);

    expect(names).toEqual(["alpha", "mid", "zebra"]);
  });

  it("should order folders parent-first so a push can create them in diff order", () => {
    const folder = (path: string): LocalFolder => ({
      name: path.split("/").pop() ?? path,
      path,
      parentPath: path.includes("/") ? path.split("/").slice(0, -1).join("/") : null,
    });
    const to = normalized(
      [],
      [],
      [folder("marketing/campaigns/2026"), folder("marketing"), folder("marketing/campaigns")],
    );

    const names = diffSchema(normalized(), to)
      .diffs.filter((d) => d.type === "folder")
      .map((d) => d.name);

    expect(names).toEqual(["marketing", "marketing/campaigns", "marketing/campaigns/2026"]);
  });
  it("should flag a block whose group membership neither side can express", () => {
    const remote = normalizedRemote(
      [{ ...makeComponent("hero", {}), component_group_uuid: "group-uuid" } as Component],
      [{ id: 1, name: "Layout", uuid: "group-uuid", parent_uuid: null } as ComponentFolder],
    );
    // Code-loaded and declaring no `folder`, so it cannot express membership.
    const local = normalized([makeComponent("hero", {})]);

    expect(diffSchema(remote, local).unmanagedFolders).toEqual(["hero"]);
  });

  it("should not flag a block that no side places in a group", () => {
    const remote = normalizedRemote([makeComponent("hero", {})]);
    const local = normalized([makeComponent("hero", {})]);

    expect(diffSchema(remote, local).unmanagedFolders).toEqual([]);
  });

  it("should flag a local block whose declared folder the other side cannot express", () => {
    // Neither side is a space, so the only spelling of membership in play is the
    // `folder` key one file declares and the other omits.
    const from = normalized([{ ...makeComponent("hero", {}), folder: "layout" } as Component]);
    const to = normalized([makeComponent("hero", {})]);

    expect(diffSchema(from, to).unmanagedFolders).toEqual(["hero"]);
  });
});
