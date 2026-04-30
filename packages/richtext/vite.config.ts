import { defineConfig } from "vite-plus";

const tiptapGlobals: Record<string, string> = {
  "@tiptap/core": "TiptapCore",
  "@tiptap/html": "TiptapHtml",
  "@tiptap/extension-blockquote": "TiptapBlockquote",
  "@tiptap/extension-bold": "TiptapBold",
  "@tiptap/extension-code": "TiptapCode",
  "@tiptap/extension-code-block": "TiptapCodeBlock",
  "@tiptap/extension-details": "TiptapDetails",
  "@tiptap/extension-document": "TiptapDocument",
  "@tiptap/extension-emoji": "TiptapEmoji",
  "@tiptap/extension-hard-break": "TiptapHardBreak",
  "@tiptap/extension-heading": "TiptapHeading",
  "@tiptap/extension-highlight": "TiptapHighlight",
  "@tiptap/extension-horizontal-rule": "TiptapHorizontalRule",
  "@tiptap/extension-image": "TiptapImage",
  "@tiptap/extension-italic": "TiptapItalic",
  "@tiptap/extension-link": "TiptapLink",
  "@tiptap/extension-list": "TiptapList",
  "@tiptap/extension-paragraph": "TiptapParagraph",
  "@tiptap/extension-strike": "TiptapStrike",
  "@tiptap/extension-subscript": "TiptapSubscript",
  "@tiptap/extension-superscript": "TiptapSuperscript",
  "@tiptap/extension-table": "TiptapTable",
  "@tiptap/extension-text": "TiptapText",
  "@tiptap/extension-text-style": "TiptapTextStyle",
  "@tiptap/extension-underline": "TiptapUnderline",
  "@tiptap/extension-text-align": "TiptapTextAlign",
};

const sharedConfig = {
  attw: true,
  clean: true,
  dts: true,
  exports: true,
  external: ["mdast"],
  outDir: "./dist",
  publint: true,
  sourcemap: true,
};

export default defineConfig({
  pack: [
    // ESM — one entry per config to avoid chunk splitting on .d.mts files
    { ...sharedConfig, entry: { index: "./src/index.ts" }, format: "esm" },
    { ...sharedConfig, entry: { "markdown-parser": "./src/markdown-parser.ts" }, format: "esm" },
    { ...sharedConfig, entry: { static: "./src/static/index.ts" }, format: ["esm", "cjs"] },
    { ...sharedConfig, entry: { "html-parser": "./src/html-parser.ts" }, format: "esm" },
    // CJS + UMD
    {
      ...sharedConfig,
      entry: { index: "./src/index.ts" },
      format: ["cjs", "umd"],
      globalName: "StoryblokRichtext",
      outputOptions: { globals: tiptapGlobals },
    },
    {
      ...sharedConfig,
      entry: { "markdown-parser": "./src/markdown-parser.ts" },
      format: ["cjs", "umd"],
      globalName: "StoryblokRichtextMarkdownParser",
      outputOptions: {
        globals: { "markdown-it": "markdownit", ...tiptapGlobals },
      },
    },
    {
      ...sharedConfig,
      entry: { "html-parser": "./src/html-parser.ts" },
      format: ["cjs", "umd"],
      globalName: "StoryblokRichtextHtmlParser",
      outputOptions: {
        globals: { "node-html-parser": "NodeHtmlParser", ...tiptapGlobals },
      },
    },
  ],
});
