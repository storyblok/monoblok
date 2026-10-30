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
    /** Warnings already printed by this registry, so each one prints only once. */
    __storyblokWarned?: Set<string>;
  } & Record<string, unknown>;

  const {
    block,
    __storyblokComponents: components,
    __storyblokFallback: fallback,
    __storyblokWarned: warned = new Set(),
    ...rest
  }: Props = $props();

  const Resolved = $derived.by(() => {
    if (!block) return undefined;
    const name = block.component;
    const registered = name ? components[name] : undefined;
    return registered ?? fallback;
  });

  const editable = $derived(block ? storyblokEditable(block) : undefined);

  function warnOnce(key: string, message: string) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(message);
  }

  function warnIfNothingRendered() {
    if (!block) {
      warnOnce(
        'undefined-block',
        '[storyblok] <StoryblokBlock /> received an undefined `block` prop and rendered nothing. ' +
          "Check that the value you're passing in exists, e.g. `story?.content` when the fetch " +
          'may have failed, or a typo in the prop name (`block`, not `blok`).',
      );
      return;
    }

    if (!Resolved) {
      warnOnce(
        `missing:${block.component}`,
        `[storyblok] No component registered for block type "${block.component}". ` +
          'Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.',
      );
    }
  }

  if (DEV) {
    // Effects don't run during SSR, so check once up front on the server.
    if (typeof window === 'undefined') warnIfNothingRendered();
    $effect(warnIfNothingRendered);
  }
</script>

{#if Resolved && block}
  <Resolved {block} {editable} {...rest} />
{/if}
