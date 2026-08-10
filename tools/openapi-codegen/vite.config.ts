import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm"],
    outDir: "./dist",
    dts: false,
    clean: true,
    platform: "node",
    external: ["typescript", "@hey-api/openapi-ts", "pathe"],
  },
});
