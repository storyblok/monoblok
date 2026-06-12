import { describe, expect, it } from 'vitest';
import { type KeepEntry, transformGeneratedFile } from './transform.ts';

/** Collapse printer whitespace so assertions don't depend on TS pretty-print layout. */
function squish(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const NO_RENAMES: ReadonlyMap<string, string> = new Map();

function run(
  source: string,
  keep: readonly KeepEntry[],
  renameMap: ReadonlyMap<string, string> = NO_RENAMES,
): { output: string; emitted: readonly string[] } {
  return transformGeneratedFile(source, keep, renameMap);
}

describe('transformGeneratedFile', () => {
  it('should keep only declarations reachable from the requested roots', () => {
    const source = [
      'export type Story = { id: number; content: Content };',
      'export type Content = { title: string };',
      'export type Unused = { x: number };',
    ].join('\n');

    const { output, emitted } = run(
      source,
      [{ source: 'Story', emitAs: 'CapiStory' }],
      new Map([['Story', 'CapiStory']]),
    );

    expect(emitted).toContain('CapiStory');
    expect(emitted).toContain('Content');
    expect(emitted).not.toContain('Unused');
    expect(output).not.toContain('Unused');
  });

  it('should rename the root declaration to its emitAs', () => {
    const source = 'export type Story = { id: number };';

    const { output, emitted } = run(
      source,
      [{ source: 'Story', emitAs: 'CapiStory' }],
      new Map([['Story', 'CapiStory']]),
    );

    expect(squish(output)).toContain('export type CapiStory = { id: number; }');
    expect(output).not.toContain('export type Story ');
    expect(emitted).toEqual(['CapiStory']);
  });

  it('should rewrite references inside kept bodies via the rename map', () => {
    const source = [
      'export type Story = { content: Content };',
      'export type Content = { title: string };',
    ].join('\n');

    const { output } = run(
      source,
      [{ source: 'Story', emitAs: 'CapiStory' }],
      new Map([['Story', 'CapiStory'], ['Content', 'StoryContent']]),
    );

    expect(squish(output)).toContain('export type CapiStory = { content: StoryContent; }');
    expect(squish(output)).toContain('export type StoryContent = { title: string; }');
    expect(output).not.toContain(': Content ');
  });

  it('should unwrap a single envelope property', () => {
    const source = 'export type UpdateStoryRequest = { story: { name: string }; force_update?: boolean };';

    const { output } = run(
      source,
      [{ source: 'UpdateStoryRequest', emitAs: 'StoryCreate', unwrap: 'story' }],
    );

    expect(squish(output)).toContain('export type StoryCreate = { name: string; }');
    expect(output).not.toContain('force_update');
  });

  it('should unwrap a dotted envelope path', () => {
    const source = 'export type CreateAssetFolderData = { body: { asset_folder: { name: string } } };';

    const { output } = run(
      source,
      [{ source: 'CreateAssetFolderData', emitAs: 'AssetFolderCreate', unwrap: 'body.asset_folder' }],
    );

    expect(squish(output)).toContain('export type AssetFolderCreate = { name: string; }');
    expect(output).not.toContain('body');
  });

  it('should convert an interface to a type-literal alias', () => {
    const source = 'export interface Tag { name: string; }';

    const { output } = run(source, [{ source: 'Tag', emitAs: 'Tag' }]);

    expect(squish(output)).toContain('export type Tag = { name: string; }');
  });

  it('should convert an interface with extends to an intersection', () => {
    const source = [
      'export interface Base { id: number; }',
      'export interface Tag extends Base { name: string; }',
    ].join('\n');

    const { output } = run(
      source,
      [{ source: 'Base', emitAs: 'Base' }, { source: 'Tag', emitAs: 'Tag' }],
    );

    expect(squish(output)).toContain('export type Tag = Base & { name: string; }');
  });

  it('should reach a base type through extends when only the derived type is kept', () => {
    const source = [
      'export interface Base { id: number; }',
      'export interface Tag extends Base { name: string; }',
    ].join('\n');

    const { output, emitted } = run(source, [{ source: 'Tag', emitAs: 'Tag' }]);

    expect(emitted).toContain('Base');
    expect(squish(output)).toContain('export type Base = { id: number; }');
  });

  it('should emit secondary aliases of the same source as references to the primary', () => {
    const source = 'export type InternalTagRequest = { internal_tag: { name: string } };';

    const { output, emitted } = run(
      source,
      [
        { source: 'InternalTagRequest', emitAs: 'InternalTagCreate', unwrap: 'internal_tag' },
        { source: 'InternalTagRequest', emitAs: 'InternalTagUpdate', unwrap: 'internal_tag' },
      ],
    );

    expect(squish(output)).toContain('export type InternalTagCreate = { name: string; }');
    expect(output).toContain('export type InternalTagUpdate = InternalTagCreate;');
    expect(emitted).toEqual(['InternalTagCreate', 'InternalTagUpdate']);
  });

  it('should preserve leading comments on kept declarations', () => {
    const source = '/** A published story. */\nexport type Story = { id: number };';

    const { output } = run(
      source,
      [{ source: 'Story', emitAs: 'CapiStory' }],
      new Map([['Story', 'CapiStory']]),
    );

    expect(output).toContain('A published story.');
    expect(squish(output)).toContain('export type CapiStory = { id: number; }');
  });

  it('should prefix the output with the generated-file header', () => {
    const { output } = run('export type Story = { id: number };', [{ source: 'Story', emitAs: 'Story' }]);

    expect(output.startsWith('// Generated by @storyblok/openapi-codegen. Do not edit by hand.')).toBe(true);
  });

  it('should throw when a requested source is absent from the input', () => {
    const source = 'export type Story = { id: number };';

    expect(() => run(source, [{ source: 'Missing', emitAs: 'Missing' }]))
      .toThrow('Upstream type "Missing" not found');
  });

  it('should throw when an unwrap segment does not exist', () => {
    const source = 'export type UpdateStoryRequest = { story: { name: string } };';

    expect(() => run(source, [{ source: 'UpdateStoryRequest', emitAs: 'StoryCreate', unwrap: 'nope' }]))
      .toThrow('Cannot unwrap');
  });

  it('should produce byte-stable output for a representative slice (snapshot)', () => {
    const source = [
      '/** Update a story. */',
      'export type UpdateStoryRequest = { story: Story; force_update?: boolean };',
      'export type Story = { id: number; content: Content };',
      'export type Content = { title: string };',
      'export type Unused = { x: number };',
    ].join('\n');

    const { output } = run(
      source,
      [{ source: 'UpdateStoryRequest', emitAs: 'StoryUpdate', unwrap: 'story' }],
      new Map([['Story', 'MapiStory'], ['Content', 'StoryContent']]),
    );

    expect(output).toMatchInlineSnapshot(`
      "// Generated by @storyblok/openapi-codegen. Do not edit by hand.

      /** Update a story. */
      export type StoryUpdate = MapiStory;

      export type MapiStory = {
          id: number;
          content: StoryContent;
      };

      export type StoryContent = {
          title: string;
      };
      "
    `);
  });
});
