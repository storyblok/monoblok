import type { RichTextComponentProps } from './types';
import type { TiptapComponentName } from './types.generated';

export function resolveComponent<
  K extends TiptapComponentName,
  M extends Partial<Record<TiptapComponentName, (props: any) => any>>,
>(type: K, components?: M) {
  return components?.[type] as
    | ((props: RichTextComponentProps<K>) => any)
    | undefined;
}
