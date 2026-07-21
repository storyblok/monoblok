'use client';

// REAL — client leaf reading the theme context through an intervening server
// blok. Tests context propagation across the server boundary.
import { useContext } from 'react';
import { ThemeContext } from './theme-context';
import { contextBox, contextTag } from './styles';

export function ThemeConsumer() {
  const theme = useContext(ThemeContext);
  return (
    <div style={contextBox}>
      <div style={contextTag}>[theme-consumer] (client, reads context)</div>
      <div style={{ marginTop: 6, color: '#111827' }} data-testid="theme-value">
        theme from context: <strong>{theme ?? '(no context)'}</strong>
      </div>
    </div>
  );
}
