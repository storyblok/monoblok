'use client';

// REAL — client leaf that reads the theme context provided higher up, across an
// intervening server blok.
import { useContext } from 'react';
import type { BlokProps } from '../_sdk/types';
import { ThemeContext } from './theme-context';
import { contextBox, contextTag } from './styles';

export function ThemeConsumer(_props: BlokProps) {
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
