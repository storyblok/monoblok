import { describe, expect, it } from 'vitest';
import { resolveScopeBaseDir, type Scope } from './scope';

describe('resolveScopeBaseDir', () => {
  it('returns the space subtree for a space scope', () => {
    const scope: Scope = { kind: 'space', spaceId: '12345' };
    expect(resolveScopeBaseDir(scope, undefined).replace(/\\/g, '/')).toContain('assets/12345');
  });

  it('returns a subtree for a non-numeric source directory (e.g. seed staging)', () => {
    const scope: Scope = { kind: 'space', spaceId: 'qa-seed' };
    expect(resolveScopeBaseDir(scope, undefined).replace(/\\/g, '/')).toContain('assets/qa-seed');
  });

  it('returns the shared/<libraryId> subtree for a library scope', () => {
    const scope: Scope = { kind: 'library', libraryId: 7 };
    expect(resolveScopeBaseDir(scope, undefined).replace(/\\/g, '/')).toContain('assets/shared/7');
  });
});
