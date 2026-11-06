<script lang="ts">
  import type { Component } from 'svelte';
  import type { StoryblokRichTextInput } from '@storyblok/richtext';

  type Props = {
    document: StoryblokRichTextInput;
    StoryblokRichText: Component<{ document: StoryblokRichTextInput }>;
  };

  let { document = $bindable(), StoryblokRichText }: Props = $props();

  export function update(nextDocument: StoryblokRichTextInput): void {
    document = nextDocument;
  }
</script>

<StoryblokRichText {document} />
