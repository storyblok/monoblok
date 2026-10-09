import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    exports: true,
    sourcemap: true,
    dts: true,
    attw: { profile: "node16" },
    publint: true,
  },
  test: {
    environment: "jsdom",
    include: ["./src/**/*.test.ts"],
  },
});
