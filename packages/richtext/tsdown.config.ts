import { defineConfig } from 'tsdown';

const tiptapGlobals: Record<string, string> = {
  '@tiptap/core': 'TiptapCore',
  '@tiptap/html': 'TiptapHtml',
  '@tiptap/extension-blockquote': 'TiptapBlockquote',
  '@tiptap/extension-bold': 'TiptapBold',
  '@tiptap/extension-code': 'TiptapCode',
  '@tiptap/extension-code-block': 'TiptapCodeBlock',
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
  exports: true,
  external: ['mdast'],
  outDir: './dist',
  publint: true,
  sourcemap: true,
};

const entries = [
  { name: 'index', path: './src/index.ts' },
  { name: 'markdown-parser', path: './src/markdown-parser.ts' },
  { name: 'html-parser', path: './src/html-parser.ts' },
  { name: 'test-utils', path: './src/test-utils/index.ts' },
];

export default [
  // ESM builds
  ...entries.map(e =>
    defineConfig({
      ...sharedConfig,
      entry: { [e.name]: e.path },
      format: 'esm',
    }),
  ),

  // CJS + UMD main entry
  defineConfig({
    ...sharedConfig,
    entry: { index: './src/index.ts' },
    format: ['cjs', 'umd'],
    inlineOnly: false,
    globalName: 'StoryblokRichtext',
  }),
  defineConfig({
    ...sharedConfig,
    entry: { 'test-utils': './src/test-utils/index.ts' },
    format: ['cjs', 'umd'],
    inlineOnly: false,
    globalName: 'StoryblokRichtextTestUtils',
  }),

  // Markdown parser CJS + UMD
  defineConfig({
    ...sharedConfig,
    entry: { 'markdown-parser': './src/markdown-parser.ts' },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtextMarkdownParser',
    inlineOnly: false,
    outputOptions: {
      globals: {
        'markdown-it': 'markdownit',
        ...tiptapGlobals,
      },
    },
  }),

  // HTML parser CJS + UMD
  defineConfig({
    ...sharedConfig,
    entry: { 'html-parser': './src/html-parser.ts' },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtextHtmlParser',
    inlineOnly: false,
    outputOptions: {
      globals: {
        'node-html-parser': 'NodeHtmlParser',
        ...tiptapGlobals,
      },
    },
  }),
];
