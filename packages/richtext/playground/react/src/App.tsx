import { BlockTypes, richTextResolver, type StoryblokRichTextNode, type StoryblokRichTextOptions } from '@storyblok/richtext';
import { useStoryblok } from '@storyblok/react';
import './App.css';
import type { ReactElement } from 'react';
import React from 'react';

function camelCase(str: string) {
  return str.replace(/-([a-z])/g, g => g[1].toUpperCase());
}

function convertStyleStringToObject(styleString: string) {
  return styleString.split(';').reduce((styleObject: { [key: string]: string }, styleProperty) => {
    let [key, value] = styleProperty.split(':');
    key = key?.trim();
    value = value?.trim();
    if (key && value) {
      styleObject[camelCase(key)] = value;
    }
    return styleObject;
  }, {});
}

/**
 * Recursively converts HTML attributes in a React element tree to their JSX property names.
 *
 * @param {React.ReactElement} element The React element to process.
 * @return {React.ReactElement} A new React element with converted attributes.
 */
export function convertAttributesInElement(element: React.ReactElement | React.ReactElement[]): React.ReactElement | React.ReactElement[] {
  if (Array.isArray(element)) {
    return element.map(el => convertAttributesInElement(el)) as React.ReactElement[];
  }

  // Base case: if the element is not a React element, return it unchanged.
  if (!React.isValidElement(element)) {
    return element;
  }

  // Convert attributes of the current element.
  const attributeMap: { [key: string]: string } = {
    class: 'className',
    for: 'htmlFor',
    targetAttr: 'targetattr',
    // Add more attribute conversions here as needed
  };

  const newProps: { [key: string]: unknown } = Object.keys((element.props as Record<string, unknown>)).reduce((acc: { [key: string]: unknown }, key) => {
    let value = (element.props as Record<string, unknown>)[key];

    if (key === 'style' && typeof value === 'string') {
      value = convertStyleStringToObject(value);
    }

    const mappedKey = attributeMap[key] || key;
    acc[mappedKey] = value;
    return acc;
  }, {});

  newProps.key = (element.key as string);

  // Process children recursively.
  const children = React.Children.map((element.props as React.PropsWithChildren).children, child => convertAttributesInElement(child));
  const newElement = React.createElement(element.type, newProps, children);
  // Clone the element with the new properties and updated children.
  return newElement;
}

/* const doc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello, world!' }],
    },
  ],
}; */

function App() {
  const story = useStoryblok('home', { version: 'draft' });

  if (!story?.content) {
    return <div>Loading...</div>;
  }

  const options: StoryblokRichTextOptions<ReactElement> = {
    renderFn: React.createElement,
    textFn: (text: string, attrs?: Record<string, any>) => React.createElement(React.Fragment, attrs, text),
    keyedResolvers: true,
    resolvers: {
      [BlockTypes.LIST_ITEM]: (node: StoryblokRichTextNode<ReactElement>, ctx: StoryblokRichTextContext<ReactElement>) => {
        return ctx.render('li', {}, node?.children[0]?.props.children);
      },
    },
  };

  const html = richTextResolver<ReactElement>(
    options,
  ).render(story.content.richtext);

  const formattedHtml = convertAttributesInElement(html);

  return (
    <>
      {formattedHtml}
    </>
  );
}

export default App;
