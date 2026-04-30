import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    format: ["esm", "cjs"],
    exports: true,
    sourcemap: true,
    dts: true,
    attw: true,
    publint: true,
  },
  test: {
    environment: "jsdom",
  },
});
