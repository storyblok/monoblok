/** Base shape of every Storyblok block. All registered block components receive this as their `block` prop. */
export interface StoryblokBlockData {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: unknown;
}

/**
 * Helper type for typed block component props.
 *
 * @example
 * type PageProps = StoryblokComponentProps<{ body: StoryblokBlockData[] }>;
 * export default function Page({ block }: PageProps) { ... }
 */
export interface StoryblokComponentProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  block: StoryblokBlockData & T;
}
