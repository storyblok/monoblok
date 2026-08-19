import { defineConfig } from "vite-plus";
import { resolve } from "node:path";

export default defineConfig({
  pack: [
    {
      alias: { "@": resolve(import.meta.dirname, "src") },
      // `node16` waives node10, which cannot resolve subpath exports at all.
      attw: { level: "error", profile: "node16" },
      dts: true,
      entry: {
        index: "./src/index.ts",
        rsc: "./src/rsc/index.ts",
        ssr: "./src/ssr/index.ts",
      },
      format: ["esm", "cjs"],
      outDir: "./dist",
      publint: true,
      // Keeps one output file per source module, which is what preserves the
      // "use client" / "use server" directives in the chunks that carry them.
      unbundle: true,
    },
  ],
});
