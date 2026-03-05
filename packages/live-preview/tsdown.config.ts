import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm', 'cjs'],
  exports: true,
  sourcemap: true,
  dts: true,
  attw: true,
  publint: true,
});
