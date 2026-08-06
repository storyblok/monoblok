// REAL — fallback component for unregistered bloks. Registered via
// ResolverConfig.fallback. Same pattern as Dipankar's FallbackBlock.
import type { SbBlokData } from '../_sdk/types';
import { errorBox, errorTag } from './styles';

export function Fallback({ blok }: { blok: SbBlokData }) {
  return (
    <div style={errorBox}>
      <div style={errorTag}>[fallback]</div>
      <div style={{ marginTop: 6 }}>
        Component not registered for{' '}
        <code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>
          {blok.component}
        </code>
      </div>
    </div>
  );
}
