import type { BridgeParams } from "@storyblok/live-preview";
import RawStoryblokPreview from "./components/StoryblokPreview.astro";
import RawStoryblokRichText from "./components/StoryblokRichText.astro";
import RawStoryblokServerData from "./components/StoryblokServerData.astro";
import type { StoryblokAstroRichTextComponentMap } from "./richtext-helpers";
import type { StoryblokRichTextImageOptions, StoryblokRichTextInput } from "@storyblok/richtext";

export { defineStoryblokBlocks } from "./define-storyblok-blocks";
export { storyblokPreviewMiddleware } from "./live-preview/middleware";
export { getPayload } from "./get-payload";
export { storyblokEditable, isInEditor } from "@storyblok/live-preview";
export type { BridgeParams } from "@storyblok/live-preview";
export { sanitizeJSON } from "./sanitize-json";

/**
 * Enables Storyblok Live Preview in the Visual Editor.
 *
 * @example
 * ```astro
 * ---
 * import { StoryblokPreview } from '@storyblok/astro';
 * ---
 *
 *   <StoryblokPreview />
 * ```
 *
 * @example Custom debounce and Preview Bridge options
 * ```astro
 * ---
 * import { StoryblokPreview } from '@storyblok/astro';
 * ---
 *
 * <StoryblokPreview debounceMs={200} bridgeOptions={{ resolveRelations: ['featured.articles'] }} />
 * ```
 */
// Inlined (not cast through `StoryblokPreviewProps`) so hovers show the
// real props instead of just the type name. Keep both in sync.
export const StoryblokPreview = RawStoryblokPreview as (props: {
  bridgeOptions?: BridgeParams;
  /** Debounce delay for consecutive input events. Defaults to 500ms. */
  debounceMs?: number;
}) => any;

/**
 * Passes server-side data to the client so it survives Live Preview updates.
 * Props are serialized as JSON (sanitized against XSS) and read back with
 * {@link getPayload}.
 *
 * @example
 * ```astro
 * ---
 * import { StoryblokServerData } from '@storyblok/astro';
 * const users = await getUsers();
 * ---
 *
 * <StoryblokServerData users={users} />
 * ```
 */
export const StoryblokServerData = RawStoryblokServerData as (
  props: Record<string, unknown>,
) => any;

/**
 * Renders a Storyblok rich text field.
 *
 * @example Basic
 * ```astro
 * ---
 * import { StoryblokRichText } from '@storyblok/astro';
 * ---
 *
 * <StoryblokRichText document={block.text} />
 * ```
 *
 * @example Advanced — custom renderers, image optimization, and extra data
 * ```astro
 * ---
 * import { StoryblokRichText } from '@storyblok/astro';
 * import Heading from '~/components/richtext/Heading.astro';
 * import Bold from '~/components/richtext/Bold.astro';
 * ---
 *
 * <StoryblokRichText
 *   document={block.text}
 *   components={{ heading: Heading, bold: Bold }}
 *   optimizeImage={{ width: 800 }}
 *   data={{ locale: Astro.currentLocale }}
 * />
 * ```
 */
// Inlined (not cast through `StoryblokRichTextComponentProps`) so hovers show
// the real props instead of just the type name. Keep both in sync.
export const StoryblokRichText = RawStoryblokRichText as (props: {
  document: StoryblokRichTextInput;
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokAstroRichTextComponentMap;
  data?: unknown;
}) => any;

export type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokBlockComponent,
  StoryblokBlockComponentProps,
  StoryblokBlockData,
  StoryblokBlockProps,
  StoryblokComponentMap,
  StoryblokEditableProps,
  StoryblokPreviewProps,
} from "./types";

export {
  buildAstroAttrs,
  isValidAstroComponent,
  type StoryblokAstroRichTextComponentMap,
  type StoryblokAstroRichTextProps,
  type StoryblokAstroRichTextRenderContext,
  type StoryblokRichTextComponent,
  type StoryblokRichTextComponentProps,
} from "./richtext-helpers";

export { buildStoryblokImage, renderRichText, splitTableRows } from "@storyblok/richtext";

export type {
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextNode,
  StoryblokRichTextProps,
  StoryblokRichTextRenderContext,
  StoryblokRichTextRenderSpec,
  StoryblokRichTextTextNode,
} from "@storyblok/richtext";

// Re-exporting helpers and types from @storyblok/richtext for StoryblokRichText.astro component.
export {
  attrsToHtmlString,
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  hasContent,
  isSelfClosing,
  normalizeNodes,
  processAttrs,
  resolveTag,
  styleToString,
} from "@storyblok/richtext";
