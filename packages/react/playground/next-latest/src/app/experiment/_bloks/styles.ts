// REAL — shared presentational styles.
// Legend: blue = server, orange = client, purple = client context,
// green = async server, red dashed = error/unknown.
import type { CSSProperties } from 'react';

export const serverBox: CSSProperties = {
  padding: 12, margin: '8px 0', border: '1px solid #2563eb',
  borderRadius: 6, background: '#eef4ff',
};
export const clientBox: CSSProperties = {
  padding: 12, margin: '8px 0', border: '1px solid #d97706',
  borderRadius: 6, background: '#fff7ed',
};
export const contextBox: CSSProperties = {
  padding: 12, margin: '8px 0', border: '1px solid #7c3aed',
  borderRadius: 6, background: '#f5f3ff',
};
export const asyncBox: CSSProperties = {
  padding: 12, margin: '8px 0', border: '1px solid #059669',
  borderRadius: 6, background: '#ecfdf5',
};
export const errorBox: CSSProperties = {
  padding: 12, margin: '8px 0', border: '1px dashed #b91c1c',
  borderRadius: 6, background: '#fef2f2', color: '#7f1d1d',
};

export const serverTag: CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: '#1e3a8a' };
export const clientTag: CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: '#92400e' };
export const contextTag: CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: '#5b21b6' };
export const asyncTag: CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: '#065f46' };
export const errorTag: CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: '#7f1d1d' };
