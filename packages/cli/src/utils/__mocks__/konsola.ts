import { vi } from 'vitest';

export const konsola = {
  ok: vi.fn(),
  title: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  br: vi.fn(),
  info: vi.fn(),
};
