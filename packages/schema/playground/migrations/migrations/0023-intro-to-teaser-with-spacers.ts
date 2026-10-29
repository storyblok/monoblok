/**
 * One block becomes three: a legacy `intro` is replaced by a `teaser` with a
 * `spacer` above and below it, because the component that replaces it brings no
 * spacing of its own.
 *
 * `expandBlock` is the one op whose result is not a change to the block it
 * names but a change to the list that holds it, so it runs in its own pass over
 * the story after every other op. Two things follow, and both are load-bearing
 * here:
 *
 * The blocks the callback returns are content this migration authored, so no op
 * is applied to them — this one included. A callback that returned an `intro`
 * would expand again on the next run, which the runner reports rather than
 * leaving for whoever reruns the migration.
 *
 * The uids are derived from the block being replaced. That is what makes a
 * rerun produce the same three blocks instead of a second pair of spacers, and
 * it is what lets the run record the insertion as a `listInsert` keyed by uid,
 * so undoing it removes exactly these blocks even after an editor reordered the
 * page around them.
 *
 * The translation family is the one thing the op cannot carry. Every op that
 * names a field moves the field's `__i18n__` siblings with it; a callback handed
 * a whole block is writing the keys itself, so a translated `headline` left
 * behind on a block whose field is now `title` is silent data loss.
 */
import { defineMigration, expandBlock, TRANSLATION_SEPARATOR } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { PageWithIntro } from "../src/schema/snapshots/page-with-intro";

const FIELDS: Record<string, string> = { headline: "title", body: "description" };

/** `headline__i18n__de` follows `headline` to `title__i18n__de`. */
function renamedKey(key: string): string {
  for (const [from, to] of Object.entries(FIELDS)) {
    if (key === from) return to;
    if (key.startsWith(`${from}${TRANSLATION_SEPARATOR}`)) return `${to}${key.slice(from.length)}`;
  }
  return key;
}

function toTeaser(intro: Record<string, unknown>): Record<string, unknown> {
  const teaser: Record<string, unknown> = { _uid: intro._uid, component: "teaser" };
  for (const [key, value] of Object.entries(intro)) {
    if (key === "_uid" || key === "component") continue;
    teaser[renamedKey(key)] = value;
  }
  return teaser;
}

/** Derived from the block it surrounds: a rerun mints the same uid, not a new one. */
function spacer(uid: unknown, side: "before" | "after"): Record<string, unknown> {
  return { _uid: `${uid}-spacer-${side}`, component: "spacer", height: "medium" };
}

export default defineMigration<Schema, PageWithIntro>({
  title: "Replace the legacy intro with a teaser between two spacers",
  ops: [
    expandBlock({ block: "intro" }, (intro) => [
      spacer(intro._uid, "before"),
      toTeaser(intro),
      spacer(intro._uid, "after"),
    ]),
  ],
});
