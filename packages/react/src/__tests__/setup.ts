import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the browser environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'self', {
  value: window,
  writable: true,
});

Object.defineProperty(window, 'top', {
  value: window,
  writable: true,
});

// Mock console methods to reduce noise in tests
globalThis.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};
