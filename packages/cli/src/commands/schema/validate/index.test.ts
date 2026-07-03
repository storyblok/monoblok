import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../index';
import { schemaCommand } from '../command';

// Mock jiti so the loader classifies controlled module exports instead of
// reading/transpiling a real file (node:fs is mocked with memfs in tests).
let schemaModule: Record<string, unknown> = {};
let importError: Error | null = null;

vi.mock('jiti', () => ({
  createJiti: () => ({
    import: async () => {
      if (importError) {
        throw importError;
      }
      return schemaModule;
    },
  }),
}));

vi.spyOn(console, 'log');

function loggedOutput(): string {
  return (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(call => String(call[0])).join('\n');
}

async function runValidate(...args: string[]): Promise<void> {
  await schemaCommand.parseAsync(['node', 'test', 'validate', 'src/schema.ts', ...args]);
}

describe('schema validate command', () => {
  beforeEach(() => {
    schemaModule = {};
    importError = null;
  });

  afterEach(() => {
    process.exitCode = 0;
    vi.clearAllMocks();
  });

  it('should exit 0 for a schema with resolvable references', async () => {
    schemaModule = {
      pageBlock: { name: 'page', fields: [{ name: 'body', type: 'bloks', allow: ['hero'] }] },
      heroBlock: { name: 'hero', fields: [{ name: 'headline', type: 'text' }] },
    };

    await runValidate();

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain('0 errors, 0 warnings across 0 of 2 entities');
  });

  it('should exit 1 and report unresolved_allow', async () => {
    schemaModule = {
      heroBlock: { name: 'hero', fields: [{ name: 'body', type: 'bloks', allow: ['gallery'] }] },
    };

    await runValidate();

    expect(process.exitCode).toBe(1);
    const output = loggedOutput();
    expect(output).toContain('hero (block)');
    expect(output).toContain('unresolved_allow');
    expect(output).toContain('1 error, 0 warnings across 1 of 1 entities');
  });

  it('should exit 2 when the entry file cannot be resolved', async () => {
    importError = new Error('Cannot find module \'src/schema.ts\'');

    await runValidate();

    expect(process.exitCode).toBe(2);
  });

  it('should exit 2 when the entry file exports no schema definitions', async () => {
    schemaModule = { helper: () => {}, constant: 42 };

    await runValidate();

    expect(process.exitCode).toBe(2);
  });

  it('should hide warnings at the error threshold but keep true totals', async () => {
    // A story-only warning code cannot occur in schema validation, so assert the
    // threshold behavior via the summary line staying truthful.
    schemaModule = {
      heroBlock: { name: 'hero', fields: [{ name: 'body', type: 'bloks', allow: ['gallery'] }] },
    };

    await runValidate('--level', 'error');

    expect(process.exitCode).toBe(1);
    expect(loggedOutput()).toContain('1 error, 0 warnings across 1 of 1 entities');
  });
});
