import type { StoryblokReactRichTextComponentMap } from "./index";
import type { StoryblokRichTextInput } from "@storyblok/richtext";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  customRendererFixture,
  integrationFixtures,
  linkFixtures,
  markFixtures,
  nodeFixtures,
  tableFixtures,
} from "@storyblok/richtext/test-utils";
import CustomHeading from "./fixtures/custom-heading";
import CustomLink from "./fixtures/custom-link";
import CustomCodeBlock from "./fixtures/code-component";
import CustomTable from "./fixtures/custom-table";
import CustomText from "./fixtures/custom-text";
import HeadingWithRichText from "./fixtures/heading-with-rich-text";
import CustomBoldWithRichText from "./fixtures/custom-bold-with-rich-text";
import { defineStoryblokComponents } from "../define-storyblok-components";
import { createStoryblokRichText } from "./create-storyblok-richtext";

const { StoryblokRichText } = defineStoryblokComponents({ components: {} });
// Standalone renderer with no embedded block support — the replacement for
// the removed module-level `StoryblokRichText` export from "./index".
const RootStoryblokRichText = createStoryblokRichText();

interface AttributePositionRule {
  key: string;
  position: number;
}
/**
 * Utility function to move an attribute in img tags to a consistent position for testing purposes.
 * This is necessary because the order of attributes in HTML can be non-deterministic, which can cause snapshot tests to fail even if the rendered output is functionally correct.
 */
export function moveImgAttribute(
  html: string,
  attribute = "src",
  rules: AttributePositionRule[] = [],
): string {
  const div = document.createElement("div");

  div.innerHTML = html.trim();

  const images = div.querySelectorAll("img");

  for (const [_, img] of images.entries()) {
    const matchedRule = rules.find((rule) => img.hasAttribute(rule.key));

    if (!matchedRule) {
      continue;
    }

    if (!img.hasAttribute(attribute)) {
      continue;
    }

    const attrs = Array.from(img.attributes).map((attr) => [attr.name, attr.value] as const);

    const target = attrs.find(([name]) => name === attribute);

    if (!target) {
      continue;
    }

    const filtered = attrs.filter(([name]) => name !== attribute);

    const insertIndex = Math.min(Math.max(matchedRule.position, 0), filtered.length);

    filtered.splice(insertIndex, 0, target);

    const attrString = filtered.map(([name, value]) => `${name}="${value}"`).join(" ");

    const htmlString = `<img ${attrString}>`;

    const temp = document.createElement("div");

    temp.innerHTML = htmlString;

    const replacement = temp.firstElementChild;

    if (!replacement) {
      continue;
    }

    img.replaceWith(replacement);
  }
  return div.innerHTML;
}

function alignImageSrcAttribute(html: string): string {
  return moveImgAttribute(html, "src", [
    {
      key: "id",
      position: 1, // 2nd attribute
    },
    {
      key: "data-emoji",
      position: 2, // 3rd attribute
    },
  ]);
}

describe("react StoryblokRichText component", () => {
  describe("input handling", () => {
    it("returns nothing for null input", () => {
      const { container } = render(<StoryblokRichText document={null} />);
      expect(container.innerHTML).toBe("");
    });
    it("returns nothing for undefined input", () => {
      const { container } = render(<StoryblokRichText document={undefined} />);
      expect(container.innerHTML).toBe("");
    });
    it("returns nothing for empty array", () => {
      const { container } = render(<StoryblokRichText document={[]} />);
      expect(container.innerHTML).toBe("");
    });
  });
  describe("nodes", () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(expected);
      });
    });
  });
  describe("marks", () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(expected);
      });
    });
  });
  describe("links", () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(expected);
      });
    });
  });
  describe("tables", () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(expected);
      });
    });
  });
  describe("integration", () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(expected);
      });
    });
  });
  describe("custom components", () => {
    const node_and_mark = customRendererFixture.node_and_mark;
    it(node_and_mark.title, () => {
      const options: StoryblokReactRichTextComponentMap = {
        heading: CustomHeading,
        link: CustomLink,
        bold: ({ children }) => <b data-type="custom-bold">{children}</b>,
      };
      const { container } = render(
        <StoryblokRichText document={node_and_mark.input} components={options} />,
      );
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(node_and_mark.expected);
    });
    const recursive = customRendererFixture.recursive;
    it(recursive.title, () => {
      const options: StoryblokReactRichTextComponentMap = {
        heading: ({ content, attrs }) => (
          <h1 data-type="custom-heading" data-level={attrs?.level}>
            <StoryblokRichText document={content} components={options} />
          </h1>
        ),
        bold: ({ children }) => <b data-type="custom-bold">{children}</b>,
      };
      const { container } = render(
        <StoryblokRichText document={recursive.input} components={options} />,
      );

      expect(alignImageSrcAttribute(container.innerHTML)).toBe(recursive.expected);
    });
    const code_block = customRendererFixture.code_block;
    it(code_block.title, () => {
      const options: StoryblokReactRichTextComponentMap = {
        code_block: CustomCodeBlock,
      };
      const { container } = render(
        <StoryblokRichText document={code_block.input} components={options} />,
      );
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(code_block.expected);
    });
    const table = customRendererFixture.table;

    it(table.title, () => {
      const options: StoryblokReactRichTextComponentMap = {
        table: CustomTable,
        bold: ({ children }) => <b data-type="custom-bold">{children}</b>,
      };
      const { container } = render(
        <StoryblokRichText document={table.input} components={options} />,
      );
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(table.expected);
    });
    const text_node = customRendererFixture.text_node;
    it(text_node.title, () => {
      const options: StoryblokReactRichTextComponentMap = {
        text: CustomText,
      };
      const { container } = render(
        <StoryblokRichText
          document={text_node.input}
          components={options}
          data={{ prefix: "[prefix]" }}
        />,
      );
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(text_node.expected);
    });
    const infinite_loop = customRendererFixture.infinite_loop_prevention;
    it(infinite_loop.title, () => {
      const options: StoryblokReactRichTextComponentMap = {
        heading: HeadingWithRichText,
      };
      const { container } = render(
        <StoryblokRichText document={infinite_loop.input} components={options} />,
      );
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(infinite_loop.expected);
    });

    it("prevents infinite recursion for a custom mark component (matching node-level guard)", () => {
      const document: StoryblokRichTextInput = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "outer", marks: [{ type: "bold" }] }],
          },
        ],
      };
      const options: StoryblokReactRichTextComponentMap = {
        bold: CustomBoldWithRichText,
      };

      const { container } = render(<StoryblokRichText document={document} components={options} />);

      // Terminates at depth 1: the outer bold uses the custom component, the
      // nested bold (rendered through the stripped context) falls back to the
      // default <strong> tag instead of recursing into CustomBoldWithRichText again.
      const outer = container.querySelector('[data-type="recursive-bold"]');
      expect(outer).not.toBeNull();
      expect(outer?.querySelector('[data-type="recursive-bold"]')).toBeNull();
      expect(outer?.querySelector("strong")).not.toBeNull();
    });
  });

  // ─── Root StoryblokRichText — blok nodes (finding #5) ─────────────────────

  describe("root StoryblokRichText — blok node handling", () => {
    const blokDoc: StoryblokRichTextInput = {
      type: "doc",
      content: [
        {
          type: "blok",
          attrs: {
            id: "blok-1",
            body: [{ component: "teaser", _uid: "uid-1" }],
          },
        },
      ],
    };

    it("warns when a blok node appears with no blok component registered", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { container } = render(<RootStoryblokRichText document={blokDoc} />);
      expect(container.textContent).toBe("");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"blok"'));
      warnSpy.mockRestore();
    });

    it("does NOT warn when a blok component is provided via the components prop", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <RootStoryblokRichText
          document={blokDoc}
          components={{
            blok: ({ attrs }: any) => (
              <div data-testid="inline-blok">{attrs?.body?.[0]?.component}</div>
            ),
          }}
        />,
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ─── Root StoryblokRichText — data prop forwarding (finding #6) ───────────

  describe("root StoryblokRichText — data prop forwarding", () => {
    it("forwards the data prop to custom node components via context", () => {
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
      };

      const receivedData: unknown[] = [];
      const Paragraph = ({ children, context }: any) => {
        receivedData.push(context?.data);
        return <p>{children}</p>;
      };

      render(
        <RootStoryblokRichText
          document={doc}
          data={{ locale: "de-AT" }}
          components={{ paragraph: Paragraph }}
        />,
      );

      expect(receivedData).toHaveLength(1);
      expect(receivedData[0]).toEqual({ locale: "de-AT" });
    });

    it("forwards the full data object to context.data by reference, not just the keys a component reads", () => {
      const dataObj = { locale: "de-AT", flags: { beta: true }, tags: ["a", "b"] };
      let received: unknown;
      const Paragraph = ({ children, context }: any) => {
        received = context?.data;
        return <p>{children}</p>;
      };
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
      };

      render(
        <RootStoryblokRichText
          document={doc}
          data={dataObj}
          components={{ paragraph: Paragraph }}
        />,
      );

      expect(received).toBe(dataObj);
    });
  });

  // ─── Custom node components — receiving both node props and context.data ──

  describe("custom node components — node props alongside context.data", () => {
    it("threads data through a recursive custom component (heading) into a nested custom component (text)", () => {
      const options: StoryblokReactRichTextComponentMap = {
        heading: HeadingWithRichText,
        text: CustomText,
      };
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "world" }],
          },
        ],
      };

      const { container } = render(
        <StoryblokRichText document={doc} components={options} data={{ prefix: "[hi]" }} />,
      );

      // HeadingWithRichText re-renders its content via a nested StoryblokRichText,
      // spreading `{...context}` — so `data` reaches CustomText two levels down.
      expect(container.textContent).toContain("[hi] WORLD");
    });

    it("gives a custom component both its own node props (attrs/text) and context.data at the same time", () => {
      let receivedText: string | undefined;
      let receivedPrefix: string | undefined;
      function ProbeText({ text, context }: any) {
        receivedText = text;
        receivedPrefix = (context?.data as { prefix?: string } | undefined)?.prefix;
        return <>{text}</>;
      }
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "payload" }] }],
      };

      render(
        <RootStoryblokRichText
          document={doc}
          components={{ text: ProbeText }}
          data={{ prefix: "[tag]" }}
        />,
      );

      expect(receivedText).toBe("payload");
      expect(receivedPrefix).toBe("[tag]");
    });

    it("does NOT spread `data` keys as top-level props on a custom node component — only `blok`'s default embed does that", () => {
      let receivedProps: Record<string, unknown> | undefined;
      function ProbeText(props: any) {
        receivedProps = props;
        return <>{props.text}</>;
      }
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
      };

      render(
        <RootStoryblokRichText
          document={doc}
          components={{ text: ProbeText }}
          data={{ locale: "de" }}
        />,
      );

      // `locale` is nested under context.data, never spread directly onto props.
      expect(receivedProps?.locale).toBeUndefined();
      expect((receivedProps?.context as { data?: unknown } | undefined)?.data).toEqual({
        locale: "de",
      });
    });
  });
});
