import type { BlockContent } from "./generated/types/field";

/**
 * Helper type for typed block component props.
 *
 * @example
 * type PageProps = StoryblokComponentProps<{ body: BlockContent[] }>;
 * export default function Page({ block }: PageProps) { ... }
 */
export interface StoryblokComponentProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  block: BlockContent & T;
}

export type { BlockContent };
