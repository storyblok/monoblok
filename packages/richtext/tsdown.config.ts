import { defineConfig } from 'tsdown';

const tiptapGlobals: Record<string, string> = {
  '@tiptap/core': 'TiptapCore',
  '@tiptap/html': 'TiptapHtml',
  '@tiptap/extension-blockquote': 'TiptapBlockquote',
  '@tiptap/extension-bold': 'TiptapBold',
  '@tiptap/extension-code': 'TiptapCode',
  '@tiptap/extension-code-block': 'TiptapCodeBlock',
  '@tiptap/extension-details': 'TiptapDetails',
  '@tiptap/extension-document': 'TiptapDocument',
  '@tiptap/extension-emoji': 'TiptapEmoji',
  '@tiptap/extension-hard-break': 'TiptapHardBreak',
  '@tiptap/extension-heading': 'TiptapHeading',
  '@tiptap/extension-highlight': 'TiptapHighlight',
  '@tiptap/extension-horizontal-rule': 'TiptapHorizontalRule',
  '@tiptap/extension-image': 'TiptapImage',
  '@tiptap/extension-italic': 'TiptapItalic',
  '@tiptap/extension-link': 'TiptapLink',
  '@tiptap/extension-list': 'TiptapList',
  '@tiptap/extension-paragraph': 'TiptapParagraph',
  '@tiptap/extension-strike': 'TiptapStrike',
  '@tiptap/extension-subscript': 'TiptapSubscript',
  '@tiptap/extension-superscript': 'TiptapSuperscript',
  '@tiptap/extension-table': 'TiptapTable',
  '@tiptap/extension-text': 'TiptapText',
  '@tiptap/extension-text-style': 'TiptapTextStyle',
  '@tiptap/extension-underline': 'TiptapUnderline',
};

const sharedConfig = {
  attw: true,
  clean: true,
  dts: true,
  external: ['mdast'],
  outDir: './dist',
  sourcemap: true,
};

export default [
  defineConfig({
    ...sharedConfig,
    entry: {
      'index': './src/index.ts',
      'markdown-parser': './src/markdown-parser.ts',
      'html-parser': './src/html-parser.ts',
    },
    format: 'esm',
  }),
  defineConfig({
    ...sharedConfig,
    entry: {
      index: './src/index.ts',
    },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtext',
    outputOptions: {
      globals: tiptapGlobals,
    },
  }),
  defineConfig({
    ...sharedConfig,
    entry: {
      'markdown-parser': './src/markdown-parser.ts',
    },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtextMarkdownParser',
    outputOptions: {
      globals: {
        'markdown-it': 'markdownit',
        ...tiptapGlobals,
      },
    },
  }),
  defineConfig({
    ...sharedConfig,
    entry: {
      'html-parser': './src/html-parser.ts',
    },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtextHtmlParser',
    outputOptions: {
      globals: {
        'node-html-parser': 'NodeHtmlParser',
        ...tiptapGlobals,
      },
    },
  }),
];
