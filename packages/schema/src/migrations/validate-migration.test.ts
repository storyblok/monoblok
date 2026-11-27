import { describe, expect, it } from "vitest";
import { defineBlock } from "../helpers/define-block";
import { defineField } from "../helpers/define-field";
import { defineMigration } from "./define-migration";
import { renameField, unwrapChildren } from "./ops";
import { validateMigration } from "./validate-migration";

const blocks = [
  defineBlock({
    name: "changelog_entry_v2",
    fields: [defineField("title", { type: "text" })],
  }),
  ...Array.from({ length: 50 }, (_, index) => defineBlock({ name: `block_${index}`, fields: [] })),
];
const schema = { blocks };

describe("validateMigration with an unknown block", () => {
  it("should suggest the closest block name instead of listing every block", () => {
    const migration = defineMigration([
      renameField({ block: "changelog_entry_v3", field: "title", to: "headline" }),
    ]);

    const [issue] = validateMigration(migration, schema);

    expect(issue.message).toBe(
      'Unknown block "changelog_entry_v3". Did you mean "changelog_entry_v2"?',
    );
  });

  it("should name only the unknown block when no block name is close", () => {
    const migration = defineMigration([
      renameField({ block: "hero", field: "title", to: "headline" }),
    ]);

    const [issue] = validateMigration(migration, schema);

    expect(issue.message).toBe('Unknown block "hero".');
  });

  it("should suggest the closest block name for a block to unwrap", () => {
    const migration = defineMigration([
      unwrapChildren({
        block: "changelog_entry_v2",
        field: "title",
        from: { block: "changelog_entry", field: "items" },
      }),
    ]);

    const issues = validateMigration(migration, schema);

    expect(issues.map((issue) => issue.message)).toContain(
      'Unknown block "changelog_entry" to unwrap. Did you mean "changelog_entry_v2"?',
    );
  });
});
