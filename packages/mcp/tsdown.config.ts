import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/factory.ts',
    './src/storyblok-mcp.ts',
    './src/copy-skill.ts',
  ],
  outDir: './dist',
  platform: 'node',
  format: ['esm'],
  globalName: 'StoryblokMCP',
  sourcemap: true,
  clean: true,
  dts: true,
  unbundle: true,
  fixedExtension: false,
  copy: [
    {
      from: './src/skills',
      to: './dist',
      flatten: false,
    },
  ],
});
