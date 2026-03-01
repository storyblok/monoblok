import type { MarkTypes } from '@storyblok/astro';

export type Resolver<Node = void> = (node: Node) => ComponentNode;

export interface ComponentNode {
  component?: unknown;
  props?: Record<string, unknown>;
  content?: string | ComponentNode[];
};

export type Schema = {
  [key in MarkTypes]?: Resolver;
} & {
  [key: string]: Resolver;
};
