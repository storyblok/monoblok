import type { EditableFieldAttributes } from "@storyblok/preview-bridge";

// Mirrors @storyblok/preview-bridge's editableField. Kept local (like
// storyblokEditable above) so this package's CJS build never needs a runtime
// `require("@storyblok/preview-bridge")`, which fails: that package is ESM-only.
const fieldAttributeKey = "data-blok-f";

export default function editableField(
  field: string,
): EditableFieldAttributes | Record<string, never> {
  return typeof field === "string" && field ? { [fieldAttributeKey]: field } : {};
}
