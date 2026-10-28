// @vitest-environment happy-dom
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "pathe";
import { expect, it } from "vitest";

// Regression test: node-mode interop in the CJS build turned the default export of
// `@tiptap/extension-*` into the whole module, so the parsers threw
// `default.extend is not a function` when loaded with require().
// Runs post-build (nx task graph ensures build → test order).
// `@tiptap/html` only ships a browser build for `require`, hence the DOM environment.

const req = createRequire(import.meta.url);
const pkgRoot = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
const cjsEntry = (subpath: string) => resolve(pkgRoot, pkg.exports[subpath].require);

it("should parse HTML when html-parser is loaded with require()", () => {
  const { htmlToStoryblokRichtext } = req(cjsEntry("./html-parser"));

  const document = htmlToStoryblokRichtext("<p><b>hi</b></p>");

  expect(document.content[0].content[0]).toMatchObject({
    type: "text",
    text: "hi",
    marks: [{ type: "bold" }],
  });
});

it("should parse markdown when markdown-parser is loaded with require()", () => {
  const { markdownToStoryblokRichtext } = req(cjsEntry("./markdown-parser"));

  const document = markdownToStoryblokRichtext("**hi**");

  expect(document.content[0].content[0]).toMatchObject({
    type: "text",
    text: "hi",
    marks: [{ type: "bold" }],
  });
});
