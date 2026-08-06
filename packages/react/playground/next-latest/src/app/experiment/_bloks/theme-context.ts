'use client';

// REAL — shared React context for theme-provider / theme-consumer.
import { createContext } from 'react';

export const ThemeContext = createContext<string | null>(null);
