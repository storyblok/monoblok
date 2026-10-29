<script lang="ts">
  import { DEV } from 'esm-env';
  import { storyblokEditable } from '@storyblok/live-preview';
  import type { Component } from 'svelte';
  import type { StoryblokBlockData, StoryblokComponentMap } from '../types';

  type Props = {
    /** The block to render. */
    block?: StoryblokBlockData;
    /**
     * Map of Storyblok technical block names to the components rendering them.
     *
     * Namespaced so a user-declared `components`/`fallback` extra prop (see
     * `defineStoryblokBlocks<TExtraProps>()`) passes through untouched instead
     * of colliding with the registry.
     */
    __storyblokComponents: StoryblokComponentMap;
    /** Rendered for block types that are not present in `__storyblokComponents`. */
    __storyblokFallback?: Component<any>;
  } & Record<string, unknown>;

  const {
    block,
    __storyblokComponents: components,
    __storyblokFallback: fallback,
    ...rest
  }: Props = $props();

  const Resolved = $derived.by(() => {
    if (!block) return undefined;
    const name = block.component;
    const registered = name ? components[name] : undefined;
    return registered ?? fallback;
  });

  const editable = $derived(block ? storyblokEditable(block) : undefined);

  $effect(() => {
    if (!DEV) return;

    if (!block) {
      console.warn(
        '[storyblok] <StoryblokBlock /> received an undefined `block` prop and rendered nothing. ' +
          "Check that the value you're passing in exists, e.g. `story?.content` when the fetch " +
          'may have failed, or a typo in the prop name (`block`, not `blok`).',
      );
      return;
    }

    if (!Resolved) {
      console.warn(
        `[storyblok] No component registered for block type "${block.component}". ` +
          'Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.',
      );
    }
  });
</script>

{#if Resolved && block}
  <Resolved {block} {editable} {...rest} />
{/if}
