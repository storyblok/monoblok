<script lang="ts">
  import { buildSvelteAttrs } from '../richtext-helpers';
  import { isSelfClosing, type RenderSpec, type SbRichTextElement } from '@storyblok/richtext';
  import type { Snippet } from 'svelte';
  // eslint-disable-next-line import/no-self-import
  import RenderStaticStructure from './RenderStaticStructure.svelte';
  import DynamicElement from './DynamicElement.svelte';

  type Props = {
    type: SbRichTextElement;
    specs: readonly RenderSpec[];
    parentAttrs?: Record<string, unknown>;
    children?: Snippet;
  };

  const { type, specs, parentAttrs, ...rest }: Props = $props();
</script>

{#each specs as spec, index (index)}
  {@const { tag, children, attrs: specAttrs } = spec}
  {@const Tag = tag}
  {@const mergedAttrs = { ...specAttrs, ...parentAttrs }}
  {@const processedAttrs = buildSvelteAttrs(type, mergedAttrs)}

  {#if isSelfClosing(Tag)}
    <DynamicElement tag={Tag} attrs={processedAttrs} selfClosing={true} />
  {:else}
    <DynamicElement tag={Tag} attrs={processedAttrs}>
      {#if children}
        <RenderStaticStructure {type} specs={children} {parentAttrs}>
          {@render rest.children?.()}
        </RenderStaticStructure>
      {:else}
        {@render rest.children?.()}
      {/if}
    </DynamicElement>
  {/if}
{/each}
