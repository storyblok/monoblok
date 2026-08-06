// REAL — the recursive resolver. Walks a nested story top-down in a single
// server render pass: looks up `blok.component` in the registry and renders
// `<Component blok={blok}>{children}</Component>`, where `children` is the
// pre-rendered nested `body`.
//
// Pre-rendering `body` on the server and handing it down as `children` is what
// lets server and client bloks nest arbitrarily: a client blok always receives
// already-rendered server children (the only legal server-in-client direction),
// composing to any depth. The `components` map is threaded explicitly — no
// module globals (React context is not readable from server components anyway).
import type { ComponentsMap, SbBlok } from './types';

const unknownBox: React.CSSProperties = {
  padding: 12,
  border: '1px dashed #b91c1c',
  borderRadius: 6,
  color: '#7f1d1d',
  fontFamily: 'monospace',
  fontSize: 12,
};

export function StoryblokServerComponent({
  blok,
  components,
}: {
  blok: SbBlok;
  components: ComponentsMap;
}) {
  const Component = components[blok.component];

  if (!Component) {
    return <div style={unknownBox}>[unknown blok: {blok.component}]</div>;
  }

  const body = Array.isArray(blok.body) ? (blok.body as SbBlok[]) : [];
  const children = body.length
    ? body.map((child) => (
        <StoryblokServerComponent
          key={child._uid}
          blok={child}
          components={components}
        />
      ))
    : undefined;

  return <Component blok={blok}>{children}</Component>;
}
