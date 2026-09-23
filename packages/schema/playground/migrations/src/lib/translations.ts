import { TRANSLATION_SEPARATOR } from "@storyblok/schema/migrations";

/** A field-level translation, read off the `<field>__i18n__<locale>` sibling key. */
export type Translation = {
  field: string;
  locale: string;
  preview: string;
  isEmpty: boolean;
};

/**
 * Flattens a value to the text a reader would see, so a richtext translation is
 * as legible on the page as a plain text one.
 */
function previewOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(previewOf).filter(Boolean).join(" ");
  }
  if (typeof value === "object" && value !== null) {
    if ("text" in value) {
      return previewOf(value.text);
    }
    if ("content" in value) {
      return previewOf(value.content);
    }
  }
  return "";
}

/**
 * Collects a block's translated siblings. Reading the keys off the block rather
 * than off the schema means a translation a migration left behind on a field
 * that no longer exists still shows up on the page.
 */
export function translationsOf(block: unknown): Translation[] {
  if (typeof block !== "object" || block === null) {
    return [];
  }

  const translations: Translation[] = [];
  for (const [key, value] of Object.entries(block)) {
    const separatorAt = key.indexOf(TRANSLATION_SEPARATOR);
    if (separatorAt < 0) {
      continue;
    }
    const preview = previewOf(value);
    translations.push({
      field: key.slice(0, separatorAt),
      locale: key.slice(separatorAt + TRANSLATION_SEPARATOR.length),
      preview,
      isEmpty: preview.trim() === "",
    });
  }

  return translations.sort(
    (a, b) => a.field.localeCompare(b.field) || a.locale.localeCompare(b.locale),
  );
}
