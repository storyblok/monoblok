import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/generated/**/types.gen.ts',
  ],
  outDir: './dist',
  platform: "neutral",
  format: ['esm', "commonjs"],
  globalName: 'StoryblokManagementApiClient',
  sourcemap: true,
  attw: {
    profile: 'node16',
  },
  clean: true,
  dts: true,
  exports: {
    customExports(pkg) {
      // Remove auto-generated ./generated/* exports; expose types only via ./resources/*
      for (const key of Object.keys(pkg)) {
        if (key.startsWith('./generated/')) {
          delete pkg[key]
        }
      }
      pkg['./resources/*'] = {
        import: {
          types: './dist/generated/*/types.gen.d.ts',
          default: './dist/generated/*/types.gen.js',
        },
        require: {
          types: './dist/generated/*/types.gen.d.cts',
          default: './dist/generated/*/types.gen.cjs',
        },
      }
      return pkg
    },
  },
  publint: true,
  unbundle: true,
  external: [
    // Externalize generated client duplicates to reduce bundle size
    "./src/generated/*/client/*",
    "./src/generated/*/core/*"
  ]
});
