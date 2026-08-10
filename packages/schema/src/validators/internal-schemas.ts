/**
 * Single import site for the internal Zod v4 content-value schemas emitted by
 * codegen. These are never re-exported from the package root — only the
 * validators use them, preserving the "Zod never in public types" rule.
 */
export {
  zAssetFieldValue,
  zMultilinkFieldValue,
  zPluginFieldValue,
  zRichTextFieldValue,
  zTableFieldValue,
} from "../generated/overlay/zod.gen";

/**
 * @deprecated Use {@link zRichTextFieldValue} instead. Will be removed in a future major version.
 */
export { zRichTextFieldValue as zRichtextFieldValue } from "../generated/overlay/zod.gen";
