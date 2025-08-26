import type { ReactElement } from 'react';
import React from 'react';
import type { BlokData } from './types';

export interface BlokProps<T extends BlokData> {
  component: T['component'];
  element?: React.ComponentType<{ blok: T }>;
  render?: ({ blok }: { blok: T }) => ReactElement;
  children?: ({ blok }: { blok: T }) => ReactElement;
  blok?: T;
}

type BlokOrNever<T extends BlokData, C> = C extends T['component']
  ? Extract<T, { component: C }>
  : never;

// Helper interface for component-specific props
export interface BlokPropsForComponent<T extends BlokData, C extends T['component']> {
  component: C;
  element?: React.ComponentType<{ blok: BlokOrNever<T, C> }>;
  render?: ({ blok }: { blok: BlokOrNever<T, C> }) => ReactElement;
  children?: ({ blok }: { blok: BlokOrNever<T, C> }) => ReactElement;
  blok?: BlokOrNever<T, C>;
}

// Type that becomes never when component doesn't exist
export type BlokPropsForComponentOrNever<T extends BlokData, C extends T['component']> = C extends T['component'] ? BlokPropsForComponent<T, C> : never;

// Function overloads for proper type narrowing
export function Blok<T extends BlokData, C extends T['component']>(
  props: BlokPropsForComponent<T, C>
): ReactElement | null;

// Overload for invalid component names
export function Blok<T extends BlokData, C extends string>(
  props: C extends T['component'] ? BlokPropsForComponent<T, C> : never
): ReactElement | null;

export function Blok<T extends BlokData>({
  component: _component,
  element,
  render,
  children,
  blok,
}: BlokProps<T>): ReactElement | null {
  // This component is primarily used for registration within Bloks
  // When used standalone with blok prop, it renders the component

  if (blok && (element || render || children)) {
    const renderFn = render || children;

    if (element) {
      return React.createElement(element, { blok });
    }

    if (renderFn) {
      return renderFn({ blok });
    }
  }

  // For registration purposes only, return null
  return null;
}
