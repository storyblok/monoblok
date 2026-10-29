import { defineConfig } from "vite-plus";
import { resolve } from "node:path";

export default defineConfig({
  pack: [
    {
      alias: { "@": resolve(import.meta.dirname, "src") },
      attw: { level: "error", profile: "esm-only" },
      dts: true,
      entry: {
        index: "./src/index.ts",
        rsc: "./src/rsc/index.ts",
      },
      format: ["esm"],
      outDir: "./dist",
      publint: true,
      // Keeps one output file per source module, which is what preserves the
      // "use client" / "use server" directives in the chunks that carry them.
      unbundle: true,
    },
  ],
});
