import { defineConfig, type Plugin } from 'vitest/config';
import { join, resolve } from 'node:path';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react';

/**
 * Fixes vite-plugin-dts generating `export {}` at the end of re-export files,
 * which negates the `export * from '...'` statement.
 */
function fixDtsExports(): Plugin {
  return {
    name: 'fix-dts-exports',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const fixFile = (filePath: string) => {
        const content = readFileSync(filePath, 'utf-8');
        // Fix: `export * from './foo'\nexport {}\n` -> `export * from './foo'\n`
        if (content.includes('export {}') && content.includes('export *')) {
          const fixed = content.replace(/\nexport \{\}\s*$/, '\n');
          writeFileSync(filePath, fixed);
        }
      };
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const fullPath = join(dir, entry);
          if (statSync(fullPath).isDirectory()) {
            walk(fullPath);
          }
          else if (entry.endsWith('.d.ts') && !entry.endsWith('.d.ts.map')) {
            fixFile(fullPath);
          }
        }
      };
      walk(distDir);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
    fixDtsExports(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: {
        'index': resolve(__dirname, 'src/index.ts'),
        'ssr': resolve(__dirname, 'src/ssr/index.ts'),
        'rsc': resolve(__dirname, 'src/rsc/index.ts'),
        'v2': resolve(__dirname, 'src/v2/index.ts'),
        'v2/client': resolve(__dirname, 'src/v2/client/index.ts'),
        'v2/rsc': resolve(__dirname, 'src/v2/rsc/index.ts'),
      },
      name: 'storyblokReact',
      fileName: (format, entry) => {
        const name = entry;
        return format === 'es' ? `${name}.mjs` : `${name}.js`;
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'next',
        'next/cache',
        'next/server',
        '@storyblok/js',
        '@storyblok/richtext',
        /^next\//,
      ],
      output: {
        globals: { react: 'React' },
      },
    },
  },
  test: {
    globals: true,
    include: ['./src/__tests__/**/*'],
    exclude: ['./src/__tests__/cypress', './src/__tests__/testing-components'],
  },
});
