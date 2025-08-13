import { defineConfig } from 'tsdown';

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
      },
    },
  }),
];
