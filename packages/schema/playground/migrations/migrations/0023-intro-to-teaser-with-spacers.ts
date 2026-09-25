/**
 * One block becomes three: a legacy `intro` is replaced by a `teaser` with a
 * `spacer` above and below it, because the component it is replaced by brings
 * no spacing of its own.
 *
 * This is the one shape the op set cannot address by component. Every other op
 * names the block it changes and the runner finds it wherever it sits; an op
 * that writes siblings needs the array the block sits in, and the runner hands
 * an op the block, not its parent. So the op names the parent instead —
 * `page.body` — and the component being replaced appears only inside the
 * callback, where nothing checks it.
 *
 * Two consequences worth reading before copying this:
 *
 * Every field that can hold the component has to be named. `intro` under a
 * section's `items` would be missed by this migration in silence, because
 * nothing here says `intro` to the runner.
 *
 * The translation family is carried by hand. Every op that names a field moves
 * its `__i18n__` siblings with it; a callback handed raw blocks gets no such
 * help, and a translated `headline` left behind on a block whose field is now
 * `title` is silent data loss.
 *
 * What the engine does still do: the uids below are derived from the block
 * being replaced, so a rerun produces the same three blocks rather than a
 * second pair of spacers, the run records the insertion as a `listInsert`
 * keyed by uid, and undoing it removes exactly those blocks even if an editor
 * reordered the page since.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";
import { TRANSLATION_SEPARATOR } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

const LEGACY_BLOCK = "intro";

interface LegacyIntro {
  _uid: string;
  component: string;
  [key: string]: unknown;
}

function isLegacyIntro(value: unknown): value is LegacyIntro {
  return (
    typeof value === "object" &&
    value !== null &&
    "component" in value &&
    value.component === LEGACY_BLOCK
  );
}

/** `headline__i18n__de` follows `headline` to `title__i18n__de`. */
function renamed(key: string, from: string, to: string): string | undefined {
  if (key === from) return to;
  return key.startsWith(`${from}${TRANSLATION_SEPARATOR}`)
    ? `${to}${key.slice(from.length)}`
    : undefined;
}

const FIELDS: Record<string, string> = { headline: "title", body: "description" };

function toTeaser(intro: LegacyIntro): Record<string, unknown> {
  const teaser: Record<string, unknown> = { _uid: intro._uid, component: "teaser" };
  for (const [key, value] of Object.entries(intro)) {
    if (key === "_uid" || key === "component") continue;
    const target = Object.entries(FIELDS).reduce<string | undefined>(
      (found, [from, to]) => found ?? renamed(key, from, to),
      undefined,
    );
    teaser[target ?? key] = value;
  }
  return teaser;
}

/** Derived from the block it surrounds: a rerun mints the same uid, not a new one. */
function spacer(uid: string, side: "before" | "after"): Record<string, unknown> {
  return { _uid: `${uid}-spacer-${side}`, component: "spacer", height: "medium" };
}

export default defineMigration<Schema>({
  title: "Replace the legacy intro with a teaser between two spacers",
  ops: [
    alterField({ block: "page", field: "body" }, (body) => {
      if (!Array.isArray(body)) {
        return body;
      }
      const replaced: unknown[] = [];
      for (const child of body) {
        if (!isLegacyIntro(child)) {
          replaced.push(child);
          continue;
        }
        replaced.push(spacer(child._uid, "before"), toTeaser(child), spacer(child._uid, "after"));
      }
      return replaced;
    }),
  ],
});
