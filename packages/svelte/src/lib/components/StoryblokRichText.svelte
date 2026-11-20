<!--
  @component
  Renders a Storyblok rich text field. Embedded bloks render only through
  `components.blok`, and warn otherwise unless `warnings={false}`. To render
  them through your registered components, pass a component that renders
  `attrs.body` with `StoryblokBlock`.

  `data` reaches every custom component as `context.data`. Its type is checked
  against the components that declare one with
  `StoryblokSvelteRichTextProps<'blok', TData>`.

  @example
  ```svelte
  <StoryblokRichText document={block.text} components={{ heading: Heading }} />
  ```

  @example Passing data to the `blok` renderer
  ```svelte
  <StoryblokRichText document={block.text} components={{ blok: RichTextBlok }} data={{ locale }} />
  ```
-->
<script lang="ts" generics="TData = unknown">
  import { normalizeNodes } from '@storyblok/richtext';
  import RenderChildren from '../richtext/RenderChildren.svelte';
  import type { StoryblokRichTextComponentProps } from '../richtext-helpers';

  const {
    document,
    components = {},
    optimizeImage,
    data,
    warnings = true,
  }: StoryblokRichTextComponentProps<TData> = $props();
  const nodes = $derived.by(() => normalizeNodes(document, true));
</script>

<RenderChildren {nodes} options={{ components, optimizeImage, data, warnings }} />
