// program.test.ts
import { beforeAll, describe, expect, it } from 'vitest';

// Import the function after setting up mocks
import { getProgram } from './program'; // Import resolve to mock
import type { Command } from 'commander';

let program: Command;
describe('program', () => {
  beforeAll(() => {
    program = getProgram();
  });
  it('should be defined', () => {
    // Reset the program instance and mock return values before each test
    expect(program).toBeDefined();
  });

  it('should have the same name as package.json', () => {
    expect(program.name()).toBe('storyblok');
  });

  it('should have the same description as package.json', () => {
    expect(program.description()).toBe('Storyblok CLI');
  });

  // TODO:
  // Add test for handlingError L30-32
});
