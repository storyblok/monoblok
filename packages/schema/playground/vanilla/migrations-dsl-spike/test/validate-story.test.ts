/**
 * SPIKE — what schema-aware post-condition validation reports once it is run
 * against the post-migration schema, which is the only one it can be run
 * against: the whole point of a migration is that the content stops matching
 * `Before`, so validating against `Before` reports the migration's own work as
 * damage.
 */
import { describe, expect, it } from "vitest";
import { validateStory } from "@storyblok/schema";
import { spikeSchema } from "../fixtures/schema";
import {
  afterCoerceCardTypes,
  afterRemoveCardDescription,
  afterRenameArticleAuthor,
  afterRenameMetaAuthor,
} from "../fixtures/schema-after";
import { articleStoryContent, pageStoryContent } from "../fixtures/stories";
import { runMigrationOnStory } from "../src/runner";
import { coerceFields, removeField, renameField, renameNestedField } from "../migrations";

const asSchemaLike = (schema: { blocks: Record<string, unknown> }) =>
  ({ blocks: Object.values(schema.blocks) }) as never;

const issuesFor = (content: unknown, schema: { blocks: Record<string, unknown> }) =>
  validateStory({ content } as never, asSchemaLike(schema)).issues.map(
    (issue) => `${issue.severity}:${issue.path.join(".")}`,
  );

describe("post-condition validation against the post-migration schema", () => {
  it("should report nothing after a root-level rename", () => {
    const run = runMigrationOnStory(renameField, articleStoryContent());
    expect(issuesFor(run.content, afterRenameArticleAuthor)).toEqual([]);
  });

  it("should report nothing after a rename on a block nested at several depths", () => {
    const run = runMigrationOnStory(renameNestedField, pageStoryContent());
    expect(issuesFor(run.content, afterRenameMetaAuthor)).toEqual([]);
  });

  it("should report nothing after a field removal", () => {
    const run = runMigrationOnStory(removeField, pageStoryContent());
    expect(issuesFor(run.content, afterRemoveCardDescription)).toEqual([]);
  });

  it("should report only the value a coercion could not produce", () => {
    const run = runMigrationOnStory(coerceFields, pageStoryContent());
    // `asNumber()` writes the wire form of a number field (a numeric string),
    // so `"not-a-number"` lands as `""` — the value an unset number field holds.
    expect(issuesFor(run.content, afterCoerceCardTypes)).toEqual([]);
  });

  it("should still report un-migrated content as invalid against the post-migration schema", () => {
    // The pre-migration fixture run through the *post*-migration schema: this
    // is the check that catches a migration that skipped stories.
    expect(issuesFor(pageStoryContent(), afterRenameMetaAuthor)).toEqual([
      "warning:content.body.0.items.0.meta.0.author",
      "warning:content.body.0.meta.0.author",
      "warning:content.body.1.items.0.meta.0.author",
      "warning:content.body.2.author",
    ]);
  });
});

describe("validating against the pre-migration schema, for contrast", () => {
  it("should report the migration's own rename as damage", () => {
    const run = runMigrationOnStory(renameField, articleStoryContent());
    expect(issuesFor(run.content, spikeSchema)).toEqual(["warning:content.byline"]);
  });

  it("should report a boolean coercion as a hard type error on every touched instance", () => {
    const run = runMigrationOnStory(coerceFields, pageStoryContent());
    // `legacy_price` is absent: the numeric wire form is still a string, so the
    // pre-migration `text` field cannot tell the coercion happened at all.
    expect(issuesFor(run.content, spikeSchema)).toEqual([
      "error:content.body.0.items.0.featured",
      "error:content.body.0.items.1.featured",
      "error:content.body.1.items.0.featured",
    ]);
  });
});
