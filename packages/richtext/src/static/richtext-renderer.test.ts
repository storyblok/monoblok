import { describe, expect, it, vi } from "vitest";
import { richTextRenderer } from "./richtext-renderer";
import type { StoryblokRichTextJson } from "./types";

describe("richTextRenderer", () => {
  describe("empty and null inputs", () => {
    it("should return empty string for null input", () => {
      const result = richTextRenderer(null as unknown as StoryblokRichTextJson);
      expect(result).toBe("");
    });

    it("should return empty string for undefined input", () => {
      const result = richTextRenderer(undefined as unknown as StoryblokRichTextJson);
      expect(result).toBe("");
    });

    it("should return empty string for doc with empty content", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("");
    });

    it("should return empty string for doc with undefined content", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("");
    });
  });
  describe("skip blok rendering", () => {
    it("should skip rendering blok nodes", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: { id: "123" },
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("");
      expect(warnSpy).toHaveBeenCalledWith(
        'Rendering of "blok" nodes is not supported in richTextRenderer.',
      );

      warnSpy.mockRestore();
    });
  });
  describe("paragraph rendering", () => {
    it("should render a simple paragraph", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello World" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p>Hello World</p>");
    });

    it("should render multiple paragraphs", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "First" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Second" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p>First</p><p>Second</p>");
    });

    it("should render paragraph with text alignment", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [{ type: "text", text: "Centered" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe('<p style="text-align: center">Centered</p>');
    });
  });

  describe("text marks", () => {
    it("should render bold text", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bold",
                marks: [{ type: "bold" }],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p><strong>Bold</strong></p>");
    });

    it("should render italic text", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Italic",
                marks: [{ type: "italic" }],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p><em>Italic</em></p>");
    });

    it("should render nested marks (bold + italic)", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bold Italic",
                marks: [{ type: "bold" }, { type: "italic" }],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p><em><strong>Bold Italic</strong></em></p>");
    });

    it("should render link mark", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe('<p><a href="https://example.com">Link</a></p>');
    });
  });

  describe("headings", () => {
    it("should render h1 heading", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Heading 1" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<h1>Heading 1</h1>");
    });

    it("should render h3 heading", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Heading 3" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<h3>Heading 3</h3>");
    });
  });

  describe("lists", () => {
    it("should render unordered list", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "bullet_list",
            content: [
              {
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1" }],
                  },
                ],
              },
              {
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 2" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>");
    });

    it("should render ordered list", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "ordered_list",
            content: [
              {
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<ol><li><p>First</p></li></ol>");
    });
  });

  describe("blockquote", () => {
    it("should render blockquote", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Quote" }],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<blockquote><p>Quote</p></blockquote>");
    });
  });

  describe("code block", () => {
    it("should render code block with pre > code structure", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "code_block",
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<pre><code>const x = 1;</code></pre>");
    });
  });

  describe("self-closing tags", () => {
    it("should render hard break", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Line 1" },
              { type: "hard_break" },
              { type: "text", text: "Line 2" },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p>Line 1<br />Line 2</p>");
    });

    it("should render horizontal rule", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [{ type: "horizontal_rule" }],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<hr />");
    });

    it("should render image", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://example.com/image.jpg", alt: "Example" },
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe('<img src="https://example.com/image.jpg" alt="Example" />');
    });
  });

  describe("xSS prevention", () => {
    it("should escape HTML entities in text content", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: '<script>alert("XSS")</script>' }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</p>");
    });

    it("should escape ampersands in text", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Tom & Jerry" }],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe("<p>Tom &amp; Jerry</p>");
    });

    it("should escape quotes in attribute values", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Link",
                marks: [
                  {
                    type: "link",
                    attrs: { href: 'https://example.com?a="test"' },
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toContain('href="https://example.com?a=&quot;test&quot;"');
    });
  });

  describe("non-doc root node", () => {
    it("should render a single paragraph node directly", () => {
      const node: StoryblokRichTextJson = {
        type: "paragraph",
        content: [{ type: "text", text: "Direct" }],
      };
      const result = richTextRenderer(node);
      expect(result).toBe("<p>Direct</p>");
    });
  });

  describe("table rendering", () => {
    it("should render table with tbody structure", () => {
      const doc: StoryblokRichTextJson = {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Cell 1" }],
                      },
                    ],
                  },
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Cell 2" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = richTextRenderer(doc);
      expect(result).toBe(
        "<table><tbody><tr><td><p>Cell 1</p></td><td><p>Cell 2</p></td></tr></tbody></table>",
      );
    });
  });
});
