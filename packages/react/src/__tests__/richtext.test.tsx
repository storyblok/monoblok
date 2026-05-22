import type { SbReactComponentMap, SbRichTextNode } from '@storyblok/react';
import { StoryblokRichText } from '@storyblok/react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { customRendererFixture, integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures, text } from '@storyblok/richtext/test-utils';
import CustomHeading from './richtext/CustomHeading';
import CustomLink from './richtext/CustomLink';
import CustomCodeBlock from './richtext/CodeComponent';

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
  attribute = 'src',
  rules: AttributePositionRule[] = [],
): string {
  const div = document.createElement('div');

  div.innerHTML = html.trim();

  const images = div.querySelectorAll('img');

  for (const [_, img] of images.entries()) {
    const matchedRule = rules.find(rule =>
      img.hasAttribute(rule.key),
    );

    if (!matchedRule) {
      continue;
    }

    if (!img.hasAttribute(attribute)) {
      continue;
    }

    const attrs = Array.from(img.attributes).map(attr => [
      attr.name,
      attr.value,
    ] as const);

    const target = attrs.find(([name]) => name === attribute);

    if (!target) {
      continue;
    }

    const filtered = attrs.filter(
      ([name]) => name !== attribute,
    );

    const insertIndex = Math.min(
      Math.max(matchedRule.position, 0),
      filtered.length,
    );

    filtered.splice(insertIndex, 0, target);

    const attrString = filtered
      .map(([name, value]) => `${name}="${value}"`)
      .join(' ');

    const htmlString = `<img ${attrString}>`;

    const temp = document.createElement('div');

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
  return moveImgAttribute(html, 'src', [
    {
      key: 'id',
      position: 1, // 2nd attribute
    },
    {
      key: 'data-emoji',
      position: 2, // 3rd attribute
    },
  ]);
}

describe('react StoryblokRichText component', () => {
  describe('input handling', () => {
    it('returns empty string for null input', () => {
      const { container } = render(<StoryblokRichText document={null} />);
      expect(container.innerHTML).toBe(`<div></div>`);
    });
    it('returns empty string for undefined input', () => {
      const { container } = render(<StoryblokRichText document={undefined} />);
      expect(container.innerHTML).toBe(`<div></div>`);
    });
    it('returns empty string for empty array', () => {
      const { container } = render(<StoryblokRichText document={[]} />);
      expect(container.innerHTML).toBe(`<div></div>`);
    });
  });
  describe('nodes', () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(`<div>${expected}</div>`);
      });
    });
  });
  describe('marks', () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(`<div>${expected}</div>`);
      });
    });
  });
  describe('links', () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(`<div>${expected}</div>`);
      });
    });
  });
  describe('tables', () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(`<div>${expected}</div>`);
      });
    });
  });
  describe('integration', () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expect(alignImageSrcAttribute(container.innerHTML)).toBe(`<div>${expected}</div>`);
      });
    });
  });
  describe('custom components', () => {
    it(customRendererFixture.title, () => {
      const options: SbReactComponentMap = {
        heading: CustomHeading,
        link: CustomLink,
        bold: ({ children }) => <b data-type="custom-bold">{children}</b>,
      };
      const { container } = render(<StoryblokRichText document={customRendererFixture.input} components={options} />);
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(`<div>${customRendererFixture.expected}</div>`);
    });
    it('supports recursive StoryblokRichText in custom renderers', () => {
      const options: SbReactComponentMap = {
        heading: ({ content }) => <h1 data-type="custom-heading"><StoryblokRichText document={content} components={options} /></h1>,
        bold: ({ children }) => <b data-type="custom-bold">{children}</b>,
      };
      const document: SbRichTextNode[] = [{
        type: 'heading',
        attrs: { level: 1, textAlign: null },
        content: [text('Title', [{ type: 'bold' }])],
      }, {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [text('Hello Storyblok', [{ type: 'bold' }])],
      }];
      const { container } = render(<StoryblokRichText document={document} components={options} />);

      expect(alignImageSrcAttribute(container.innerHTML)).toBe(
        '<div><h1 data-type="custom-heading"><div><b data-type="custom-bold">Title</b></div></h1><p style="text-align: center;"><b data-type="custom-bold">Hello Storyblok</b></p></div>',
      );
    });
    it('allows custom code_block renderer to control attribute placement', () => {
      const options: SbReactComponentMap = {
        code_block: CustomCodeBlock,
      };
      const codeBlock: SbRichTextNode = {
        type: 'code_block',
        attrs: { class: 'typescript' },
        content: [text('const x: number = 1;')],
      };
      const { container } = render(<StoryblokRichText document={codeBlock} components={options} />);
      expect(alignImageSrcAttribute(container.innerHTML)).toBe(
        '<div><pre class="language-typescript"><code data-lang="typescript">const x: number = 1;</code></pre></div>',
      );
    });
  });
});
