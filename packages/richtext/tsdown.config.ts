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
];
