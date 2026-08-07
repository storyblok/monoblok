/// <reference types="vite/client" />

// Vite supports combining query suffixes; `?url&raw` is not covered by the
// built-in `vite/client` declarations, so declare it explicitly.
declare module '*?url&raw' {
  const src: string;
  export default src;
}
