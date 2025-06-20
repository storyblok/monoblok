import { handleError } from './error';
import { describe, expect, it, vi } from 'vitest';

describe('error handling', () => {
  it('should prompt an error message', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    handleError(new Error('This is an error'));
    expect(consoleSpy).toBeCalled();
  });
});
