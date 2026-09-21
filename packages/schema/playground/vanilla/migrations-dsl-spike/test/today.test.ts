/**
 * SPIKE — today's behaviour, for comparison. Exercises the CLI's own
 * `applyMigrationToAllBlocks` against the same fixtures the DSL runs on, with
 * migrations written the way `storyblok migrations generate` scaffolds them.
 */
import { describe, expect, it } from "vitest";
import { applyMigrationToAllBlocks } from "../../../../../cli/src/commands/migrations/run/actions";
import { indexBlocks } from "../src/patch";
import { articleStoryContent, pageStoryContent } from "../fixtures/stories";

const block = (content: unknown, uid: string) => {
  const found = indexBlocks(content).get(uid);
  if (!found) throw new Error(`no block ${uid}`);
  return found;
};

/** What a hand-written `spike_meta.js` migration looks like today. */
const renameMetaAuthor = (b: Record<string, unknown>) => {
  b.written_by = b.author;
  delete b.author;
  return b;
};

describe("today's runner", () => {
  it("should reach a nested block under several parents", () => {
    const content = pageStoryContent();
    const processed = applyMigrationToAllBlocks(
      content as never,
      renameMetaAuthor as never,
      "spike_meta",
    );
    expect(processed).toBe(true);
    for (const uid of ["meta-top", "meta-a", "meta-a1", "meta-b1"]) {
      expect(block(content, uid)).toHaveProperty("written_by");
    }
  });

  it("should NOT reach a block embedded in a richtext field", () => {
    const content = articleStoryContent();
    applyMigrationToAllBlocks(content as never, renameMetaAuthor as never, "spike_meta");
    expect(block(content, "meta-in-richtext")).toHaveProperty("author");
    expect(block(content, "meta-in-richtext")).not.toHaveProperty("written_by");
  });

  it("should move a renamed field to the end of the object", () => {
    const content = articleStoryContent();
    applyMigrationToAllBlocks(
      content as never,
      ((b: Record<string, unknown>) => {
        b.byline = b.author;
        delete b.author;
        return b;
      }) as never,
      "spike_article",
    );
    expect(Object.keys(block(content, "article-root"))).toEqual([
      "_uid",
      "component",
      "title",
      "excerpt",
      "body",
      "byline",
    ]);
  });

  it("should report processed=false when nothing matches", () => {
    const content = pageStoryContent();
    const processed = applyMigrationToAllBlocks(
      content as never,
      ((b: unknown) => b) as never,
      "spike_banner",
    );
    expect(processed).toBe(false);
  });

  it("should need one migration file per component, keyed by filename", () => {
    // A migration touching two components cannot be expressed in one file:
    // the target component is derived from the file name, and the runner passes
    // only blocks of that component to the function.
    const content = articleStoryContent();
    const touched: string[] = [];
    applyMigrationToAllBlocks(
      content as never,
      ((b: Record<string, unknown>) => {
        touched.push(b.component as string);
        return b;
      }) as never,
      "spike_article",
    );
    expect(touched).toEqual(["spike_article"]);
  });
});
