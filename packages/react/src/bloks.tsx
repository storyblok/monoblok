import type { ReactElement } from 'react';
import React, { useMemo } from 'react';
import type { BlokProps } from './blok';
import { Blok } from './blok';
import type { BlokData } from './types';

export interface BloksProps<T extends BlokData> {
  fallback?: React.ComponentType<{ blok: T }>;
  children: ReactElement<BlokProps<T>> | ReactElement<BlokProps<T>>[];
  blok: T;
}

export const Bloks = <T extends BlokData>({
  fallback,
  children,
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
      return React.createElement(Component, {
        blok: blokToRender,
        key: blokToRender._uid,
      });
    }

    if (fallback) {
      return React.createElement(fallback, {
        blok: blokToRender,
        key: blokToRender._uid,
      });
    }

    console.warn(`Component could not be found for blok "${blokToRender.component}"! Is it configured correctly?`);

    return (
      <div key={blokToRender._uid}>
        <p>
          Component could not be found for blok
          {' '}
          <strong>{blokToRender.component}</strong>
          !
          Is it configured correctly?
        </p>
      </div>
    );
  };

  // Render the blok
  return renderBlok(props.blok);
};
