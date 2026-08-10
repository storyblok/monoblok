import { defineConfig } from "vite-plus";

const tiptapGlobals: Record<string, string> = {
  "@tiptap/core": "TiptapCore",
  "@tiptap/html": "TiptapHtml",
  "@tiptap/extension-blockquote": "TiptapBlockquote",
  "@tiptap/extension-bold": "TiptapBold",
  "@tiptap/extension-code": "TiptapCode",
  "@tiptap/extension-code-block": "TiptapCodeBlock",
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
};

const sharedConfig = {
  attw: true,
  clean: true,
  dts: true,
  exports: true,
  external: [
    "mdast",
    "@tiptap/core",
    "@tiptap/html",
    "@tiptap/suggestion",
    "prosemirror-model",
    "prosemirror-state",
    "prosemirror-transform",
    "prosemirror-view",
    "prosemirror-commands",
    "prosemirror-collab",
    "prosemirror-changeset",
    "orderedmap",
  ],
  outDir: "./dist",
  publint: true,
  sourcemap: true,
};

const entries = [
  { name: "index", path: "./src/index.ts" },
  { name: "markdown-parser", path: "./src/markdown-parser.ts" },
  { name: "html-parser", path: "./src/html-parser.ts" },
  { name: "test-utils", path: "./src/test-utils/index.ts" },
];

export default defineConfig({
  pack: [
    // ESM — one entry per config to avoid chunk splitting on .d.mts files
    ...entries.map((e) => ({
      ...sharedConfig,
      entry: { [e.name]: e.path },
      format: "esm" as const,
    })),

    // CJS + UMD main entry
    {
      ...sharedConfig,
      entry: { index: "./src/index.ts" },
      format: ["cjs", "umd"] as const,
      inlineOnly: false,
      globalName: "StoryblokRichtext",
      outputOptions: { globals: tiptapGlobals },
    },
    {
      ...sharedConfig,
      entry: { "test-utils": "./src/test-utils/index.ts" },
      format: ["cjs", "umd"] as const,
      inlineOnly: false,
      globalName: "StoryblokRichtextTestUtils",
      outputOptions: { globals: tiptapGlobals },
    },

    // Markdown parser CJS + UMD
    {
      ...sharedConfig,
      entry: { "markdown-parser": "./src/markdown-parser.ts" },
      format: ["cjs", "umd"] as const,
      inlineOnly: false,
      globalName: "StoryblokRichtextMarkdownParser",
      outputOptions: {
        globals: { "markdown-it": "markdownit", ...tiptapGlobals },
      },
    },

    // HTML parser CJS + UMD
    {
      ...sharedConfig,
      entry: { "html-parser": "./src/html-parser.ts" },
      format: ["cjs", "umd"] as const,
      inlineOnly: false,
      globalName: "StoryblokRichtextHtmlParser",
      outputOptions: {
        globals: { "node-html-parser": "NodeHtmlParser", ...tiptapGlobals },
      },
    },
  ],
});
