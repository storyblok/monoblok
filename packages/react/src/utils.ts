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

  // Convert attributes of the current element.
  const attributeMap: { [key: string]: string } = {
    allowfullscreen: 'allowFullScreen',
    autocomplete: 'autoComplete',
    autofocus: 'autoFocus',
    autoplay: 'autoPlay',
    charset: 'charSet',
    class: 'className',
    colspan: 'colSpan',
    colwidth: 'colWidth',
    contenteditable: 'contentEditable',
    crossorigin: 'crossOrigin',
    enctype: 'encType',
    for: 'htmlFor',
    formnovalidate: 'formNoValidate',
    frameborder: 'frameBorder',
    inputmode: 'inputMode',
    marginheight: 'marginHeight',
    marginwidth: 'marginWidth',
    maxlength: 'maxLength',
    minlength: 'minLength',
    novalidate: 'noValidate',
    playsinline: 'playsInline',
    readonly: 'readOnly',
    referrerpolicy: 'referrerPolicy',
    rowspan: 'rowSpan',
    srcset: 'srcSet',
    tabindex: 'tabIndex',
    targetAttr: 'targetattr',
    usemap: 'useMap',
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
  const children = React.Children.map((element.props as React.PropsWithChildren).children, (child) => {
    if (typeof child === 'string') {
      return child;
    }
    return convertAttributesInElement(child as React.ReactElement);
  });

  const newElement = React.createElement(element.type, newProps, children);
  // Clone the element with the new properties and updated children.
  return newElement;
}

// Environment detection utilities
export const isBrowser = () => typeof window !== 'undefined';
export const isServer = () => typeof window === 'undefined';

// Storyblok bridge detection utilities
export const isBridgeLoaded = () => isBrowser() && typeof window.storyblokRegisterEvent !== 'undefined';
export const isIframe = () => isBrowser() && window.self !== window.top;

/**
 * Detects if the current page is running inside Storyblok's Visual Editor.
 * Requires the page to be in an iframe context with the _storyblok URL parameter.
 * This is more reliable than just checking for the URL parameter alone.
 */
export const isVisualEditor = () => isBrowser() && isIframe() && window.location.search.includes('_storyblok');
