import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  // Enable TypeScript declaration generation
  declaration: true,
  // Clean the dist directory before building
  clean: true,
  // Rollup configuration
  rollup: {
    // Generate both CommonJS and ESM outputs
    emitCJS: true,
    // Generate source maps
    sourcemap: true,
  },
}) 