import type { MarkSpec, NodeSpec } from "prosemirror-model";
import type { RichTextMark, RichTextNode } from "../generated/overlay/types.gen";

type Extension = RichTextNode | RichTextMark;
export type ExtensionKey = Extension["type"];
type ExtensionAttrMap = {
  [E in Extension as E["type"]]: E extends { attrs: infer A }
    ? A
    : E extends { attrs?: infer A }
      ? A
      : undefined;
};

export type ExtensionAttrs<K extends ExtensionKey> = ExtensionAttrMap[K];
/** Conditional typing for Node vs Mark */

type NodeKey = RichTextNode["type"];
type MarkKey = RichTextMark["type"];

type ParseHTMLReturn<T extends ExtensionKey> = T extends NodeKey
  ? NonNullable<NodeSpec["parseDOM"]>
  : T extends MarkKey
    ? NonNullable<MarkSpec["parseDOM"]>
    : never;

/** Extension Options */
export interface ExtensionOptions<K extends ExtensionKey> {
  parseHTML?: () => ParseHTMLReturn<K> | undefined;

  attributeParsers?: Partial<{
    [P in keyof ExtensionAttrs<K>]: (el: HTMLElement) => ExtensionAttrs<K>[P] | null | undefined;
  }>;
}
