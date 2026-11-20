import {
  processAttrs,
  type StoryblokRichTextElement,
  type StoryblokRichTextImageOptions,
  type StoryblokRichTextInput,
  type StoryblokRichTextProps,
  styleToString,
} from "@storyblok/richtext";
import type { Component, Snippet } from "svelte";

/**
 * Map of rich text node and mark names to custom components.
 *
 * `TData` is the type of the `data` passed to `StoryblokRichText`. Each
 * component is checked against the props it receives for its key, so a
 * component declaring `StoryblokSvelteRichTextProps<'blok', { locale: string }>`
 * only fits a map whose `data` provides `locale`. Components that don't read
 * `data` fit any map.
 */
export type StoryblokSvelteRichTextComponentMap<TData = unknown> = {
  [K in StoryblokRichTextElement]?: Component<StoryblokSvelteRichTextProps<K, TData>>;
};

/**
 * The `context` prop every custom rich text component receives.
 *
 * `TData` is the type of `data`, matching the `data` passed to
 * `StoryblokRichText`.
 */
export interface StoryblokSvelteRichTextRenderContext<TData = unknown> {
  optimizeImage?: boolean | Partial<StoryblokRichTextImageOptions>;
  /**
   * The custom components of the surrounding `StoryblokRichText`, to pass on
   * when a custom component renders `StoryblokRichText` itself.
   */
  // `any` rather than `TData`: a map typed with `TData` would make `TData`
  // invariant, rejecting components that don't read `data` once it's set.
  components?: StoryblokSvelteRichTextComponentMap<any>;
  /** The `data` passed to `StoryblokRichText`. */
  data: TData;
  /**
   * Logs a warning when a `blok` node has no `components.blok` renderer. Set
   * to `false` to silence it.
   *
   * @default true
   */
  warnings?: boolean;
}

/**
 * Props accepted by the `StoryblokRichText` component.
 *
 * `TData` is the type of `data`. It's inferred from `data` and from the
 * `components` that declare it, and `data` becomes required once a component
 * declares it.
 */
export type StoryblokRichTextComponentProps<TData = unknown> = {
  /** The Storyblok rich text field to render. */
  document: StoryblokRichTextInput;
  /** Resolves `StoryblokRichTextImageOptions` or enables defaults when `true`. */
  optimizeImage?: boolean | Partial<StoryblokRichTextImageOptions>;
  /** Overrides the default renderer for specific node/mark types. */
  components?: StoryblokSvelteRichTextComponentMap<TData>;
  /**
   * Logs a warning when a `blok` node has no `components.blok` renderer. Set
   * to `false` to silence it.
   *
   * @default true
   */
  warnings?: boolean;
} & (unknown extends TData
  ? {
      /** Data forwarded to custom `components` as `context.data`. */
      data?: TData;
    }
  : {
      /** Data forwarded to custom `components` as `context.data`. */
      data: TData;
    });

/**
 * Props of a custom rich text component for the node or mark `T`.
 *
 * `TData` types `context.data`, the `data` passed to `StoryblokRichText`.
 *
 * @example
 * ```ts
 * const { attrs, context }: StoryblokSvelteRichTextProps<'blok', { locale: string }> = $props();
 * ```
 */
export type StoryblokSvelteRichTextProps<
  T extends StoryblokRichTextElement,
  TData = unknown,
> = Omit<StoryblokRichTextProps<T>, "context" | "children"> & {
  context: StoryblokSvelteRichTextRenderContext<TData>;
  children?: Snippet;
};

export function buildSvelteAttrs(
  type: StoryblokRichTextElement,
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const processedAttrs = processAttrs(type, attrs, {
    colspan: "colspan",
    rowspan: "rowspan",
  });

  const styleObj = processedAttrs?.style as Record<string, unknown> | undefined;
  const finalAttrs: Record<string, unknown> = { ...processedAttrs };

  if (styleObj) {
    finalAttrs.style = styleToString(styleObj);
  }

  return finalAttrs;
}
