// REAL — mirrors the planned @storyblok/react v2 public types.
// Shapes match the canonical Storyblok story/blok JSON (capi-client
// generated `BlokContent`: `_uid`, `component`, plus arbitrary fields).
import type { ComponentType, ReactNode } from 'react';

// A single content block. Nested blocks live in array fields (here: `body`).
export type SbBlok = {
  _uid: string;
  component: string;
  [field: string]: unknown;
};

// A story as delivered by the client. `content` is the root blok.
export type Story = {
  name: string;
  content: SbBlok;
};

// Every registered blok component receives its blok and any pre-rendered
// nested bloks as `children`.
export type BlokProps = {
  blok: SbBlok;
  children?: ReactNode;
};

// The registry: component name -> React component (server or client).
export type ComponentsMap = Record<string, ComponentType<BlokProps>>;
