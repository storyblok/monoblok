# Markdown to Storyblok Richtext Conversion

The `@storyblok/richtext` package now includes a powerful utility to convert Markdown content to Storyblok's Rich Text format. This feature allows you to seamlessly transform Markdown documents into Storyblok-compatible rich text documents that can be used with the existing `richTextResolver`.

## Installation

The markdown-to-richtext functionality is included in the `@storyblok/richtext` package:

```bash
npm install @storyblok/richtext@latest
```

## Basic Usage

### Simple Conversion

```typescript
import { markdownToStoryblokRichtext } from '@storyblok/richtext';

const markdown = `
# Main Heading

This is a **bold** paragraph with *italic* text and [a link](https://example.com).

- List item 1
- List item 2

> This is a blockquote
`;

const richtextDoc = markdownToStoryblokRichtext(markdown);
console.log(richtextDoc);
```

### Using with richTextResolver

```typescript
import { markdownToStoryblokRichtext, richTextResolver } from '@storyblok/richtext';

const markdown = '# Hello World\nThis is a paragraph with [a link](https://storyblok.com).';
const richtextDoc = markdownToStoryblokRichtext(markdown);

// Convert to HTML using the existing richTextResolver
const html = richTextResolver().render(richtextDoc);
document.getElementById('content').innerHTML = html;
```

## Supported Markdown Elements

The markdown parser supports all standard Markdown elements:

- **Text formatting**: `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``
- **Links**: `[text](url)` and `[text](url "title")`
- **Headings**: `# H1` through `###### H6`
- **Lists**: `- unordered` and `1. ordered` lists with nesting
- **Code blocks**: ``` ```fenced``` ``` and indented blocks
- **Blockquotes**: `> quoted text`
- **Images**: `![alt](src "title")`
- **Tables**: Standard markdown table syntax
- **Horizontal rules**: `---`
- **Line breaks**: `  ` (two spaces) for hard breaks

## Custom Resolvers

You can customize how specific Markdown elements are converted by providing custom resolvers:

```typescript
import { markdownToStoryblokRichtext, MarkdownTokenTypes, BlockTypes } from '@storyblok/richtext';

const markdown = '# Custom Heading\nThis is a paragraph with [a link](https://example.com).';

const richtextDoc = markdownToStoryblokRichtext(markdown, {
  resolvers: {
    // Custom heading resolver
    [MarkdownTokenTypes.HEADING]: (token, children) => {
      const level = Number(token.tag.replace('h', ''));
      return {
        type: BlockTypes.HEADING,
        attrs: { 
          level,
          custom: true // Add custom attributes
        },
        content: children,
      };
    },
    
    // Custom link resolver
    [MarkdownTokenTypes.LINK]: (token, children) => {
      return {
        type: 'link',
        attrs: {
          href: token.attrGet('href'),
          title: token.attrGet('title') || null,
          target: '_blank', // Always open in new tab
        },
        content: children,
      };
    },
  },
});
```

## Advanced Examples

### Converting Markdown Files

```typescript
import { markdownToStoryblokRichtext, richTextResolver } from '@storyblok/richtext';

// Read markdown file (in a browser environment)
const response = await fetch('/content/article.md');
const markdown = await response.text();

// Convert to Storyblok richtext
const richtextDoc = markdownToStoryblokRichtext(markdown);

// Render to HTML with image optimization
const html = richTextResolver({
  optimizeImages: {
    width: 800,
    height: 600,
    filters: {
      format: 'webp',
      quality: 80,
    },
  },
}).render(richtextDoc);
```

### Framework Integration

#### React

```typescript
import React from 'react';
import { markdownToStoryblokRichtext, richTextResolver } from '@storyblok/richtext';

const MarkdownRenderer = ({ markdown }: { markdown: string }) => {
  const richtextDoc = markdownToStoryblokRichtext(markdown);
  
  const options = {
    renderFn: React.createElement,
    keyedResolvers: true,
  };
  
  const html = richTextResolver(options).render(richtextDoc);
  
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};
```

#### Vue

```vue
<script setup>
import { markdownToStoryblokRichtext, richTextResolver } from '@storyblok/richtext';
import { h, createTextVNode } from 'vue';

const props = defineProps<{
  markdown: string;
}>();

const richtextDoc = markdownToStoryblokRichtext(props.markdown);

const options = {
  renderFn: h,
  textFn: createTextVNode,
  keyedResolvers: true,
};

const root = () => richTextResolver(options).render(richtextDoc);
</script>

<template>
  <root />
</template>
```

## API Reference

### `markdownToStoryblokRichtext(markdown, options?)`

Converts a Markdown string to a Storyblok Rich Text document node.

**Parameters:**
- `markdown` (string): The Markdown content to convert
- `options` (MarkdownParserOptions, optional): Configuration options

**Returns:**
- `StoryblokRichTextDocumentNode`: A Storyblok-compatible rich text document

### `MarkdownParserOptions`

```typescript
interface MarkdownParserOptions {
  resolvers?: Partial<Record<string, MarkdownNodeResolver>>;
}
```

### `MarkdownNodeResolver`

```typescript
type MarkdownNodeResolver = (
  token: MarkdownToken,
  children: StoryblokRichTextDocumentNode[] | undefined
) => StoryblokRichTextDocumentNode | null;
```

### `MarkdownTokenTypes`

Constants for supported Markdown token types:

```typescript
export const MarkdownTokenTypes = {
  HEADING: 'heading_open',
  PARAGRAPH: 'paragraph_open',
  TEXT: 'text',
  STRONG: 'strong_open',
  EMP: 'em_open',
  ORDERED_LIST: 'ordered_list_open',
  BULLET_LIST: 'bullet_list_open',
  LIST_ITEM: 'list_item_open',
  IMAGE: 'image',
  BLOCKQUOTE: 'blockquote_open',
  CODE_INLINE: 'code_inline',
  CODE_BLOCK: 'code_block',
  FENCE: 'fence',
  LINK: 'link_open',
  HR: 'hr',
  DEL: 'del_open',
  HARD_BREAK: 'hardbreak',
  SOFT_BREAK: 'softbreak',
  TABLE: 'table_open',
  THEAD: 'thead_open',
  TBODY: 'tbody_open',
  TR: 'tr_open',
  TH: 'th_open',
  TD: 'td_open',
  S: 's_open',
} as const;
```

## Migration from Other Markdown Parsers

If you're currently using other Markdown parsers, the `markdownToStoryblokRichtext` function provides a seamless migration path:

```typescript
// Before: Using a different markdown parser
import marked from 'marked';
const html = marked(markdown);

// After: Using Storyblok's markdown-to-richtext
import { markdownToStoryblokRichtext, richTextResolver } from '@storyblok/richtext';
const richtextDoc = markdownToStoryblokRichtext(markdown);
const html = richTextResolver().render(richtextDoc);
```

## Best Practices

1. **Content Validation**: Always validate your Markdown content before conversion
2. **Custom Resolvers**: Use custom resolvers to maintain consistency with your existing content structure
3. **Image Optimization**: Leverage the `optimizeImages` option in `richTextResolver` for better performance
4. **Error Handling**: Wrap conversion in try-catch blocks for robust error handling

```typescript
try {
  const richtextDoc = markdownToStoryblokRichtext(markdown);
  // Process the converted document
} catch (error) {
  console.error('Failed to convert markdown:', error);
  // Handle the error appropriately
}
```

## Browser Support

The markdown-to-richtext functionality works in all modern browsers and Node.js environments. It uses the `markdown-it` library internally, which provides excellent compatibility and performance.

## Contributing

The markdown-to-richtext functionality is part of the `@storyblok/richtext` package. For issues, feature requests, or contributions, please visit the [monoblok repository](https://github.com/storyblok/monoblok). 