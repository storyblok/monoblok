import { describe, expect, it } from "vitest";
import { vol } from "memfs";

import { renderMigrationCode, toMigrationOps, writeMigrationFile } from "./generate";
import type { BreakingChange } from "./types";

type Block = Record<string, unknown>;

/** Turns generated migration code into the function `migrations run` calls for each block. */
function loadMigration(code: string): (block: Block) => Block {
  // oxlint-disable-next-line no-new-func
  return new Function(code.replace("export default function", "return function"))();
}

describe("renderMigrationCode", () => {
  it("should rename a field in place, so the block keeps its key order", () => {
    const migrate = loadMigration(
      renderMigrationCode([{ kind: "rename", field: "author", oldField: "author_name" }]),
    );

    const migrated = migrate({ _uid: "1", component: "quote", author_name: "Ada", text: "Hi" });

    expect(Object.entries(migrated)).toEqual([
      ["_uid", "1"],
      ["component", "quote"],
      ["author", "Ada"],
      ["text", "Hi"],
    ]);
  });

  it("should leave a block without the renamed field unchanged", () => {
    const migrate = loadMigration(
      renderMigrationCode([{ kind: "rename", field: "author", oldField: "author_name" }]),
    );

    const migrated = migrate({ _uid: "1", component: "quote", author: "Ada" });

    expect(migrated).toEqual({ _uid: "1", component: "quote", author: "Ada" });
  });

  it("should comment a mapping for each option value the field no longer offers", () => {
    const code = renderMigrationCode([
      { kind: "options_removed", field: "size", values: [" "], multiple: false },
      { kind: "options_removed", field: "tags", values: ["old"], multiple: true },
    ]);
    expect(code).toContain("// if (block.size === ' ') block.size = <value>;");
    expect(code).toContain(
      "// block.tags = block.tags?.map((value) => (value === 'old' ? <value> : value));",
    );
  });

  it("should map the exact removed option value once its commented mapping is uncommented", () => {
    const removed = "a\u2028b\u2029c */ 'd' \"e\" \\f\ng";
    const code = renderMigrationCode([
      { kind: "options_removed", field: "size", values: [removed], multiple: false },
    ]);
    const mapping = code
      .split("\n")
      .find((line) => line.trim().startsWith("// if (block.size ==="));
    const statement = mapping!.replace("//", "").replace("<value>", "'mapped'");

    const migrate = new Function("block", `${statement}\nreturn block;`);

    expect(migrate({ size: removed })).toEqual({ size: "mapped" });
    expect(migrate({ size: "other" })).toEqual({ size: "other" });
  });

  it("should not run code smuggled in through names or option values from the space", async () => {
    const payloads = [
      "x\u2028globalThis.PWNED=1;//",
      "x\u2029globalThis.PWNED=1;//",
      "x\nglobalThis.PWNED=1;//",
      "x\rglobalThis.PWNED=1;//",
      "x */ globalThis.PWNED=1; /*",
      "x'; globalThis.PWNED=1; '",
      'x"; globalThis.PWNED=1; "',
      "x\\'; globalThis.PWNED=1; //",
    ];
    const changes: BreakingChange[] = payloads.flatMap((payload): BreakingChange[] => [
      { kind: "rename", field: payload, oldField: payload },
      { kind: "removed", field: payload, renameHint: { newFields: [payload] } },
      { kind: "type_changed", field: payload, oldType: payload, newType: payload },
      { kind: "type_changed", field: payload, oldType: "text", newType: "number" },
      { kind: "required_added", field: payload, fieldType: payload },
      { kind: "required_changed", field: payload, fieldType: "text" },
      { kind: "options_removed", field: payload, values: payloads, multiple: true },
      { kind: "options_removed", field: payload, values: payloads, multiple: false },
    ]);
    const code = renderMigrationCode(changes);

    const migration = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code)}`
    );
    const block = Object.fromEntries(payloads.map((payload) => [payload, "value"]));
    migration.default(block);

    expect(globalThis).not.toHaveProperty("PWNED");
  });

  it("should generate removal code", () => {
    const changes: BreakingChange[] = [{ kind: "removed", field: "subtitle" }];
    const code = renderMigrationCode(changes);
    expect(code).toContain("delete block.subtitle");
  });

  it("should generate type conversion for text to number", () => {
    const changes: BreakingChange[] = [
      { kind: "type_changed", field: "rating", oldType: "text", newType: "number" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("Number(block.rating)");
  });

  it("should generate type conversion for text to boolean", () => {
    const changes: BreakingChange[] = [
      { kind: "type_changed", field: "active", oldType: "text", newType: "boolean" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("!!block.active");
  });

  it("should generate type conversion for number to text", () => {
    const changes: BreakingChange[] = [
      { kind: "type_changed", field: "count", oldType: "number", newType: "text" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("String(block.count)");
  });

  it("should generate TODO comment for unknown type conversions", () => {
    const changes: BreakingChange[] = [
      { kind: "type_changed", field: "content", oldType: "text", newType: "bloks" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("TODO");
    expect(code).toContain("text");
    expect(code).toContain("bloks");
  });

  it("should generate required_added with string default for text field", () => {
    const changes: BreakingChange[] = [
      { kind: "required_added", field: "cta_label", fieldType: "text" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("TODO");
    expect(code).toContain("default value");
    expect(code).toContain("block.cta_label = block.cta_label ?? ''");
  });

  it("should generate required_added with numeric default for number field", () => {
    const changes: BreakingChange[] = [
      { kind: "required_added", field: "count", fieldType: "number" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("block.count = block.count ?? 0");
  });

  it("should generate required_added with commented-out placeholder for complex types", () => {
    const changes: BreakingChange[] = [
      { kind: "required_added", field: "image", fieldType: "asset" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("TODO: provide a default value appropriate for the 'asset' type");
    expect(code).toContain("// block.image = block.image ?? <default>");
    expect(code).not.toMatch(/^\s+block\.image\s*=/m);
  });

  it("should generate rename hint comment for declined renames", () => {
    const changes: BreakingChange[] = [
      { kind: "removed", field: "author_name", renameHint: { newFields: ["author"] } },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("// If 'author_name' was renamed to 'author', uncomment:");
    expect(loadMigration(code)({ _uid: "1", component: "quote", author_name: "Ada" })).toEqual({
      _uid: "1",
      component: "quote",
    });
  });

  it("should rename a declined rename in place once its hint is uncommented", () => {
    const code = renderMigrationCode([
      { kind: "removed", field: "author_name", renameHint: { newFields: ["author"] } },
    ]);
    const migrate = loadMigration(code.replace(/^ {2}\/\/ (block = .*'author_name'.*)$/m, "  $1"));

    const migrated = migrate({ _uid: "1", component: "quote", author_name: "Ada", text: "Hi" });

    expect(Object.keys(migrated)).toEqual(["_uid", "component", "author", "text"]);
  });

  it("should combine multiple changes in one file", () => {
    const changes: BreakingChange[] = [
      { kind: "rename", field: "author", oldField: "author_name" },
      { kind: "type_changed", field: "rating", oldType: "text", newType: "number" },
      { kind: "removed", field: "subtitle" },
    ];
    const code = renderMigrationCode(changes);
    const migrated = loadMigration(code)({
      _uid: "1",
      component: "review",
      author_name: "Ada",
      rating: "4",
      subtitle: "Old",
    });
    expect(migrated).toEqual({ _uid: "1", component: "review", author: "Ada", rating: 4 });
    expect(code).toContain("Number(block.rating)");
    expect(code).toContain("delete block.subtitle");
  });

  it("should generate string default for text field becoming required", () => {
    const changes: BreakingChange[] = [
      { kind: "required_changed", field: "title", fieldType: "text" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("block.title = block.title ?? ''");
    expect(code).toContain("TODO");
  });

  it("should generate numeric default for number field becoming required", () => {
    const changes: BreakingChange[] = [
      { kind: "required_changed", field: "count", fieldType: "number" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("block.count = block.count ?? 0");
  });

  it("should generate boolean default for boolean field becoming required", () => {
    const changes: BreakingChange[] = [
      { kind: "required_changed", field: "active", fieldType: "boolean" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("block.active = block.active ?? false");
  });

  it("should generate commented-out placeholder for complex field types becoming required", () => {
    const changes: BreakingChange[] = [
      { kind: "required_changed", field: "image", fieldType: "asset" },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain("TODO: provide a default value appropriate for the 'asset' type");
    expect(code).toContain("// block.image = block.image ?? <default>");
    // Must NOT contain an uncommented assignment
    expect(code).not.toMatch(/^\s+block\.image\s*=/m);
  });
});

describe("writeMigrationFile", () => {
  it("should write migration file with timestamp suffix", async () => {
    const code = "export default function (block) {\n  return block;\n}\n";
    const timestamp = "2026-04-10T12:00:00.000Z";

    const path = await writeMigrationFile({
      spaceId: "12345",
      componentName: "hero",
      code,
      timestamp,
    });

    expect(path).toContain("migrations/12345/hero.20260410120000.js");
    const files = vol.toJSON();
    expect(Object.keys(files).some((f) => f.includes("hero.20260410120000.js"))).toBe(true);
  });

  it("should use custom base path when provided", async () => {
    const code = "export default function (block) {\n  return block;\n}\n";
    const timestamp = "2026-04-10T12:00:00.000Z";

    const path = await writeMigrationFile({
      spaceId: "12345",
      componentName: "hero",
      code,
      timestamp,
      basePath: "custom/path",
    });

    expect(path).toContain("custom/path/migrations/12345/hero.20260410120000.js");
  });
});

describe("toMigrationOps", () => {
  it("should leave boolean and number conversions to the author", () => {
    expect(
      toMigrationOps("hero", [
        { kind: "type_changed", field: "featured", oldType: "boolean", newType: "number" },
        { kind: "type_changed", field: "rank", oldType: "number", newType: "boolean" },
      ]),
    ).toEqual([
      expect.objectContaining({ kind: "alterField", field: "featured" }),
      expect.objectContaining({ kind: "alterField", field: "rank" }),
    ]);
  });

  it("should coerce between scalar types and leave other conversions to the author", () => {
    expect(
      toMigrationOps("hero", [
        { kind: "type_changed", field: "rating", oldType: "text", newType: "number" },
        { kind: "type_changed", field: "body", oldType: "richtext", newType: "markdown" },
      ]),
    ).toEqual([
      { kind: "coerceField", block: "hero", field: "rating", from: "string", to: "number" },
      {
        kind: "alterField",
        block: "hero",
        field: "body",
        todo: [
          "TODO: convert 'body' from richtext to markdown. A rerun passes already-converted values.",
        ],
      },
    ]);
  });

  it("should backfill new required fields and fill existing ones that became required", () => {
    expect(
      toMigrationOps("hero", [
        { kind: "required_added", field: "featured", fieldType: "boolean" },
        { kind: "required_changed", field: "image", fieldType: "asset" },
      ]),
    ).toEqual([
      expect.objectContaining({ kind: "addField", field: "featured", value: false }),
      expect.objectContaining({
        kind: "fillField",
        field: "image",
        value: undefined,
        fillEmptyString: false,
        todo: ["TODO: provide a default for the required asset field 'image'."],
      }),
    ]);
  });

  it("should leave the default of a required text or number field to the author", () => {
    expect(
      toMigrationOps("hero", [
        { kind: "required_added", field: "cta", fieldType: "text" },
        { kind: "required_changed", field: "count", fieldType: "number" },
      ]),
    ).toEqual([
      expect.objectContaining({ kind: "addField", field: "cta", value: undefined }),
      expect.objectContaining({
        kind: "fillField",
        field: "count",
        value: undefined,
        fillEmptyString: true,
      }),
    ]);
  });

  it("should point a removal with a rename hint at renameField", () => {
    expect(
      toMigrationOps("hero", [
        { kind: "removed", field: "author_name", renameHint: { newFields: ["author", "byline"] } },
      ]),
    ).toEqual([
      {
        kind: "removeField",
        block: "hero",
        field: "author_name",
        todo: [
          "TODO: if 'author_name' was renamed to 'author' or 'byline', replace this removeField with renameField, or the content of 'author_name' is lost.",
        ],
      },
    ]);
  });
});
