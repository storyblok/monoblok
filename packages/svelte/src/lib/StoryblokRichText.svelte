<script lang="ts" generics="T extends SbRichTextInput">
  import { renderRichText, type SbRichTextDoc, type SbRichTextInput, type SbRichTextRenderers } from './index';
  import MarkRenderer from './richtext/MarkRenderer.svelte';
  import StoryblokComponent from './StoryblokComponent.svelte';
  // eslint-disable-next-line import/no-self-import
  import StoryblokRichText from './StoryblokRichText.svelte';

  /* eslint-disable svelte/no-at-html-tags */

  type Props = {
    document: T;
    components?: SbRichTextRenderers;
  } & Record<string, unknown>;

  const { document, components = {} }: Props = $props();
  const nodes = $derived.by(() => {
    return document
      ? Array.isArray(document)
        ? document
        : document.type === 'doc'
          ? (document.content ?? [])
          : [document]
      : [];
  });

  export function createKeyGenerator() {
    let global = 0;

    return (prefix: string) =>
      (function* () {
        while (true) {
          yield `${prefix}-${++global}`;
        }
      })();
  }

  type KeyedNode<TNode> = {
    node: TNode;
    key: string;
  };
  const keyGen = createKeyGenerator();
  const keyedNodes = $derived.by((): KeyedNode<SbRichTextDoc>[] => {
    return nodes.map(node => ({
      node,
      key: node._uid ?? node.attrs?._uid ?? keyGen(node.type).next().value,
    }));
  });
</script>

{#each keyedNodes as { node, key } (key)}
  {#if node.type === 'text'}
    <MarkRenderer text={node.text} marks={node.marks ?? []} {components} />
  {:else}
    {@const type = node.type as keyof typeof components}
    {@const NodeComponent = components?.[type]}
    {#if NodeComponent}
      <NodeComponent {...node}>
        {#if node.content}
          <StoryblokRichText document={node.content} {components} />
        {/if}
      </NodeComponent>
    {:else if node.type === 'blok'}
      {@const body = Array.isArray(node.attrs?.body) ? node.attrs.body : []}
      {#each body as blok (blok._uid)}
        <StoryblokComponent {blok} />
      {/each}
    {:else}
      {@html renderRichText(node)}
    {/if}
  {/if}
{/each}
