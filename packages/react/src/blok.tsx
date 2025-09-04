import type { ReactElement } from 'react';
import React from 'react';
import type { BlokData } from './types';
import type { ISbStoryData } from '@storyblok/js';

export interface BlokProps<T extends BlokData> {
  component: T['component'];
  element?: React.ComponentType<{ blok: T; story?: ISbStoryData }>;
  render?: ({ blok, story }: { blok: T; story?: ISbStoryData }) => ReactElement;
  children?: ({
    blok,
    story,
  }: {
    blok: T;
    story?: ISbStoryData;
  }) => ReactElement;
  blok?: T;
  story?: ISbStoryData;
}

type BlokOrNever<T extends BlokData, C> = C extends T['component']
  ? Extract<T, { component: C }>
  : never;

// Helper interface for component-specific props
export interface BlokPropsForComponent<
  T extends BlokData,
  C extends T['component'],
> {
  component: C;
  element?: React.ComponentType<{
    blok: BlokOrNever<T, C>;
    story?: ISbStoryData;
  }>;
  render?: ({
    blok,
    story,
  }: {
    blok: BlokOrNever<T, C>;
    story?: ISbStoryData;
  }) => ReactElement;
  children?: ({
    blok,
    story,
  }: {
    blok: BlokOrNever<T, C>;
    story?: ISbStoryData;
  }) => ReactElement;
  blok?: BlokOrNever<T, C>;
  story?: ISbStoryData;
}

// Type that becomes never when component doesn't exist
export type BlokPropsForComponentOrNever<
  T extends BlokData,
  C extends T['component'],
> = C extends T['component'] ? BlokPropsForComponent<T, C> : never;

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
  story,
}: BlokProps<T>): ReactElement | null {
  // This component is primarily used for registration within Bloks
  // When used standalone with blok prop, it renders the component

  if (blok && (element || render || children)) {
    const renderFn = render || children;

    if (element) {
      return React.createElement(element, { blok, story });
    }

    if (renderFn) {
      return renderFn({ blok, story });
    }
  }

  // For registration purposes only, return null
  return null;
}
