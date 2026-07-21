'use client';

// REAL — the React context shared by theme-provider and theme-consumer.
// Kept in its own module so both client bloks import the same context object.
import { createContext } from 'react';

export const ThemeContext = createContext<string | null>(null);
