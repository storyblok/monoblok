import {
  alterField,
  defineMigration,
  removeField,
  renameField,
} from "@storyblok/schema/migrations";
import { describe, expect, it } from "vitest";
import type { PlaygroundStory } from "./content-store";
import { planMigration } from "./plan-migration";

const card = (uid: string, headline: string) => ({ _uid: uid, component: "card", headline });

function story(slug: string, body: unknown[]): PlaygroundStory {
  return {
    id: 1,
    slug,
    name: slug,
    content: { _uid: `${slug}-root`, component: "page", body },
  };
}

const renameHeadline = defineMigration([
  renameField({ block: "card", field: "headline", to: "title" }),
]);

/** Deleting a block's own id is what a migration must never be allowed to write. */
const dropCardUid = defineMigration([removeField({ block: "card", field: "_uid" })]);

const appendToHeadline = defineMigration([
  alterField({ block: "card", field: "headline" }, (value) => `${String(value)}!`),
]);

describe("planMigration", () => {
  it("should plan the write and the inverse for a story the migration changes", () => {
    const changed = story("home", [card("a", "Hello")]);

    const plan = planMigration(renameHeadline, [changed]);

    expect(plan.refusals).toEqual([]);
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]?.content).toMatchObject({
      body: [{ _uid: "a", component: "card", title: "Hello" }],
    });
    expect(plan.inverse).toEqual([{ story: "1", patches: expect.any(Array) }]);
    expect(plan.inverse[0]?.patches.length).toBeGreaterThan(0);
  });

  it("should leave a story the migration does not change out of the plan", () => {
    const untouched = story("about", [{ _uid: "q", component: "quote", text: "Nothing here" }]);

    const plan = planMigration(renameHeadline, [untouched]);

    expect(plan).toEqual({ writes: [], inverse: [], refusals: [] });
  });

  it("should refuse a story that already repeated a block id, and blame the story", () => {
    const repeated = story("home", [card("same", "One"), card("same", "Two")]);

    const plan = planMigration(renameHeadline, [repeated]);

    expect(plan.writes).toEqual([]);
    expect(plan.refusals).toEqual([
      { slug: "home", blame: "story", reason: expect.stringContaining("same") },
    ]);
  });

  it("should refuse a story the migration left without a block id, and blame the migration", () => {
    const fine = story("home", [card("a", "Hello")]);

    const plan = planMigration(dropCardUid, [fine]);

    expect(plan.writes).toEqual([]);
    expect(plan.refusals).toEqual([
      { slug: "home", blame: "migration", reason: expect.stringContaining("without an id") },
    ]);
  });

  it("should blame the story when content that already repeated an id also picks up a new instability", () => {
    // The repeated ids are on blocks the migration never touches, so they
    // survive into the migrated content and sit beside the id it removed.
    const repeated = story("home", [
      { _uid: "same", component: "quote", text: "One" },
      { _uid: "same", component: "quote", text: "Two" },
      card("a", "Hello"),
    ]);

    const plan = planMigration(dropCardUid, [repeated]);

    expect(plan.refusals).toEqual([
      { slug: "home", blame: "story", reason: expect.stringContaining("same") },
    ]);
  });

  it("should refuse a story whose op disagrees with itself on a second pass", () => {
    const changed = story("home", [card("a", "Hello")]);

    const plan = planMigration(appendToHeadline, [changed]);

    expect(plan.writes).toEqual([]);
    expect(plan.refusals).toEqual([
      { slug: "home", blame: "migration", reason: expect.stringContaining("second pass") },
    ]);
  });
});
