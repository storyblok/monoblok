<script module lang="ts">
  import type { Component } from 'svelte';
  import type { StoryblokBlockData } from '../types';

  /** The registry `defineStoryblokBlocks()` binds a `StoryblokBlock` to. */
  export type StoryblokBlockRegistry = {
    /** The registered component for a block type, or the fallback. */
    resolve: (name: string) => Component<any> | undefined;
    /**
     * Logs `message` once per `key`, unless the registry was defined with
     * `warnings: false`.
     */
    warn: (key: string, message: string) => void;
  };

  /**
   * Namespaced so it can't collide with a user-declared extra prop (see
   * `defineStoryblokBlocks<TExtraProps>()`).
   */
  export const REGISTRY_PROP = '__storyblokRegistry';

  export type RawStoryblokBlockProps = {
    /** The block to render. */
    block?: StoryblokBlockData;
    [REGISTRY_PROP]: StoryblokBlockRegistry;
  } & Record<string, unknown>;
</script>

<script lang="ts">
  import { isInEditor, storyblokEditable } from '@storyblok/live-preview';

  // `$props()` can't destructure a computed key, hence the literal `REGISTRY_PROP`.
  const { block, __storyblokRegistry: registry, ...rest }: RawStoryblokBlockProps = $props();

  const Resolved = $derived(block ? registry.resolve(block.component) : undefined);

  const editable = $derived(block ? storyblokEditable(block) : undefined);

  function warnIfNothingRendered() {
    if (!block) {
      // Skipped in the Visual Editor, where the bridge sends a story without
      // `content` while the editor shows a previous version (visual history).
      const inEditor = typeof window !== 'undefined' && isInEditor(new URL(window.location.href));
      if (!inEditor) {
        registry.warn(
          'undefined-block',
          '[storyblok] <StoryblokBlock /> received an undefined `block` prop and rendered nothing. ' +
            "Check that the value you're passing in exists, e.g. `story?.content` when the fetch " +
            'may have failed, or a typo in the prop name (`block`, not `blok`).',
        );
      }
      return;
    }

    // Content editors can add block types the code doesn't know about, so
    // this warns by default: otherwise the content silently goes missing.
    if (!Resolved) {
      registry.warn(
        `missing:${block.component}`,
        `[storyblok] No component registered for block type "${block.component}". ` +
          'Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.',
      );
    }
  }

  // Effects don't run during SSR, so check once up front on the server.
  if (typeof window === 'undefined') warnIfNothingRendered();
  $effect(warnIfNothingRendered);
</script>

{#if Resolved && block}
  <!-- `rest` first, so an untyped extra prop (e.g. from rich text `data`)
       can't replace the injected `block` or `editable`. -->
  <Resolved {...rest} {block} {editable} />
{/if}
