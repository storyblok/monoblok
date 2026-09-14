import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    format: ["esm", "cjs"],
    exports: true,
    sourcemap: true,
    dts: true,
    unbundle: true,
    attw: true,
    publint: true,
  },
  test: {
    environment: "jsdom",
  },
});
