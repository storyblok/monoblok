/**
 * A URL in a text field becomes an asset object, translations included. Same
 * two-op shape as `0011`: the value is reshaped first, then the key moves to
 * the name the new field type deserves.
 *
 * What is new here is where the values come from. An asset object carries more
 * than the URL — the asset's id, alt text, title, and whether it is private —
 * and none of that is in the string being rewritten. It has to come from the
 * space's asset list, which is exactly what an op callback cannot reach: the
 * callbacks are synchronous and are handed a value, not a client, so a lookup
 * has to be resolved before any op runs. Here that is the table below. A real
 * run would fill it from the Management API at module scope, which means
 * importing the migration performs the request — `migrations list` included.
 *
 * The legacy key does not survive: a rename moves the family to the new name
 * rather than copying it, so nothing is left behind on a field the schema no
 * longer declares. A mapper that spreads the block and adds a key keeps both.
 *
 * The base key and its `__i18n__` siblings are told apart on purpose: a
 * translation with no value is dropped rather than replaced by an empty asset,
 * because a language that never had its own social image should fall back to
 * the default one rather than shadow it with a blank.
 */
import { alterField, defineMigration, renameField } from "@storyblok/schema/migrations";
import type { AlterFieldContext } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { PageWithOgImageUrl } from "../src/schema/snapshots/page-with-og-image-url";

interface LibraryAsset {
  id: number;
  alt: string;
  title: string;
  is_private: boolean;
}

/** The space an asset URL has to belong to for its metadata to be in reach. */
const SPACE = "290020686946333";

/**
 * Keyed by the hash segment of the CDN URL, which is what an asset list is
 * searched by: `https://a.storyblok.com/f/<space>/<dimensions>/<hash>/<name>`.
 */
const ASSET_LIBRARY: Record<string, LibraryAsset> = {
  "3f1b9c0d21": {
    id: 223407129003101,
    alt: "Storyblok social card",
    title: "Social card",
    is_private: false,
  },
  "7ad4e51b88": {
    id: 223407129003102,
    alt: "Storyblok social card, German",
    title: "Social card (de)",
    is_private: false,
  },
};

function lookUp(url: string): LibraryAsset | undefined {
  const chunks = url.split("/");
  const hash = chunks.at(-2);
  const space = chunks.at(-4);
  return space === SPACE && hash ? ASSET_LIBRARY[hash] : undefined;
}

/**
 * Tolerates its own output: every `alter` op is applied a second time to the
 * value it produced, so anything that is no longer a URL string is handed back
 * untouched.
 */
function toAsset(value: unknown, context: AlterFieldContext): unknown {
  if (typeof value !== "string") {
    return value;
  }
  // An empty base value still becomes an asset, so the field holds the shape
  // its type promises; an empty translation is dropped instead, so the
  // language falls back to the default image rather than shadowing it.
  if (value === "") {
    return context.language ? undefined : asset("", undefined, false);
  }

  // A URL an editor pasted out of the asset browser has no protocol.
  const url = value.startsWith("//") ? `https:${value}` : value;
  let isExternalUrl = false;
  try {
    isExternalUrl = new URL(url).hostname !== "a.storyblok.com";
  } catch {
    // Not a URL at all. Left where it is, on a field that now says it holds an
    // asset — visible in the editor, which is better than dropped silently.
  }

  return asset(url, lookUp(url), isExternalUrl);
}

function asset(
  filename: string,
  found: LibraryAsset | undefined,
  isExternalUrl: boolean,
): Record<string, unknown> {
  return {
    id: found?.id,
    alt: found?.alt,
    name: "",
    focus: "",
    title: found?.title,
    source: "",
    filename,
    copyright: "",
    fieldtype: "asset",
    meta_data: {},
    is_private: found?.is_private,
    is_external_url: isExternalUrl,
  };
}

export default defineMigration<Schema, PageWithOgImageUrl>({
  title: "Turn page.og_image into the asset field page.og_image_asset",
  ops: [
    alterField({ block: "page", field: "og_image" }, toAsset),
    renameField({ block: "page", field: "og_image", to: "og_image_asset" }),
  ],
});
