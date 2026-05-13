import { StoryblokRichText } from '@storyblok/react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures } from '@storyblok/richtext/test-utils';

const getAttributes = (el: Element) => {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
};

const compare = (a: Node, b: Node): boolean => {
  // Text nodes
  if (a.nodeType === Node.TEXT_NODE && b.nodeType === Node.TEXT_NODE) {
    return a.textContent === b.textContent;
  }

  if (a instanceof Element && b instanceof Element) {
    if (a.tagName !== b.tagName) {
      return false;
    }

    const aAttrs = getAttributes(a);
    const bAttrs = getAttributes(b);
    const aKeys = Object.keys(aAttrs);
    const bKeys = Object.keys(bAttrs);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    for (const key of aKeys) {
      if (aAttrs[key] !== bAttrs[key]) {
        return false;
      }
    }

    const aChildren = Array.from(a.childNodes);
    const bChildren = Array.from(b.childNodes);

    if (aChildren.length !== bChildren.length) {
      return false;
    }

    for (let i = 0; i < aChildren.length; i++) {
      if (!compare(aChildren[i], bChildren[i])) {
        return false;
      }
    }

    return true;
  }

  return false;
};

export const expectHtmlEqual = (actual: string, expected: string) => {
  const parse = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstElementChild!;
  };

  const a = parse(actual);
  const e = parse(expected);

  expect(compare(a, e)).toBe(true);
};
describe('richtext', () => {
  // ============================================================================
  // Tests: Node Types
  // ============================================================================

  describe('nodes', () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expectHtmlEqual(container.innerHTML, `<div>${expected}</div>`);
      });
    });
  });
  describe('marks', () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expectHtmlEqual(container.innerHTML, `<div>${expected}</div>`);
      });
    });
  });
  describe('links', () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expectHtmlEqual(container.innerHTML, `<div>${expected}</div>`);
      });
    });
  });
  describe('tables', () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expectHtmlEqual(container.innerHTML, `<div>${expected}</div>`);
      });
    });
  });
  describe('integration', () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const { container } = render(<StoryblokRichText document={input} />);
        expectHtmlEqual(container.innerHTML, `<div>${expected}</div>`);
      });
    });
  });
});
