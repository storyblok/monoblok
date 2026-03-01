import React from 'react';

interface HtmlRendererProps {
  html: string;
}

/**
 * Convert an HTML string to React elements.
 * Preserves nested tags and converts style/class attributes for JSX.
 */
export const HtmlRenderer: React.FC<HtmlRendererProps> = ({ html }) => {
  if (!html) return null;

  // Convert CSS style string to React style object
  const parseStyle = (styleString: string): React.CSSProperties => {
    return styleString.split(';').reduce((acc, rule) => {
      const [key, value] = rule.split(':').map(s => s.trim());
      if (key && value) {
        const camelKey = key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        acc[camelKey as keyof React.CSSProperties] = value;
      }
      return acc;
    }, {} as React.CSSProperties);
  };

  const convertNode = (node: ChildNode, parentKey = ''): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as HTMLElement;
    const key = parentKey || Math.random().toString(36).substr(2, 9);

    const props: Record<string, any> = { key };

    Array.from(el.attributes).forEach(attr => {
      if (attr.name === 'class') {
        props.className = attr.value;
      } else if (attr.name === 'style') {
        props.style = parseStyle(attr.value);
      } else {
        props[attr.name] = attr.value;
      }
    });

    const children = Array.from(el.childNodes).map((child, i) =>
      convertNode(child, `${key}-${i}`)
    );

    return React.createElement(el.tagName.toLowerCase(), props, children.length ? children : null);
  };

  // Parse HTML string using DOMParser (SSR-compatible alternative could use jsdom)
  const template = typeof document !== 'undefined'
    ? document.createElement('template')
    : null;

  if (!template) return <>{html}</>; // fallback for SSR (you could integrate jsdom)

  template.innerHTML = html;

  return (
    <>
      {Array.from(template.content.childNodes).map((child, i) =>
        convertNode(child, `root-${i}`)
      )}
    </>
  );
};
