import type { ReactElement } from 'react';
import React, { useMemo } from 'react';
import type { BlokProps } from './blok';
import { Blok } from './blok';
import type { BlokData } from './types';
import type { ISbStoryData } from '@storyblok/js';

export interface BloksProps<T extends BlokData> {
  fallback?: React.ComponentType<{ blok: T; story?: ISbStoryData }>;
  children: ReactElement<BlokProps<T>> | ReactElement<BlokProps<T>>[];
  blok: T;
  story?: ISbStoryData; // Add story data support
}

export const Bloks = <T extends BlokData>({
  fallback,
  children,
  story,
  ...props
}: BloksProps<T>) => {
  const components = useMemo(() => {
    const _components = {} as Record<T['component'], unknown>;
    // Collect components from children
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === Blok) {
        const { component, element, render } = child.props;
        if (element) {
          _components[component] = element;
        }
        else if (render) {
          _components[component] = render;
        }
      }
    });

    return _components;
  }, [children]);

  // Render function for a single blok
  const renderBlok = (blokToRender: T) => {
    const Component = components[blokToRender.component];

    if (Component) {
      // Pass both blok and story data to the component
      return React.createElement(Component, {
        blok: blokToRender,
        story, // Pass story data to components
        key: blokToRender._uid,
        ...props,
      });
    }

    if (fallback) {
      return React.createElement(fallback, {
        blok: blokToRender,
        story, // Pass story data to fallback
        key: blokToRender._uid,
        ...props,
      });
    }

    console.warn(
      `Component could not be found for blok "${blokToRender.component}"! Is it configured correctly?`,
    );

    return (
      <div key={blokToRender._uid}>
        <p>
          Component could not be found for blok "
          {blokToRender.component}
          "
        </p>
      </div>
    );
  };

  // Render the blok
  return renderBlok(props.blok);
};
