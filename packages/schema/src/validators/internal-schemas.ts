/**
 * Single import site for the internal Zod v4 content-value schemas emitted by
 * codegen. These are never re-exported from the package root — only the
 * validators use them, preserving the "Zod never in public types" rule.
 */
export {
  zAssetFieldValue,
  zMultilinkFieldValue,
  zPluginFieldValue,
  zRichtextFieldValue,
  zTableFieldValue,
} from '../generated/overlay/zod.gen';
