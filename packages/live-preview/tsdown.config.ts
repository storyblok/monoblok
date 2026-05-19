import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  exports: true,
  sourcemap: true,
  dts: true,
  attw: false,
  publint: true,
});
