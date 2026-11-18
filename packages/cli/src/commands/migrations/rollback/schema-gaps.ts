import { isRecord, toError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { fetchComponents } from "../../components";

/** Keys every block holds that no component schema declares. */
const BLOCK_KEYS = new Set(["_uid", "component", "_editable"]);
const TRANSLATION_SEPARATOR = "__i18n__";

/** The fields each block in a content tree holds, by block name. */
function fieldsByBlock(
  content: unknown,
  into = new Map<string, Set<string>>(),
): Map<string, Set<string>> {
  if (Array.isArray(content)) {
    for (const item of content) fieldsByBlock(item, into);
  } else if (isRecord(content)) {
    if (typeof content.component === "string") {
      const fields = into.get(content.component) ?? new Set<string>();
      for (const key of Object.keys(content)) {
        if (!BLOCK_KEYS.has(key)) fields.add(key.split(TRANSLATION_SEPARATOR)[0]);
      }
      into.set(content.component, fields);
    }
    for (const value of Object.values(content)) fieldsByBlock(value, into);
  }
  return into;
}

/** A block the schema lacks, or, with `field`, a field its block's schema lacks. */
export type SchemaGap = { block: string; field?: string; stories: string[] };

export type RestoredStory = { slug: string; current: unknown; restored: unknown };

export type ComponentSchema = { name: string; schema?: Record<string, unknown> };

/**
 * The blocks and fields that restored content brings back but the space's
 * schema doesn't define, such as a block a later schema push renamed. What a
 * story already holds is left out, since restoring it doesn't add it.
 */
export function findSchemaGaps(
  stories: readonly RestoredStory[],
  components: readonly ComponentSchema[],
): SchemaGap[] {
  const schema = new Map(
    components.map((component) => [component.name, new Set(Object.keys(component.schema ?? {}))]),
  );
  const gaps = new Map<string, SchemaGap>();
  const addGap = (slug: string, block: string, field?: string) => {
    const key = JSON.stringify([block, field]);
    const gap = gaps.get(key) ?? { block, ...(field === undefined ? {} : { field }), stories: [] };
    if (!gap.stories.includes(slug)) gap.stories.push(slug);
    gaps.set(key, gap);
  };

  for (const story of stories) {
    const current = fieldsByBlock(story.current);
    for (const [block, fields] of fieldsByBlock(story.restored)) {
      const defined = schema.get(block);
      const held = current.get(block);
      if (!defined) {
        if (!held) addGap(story.slug, block);
        continue;
      }
      for (const field of fields) {
        if (!defined.has(field) && !held?.has(field)) addGap(story.slug, block, field);
      }
    }
  }
  return [...gaps.values()];
}

const MAX_STORIES_SHOWN = 5;

function storyList(slugs: readonly string[]): string {
  const shown = slugs.slice(0, MAX_STORIES_SHOWN).join(", ");
  const more = slugs.length - MAX_STORIES_SHOWN;
  return more > 0 ? `${shown}, and ${more} more` : shown;
}

/**
 * Warns before a rollback writes content that uses blocks or fields the space's
 * schema no longer defines. The space accepts such content, so the rollback
 * goes ahead, but nothing else would point to the schema the content needs.
 */
export async function warnAboutSchemaGaps(
  space: string,
  stories: readonly RestoredStory[],
): Promise<void> {
  if (stories.length === 0) {
    return;
  }
  let components: ComponentSchema[];
  try {
    components = (await fetchComponents(space)) ?? [];
  } catch (maybeError) {
    const error = toError(maybeError);
    getUI().warn(
      `Could not check the restored content against the space's schema: ${error.message}`,
    );
    getLogger().warn("Failed to check restored content against the schema", { space, error });
    return;
  }
  const gaps = findSchemaGaps(stories, components);
  if (gaps.length === 0) {
    return;
  }
  const lines = gaps.map(
    (gap) =>
      `  - ${gap.field === undefined ? `block "${gap.block}"` : `field "${gap.field}" of block "${gap.block}"`}: ${storyList(gap.stories)}`,
  );
  getUI().warn(
    `The rollback restores content that uses blocks or fields the space's schema doesn't define:\n${lines.join("\n")}\nRoll back the schema to its version from before the run with "storyblok schema rollback", or push that version, so the space defines them again.`,
  );
}
