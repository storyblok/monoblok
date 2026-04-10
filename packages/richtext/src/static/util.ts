import { MARK_RENDER_MAP, NODE_RENDER_MAP } from './render-map.generated';
import type { RichTextComponentProps } from './types';
import type { PMMark, PMNode, TiptapComponentName } from './types.generated';
import { SELF_CLOSING_TAGS } from '../utils';

export function resolveComponent<
  K extends TiptapComponentName,
  M extends Partial<Record<TiptapComponentName, (props: any) => any>>,
>(type: K, components?: M) {
  return components?.[type] as
    | ((props: RichTextComponentProps<K>) => any)
    | undefined;
}

export function resolveTag(node: PMNode | PMMark): string {
  const type = node.type as string;

  const entry
    = NODE_RENDER_MAP[type as keyof typeof NODE_RENDER_MAP]
      ?? MARK_RENDER_MAP[type as keyof typeof MARK_RENDER_MAP];

  if (!entry) {
    return 'span';
  }

  if ('resolve' in entry && typeof entry.resolve === 'function') {
    return entry.resolve(node.attrs as Parameters<typeof entry.resolve>[0]);
  }

  if ('tag' in entry && typeof entry.tag === 'string') {
    return entry.tag;
  }

  return 'span';
}
export function isSelfClosing(tag: string): boolean {
  return SELF_CLOSING_TAGS.includes(tag);
}
