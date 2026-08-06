// REAL — Dipankar's SDK types, inlined verbatim.
// Source: https://github.com/dipankarmaikap/storyblok-react-sdk/blob/main/packages/react/src/types.ts

interface ISbComponentType<T extends string> {
  _uid?: string;
  component?: T;
  _editable?: string;
}

type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}

// Local shape for the stub bridge / client response. The real client returns
// a CAPI `Story` from `@storyblok/api-client`; this is the subset the
// playground actually uses.
export type Story = {
  id?: string | number;
  name: string;
  content: SbBlokData;
};
