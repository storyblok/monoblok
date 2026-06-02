import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  exports: true,
  sourcemap: true,
  dts: true,
  attw: {
    profile: 'esm-only',
  },
  publint: true,
});
