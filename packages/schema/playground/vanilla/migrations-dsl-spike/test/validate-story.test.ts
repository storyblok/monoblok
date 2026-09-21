/**
 * SPIKE — what schema-aware post-condition validation actually reports on real
 * content, before and after each migration.
 */
import { describe, expect, it } from "vitest";
import { validateStory } from "@storyblok/schema";
import { spikeSchema } from "../fixtures/schema";
import { articleStoryContent, pageStoryContent } from "../fixtures/stories";
import { runMigrationOnStory } from "../src/runner";
import { coerceFields, removeField, renameField, renameNestedField } from "../migrations";

const schemaLike = { blocks: Object.values(spikeSchema.blocks) } as never;

const issuesFor = (content: unknown) =>
  validateStory({ content } as never, schemaLike).issues.map(
    (issue) => `${issue.severity}:${issue.path.join(".")}`,
  );

describe("post-condition validation against the pre-migration schema", () => {
  it("should report nothing on the untouched fixtures", () => {
    expect(issuesFor(pageStoryContent())).toEqual([]);
    expect(issuesFor(articleStoryContent())).toEqual([]);
  });

  it("should report a renamed field as an unknown-field warning, once per instance", () => {
    const run = runMigrationOnStory(renameNestedField, pageStoryContent());
    expect(issuesFor(run.content)).toEqual([
      "warning:content.body.0.items.0.meta.0.written_by",
      "warning:content.body.0.meta.0.written_by",
      "warning:content.body.1.items.0.meta.0.written_by",
      "warning:content.body.2.written_by",
    ]);
  });

  it("should report a coercion as a hard type error on every touched instance", () => {
    const run = runMigrationOnStory(coerceFields, pageStoryContent());
    expect(issuesFor(run.content)).toEqual([
      "error:content.body.0.items.0.legacy_price",
      "error:content.body.0.items.0.featured",
      "error:content.body.0.items.1.featured",
      "error:content.body.1.items.0.legacy_price",
      "error:content.body.1.items.0.featured",
    ]);
  });

  it("should report nothing when a migration removes an optional field", () => {
    const run = runMigrationOnStory(removeField, pageStoryContent());
    expect(issuesFor(run.content)).toEqual([]);
  });

  it("should report a warning for the renamed root field", () => {
    const run = runMigrationOnStory(renameField, articleStoryContent());
    expect(issuesFor(run.content)).toEqual(["warning:content.byline"]);
  });
});
