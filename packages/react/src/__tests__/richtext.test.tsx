import type { StoryblokReactRichTextComponentMap } from "@storyblok/react";
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
import CustomHeading from "./richtext/CustomHeading";
import CustomLink from "./richtext/CustomLink";
import CustomCodeBlock from "./richtext/CodeComponent";
import CustomTable from "./richtext/CustomTable";
import CustomText from "./richtext/CustomText";
import HeadingWithRichText from "./richtext/HeadingWithRichText";
import { defineStoryblokComponents } from "../define-storyblok-components";
import { StoryblokRichText as RootStoryblokRichText } from "../richtext/StoryblokRichText";

const { StoryblokRichText } = defineStoryblokComponents({ components: {} });

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
  });

  // ─── Root StoryblokRichText — blok nodes (finding #5) ─────────────────────

  describe("root StoryblokRichText — blok node handling", () => {
    const blokDoc = {
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
      const { container } = render(<RootStoryblokRichText document={blokDoc as any} />);
      expect(container.textContent).toBe("");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"blok"'));
      warnSpy.mockRestore();
    });

    it("does NOT warn when a blok component is provided via the components prop", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <RootStoryblokRichText
          document={blokDoc as any}
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
      const doc = {
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
          document={doc as any}
          data={{ locale: "de-AT" }}
          components={{ paragraph: Paragraph }}
        />,
      );

      expect(receivedData).toHaveLength(1);
      expect(receivedData[0]).toEqual({ locale: "de-AT" });
    });
  });
});
