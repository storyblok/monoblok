import { defineConfig } from 'tsdown';

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

export default [
  // ESM — one entry per config to avoid chunk splitting on .d.mts files
  defineConfig({
    ...sharedConfig,
    entry: { index: './src/index.ts' },
    format: 'esm',
  }),
  defineConfig({
    ...sharedConfig,
    entry: { 'markdown-parser': './src/markdown-parser.ts' },
    format: 'esm',
  }),
  defineConfig({
    ...sharedConfig,
    entry: { 'html-parser': './src/html-parser.ts' },
    format: 'esm',
  }),
  // CJS + UMD
  defineConfig({
    ...sharedConfig,
    entry: { index: './src/index.ts' },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtext',
  }),
  defineConfig({
    ...sharedConfig,
    entry: { 'markdown-parser': './src/markdown-parser.ts' },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtextMarkdownParser',
    outputOptions: {
      globals: {
        'markdown-it': 'markdownit',
      },
    },
  }),
  defineConfig({
    ...sharedConfig,
    entry: { 'html-parser': './src/html-parser.ts' },
    format: ['cjs', 'umd'],
    globalName: 'StoryblokRichtextHtmlParser',
    outputOptions: {
      globals: {
        'node-html-parser': 'NodeHtmlParser',
      },
    },
  }),
];
