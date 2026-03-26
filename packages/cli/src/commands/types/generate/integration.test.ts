import { beforeEach, describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import { readComponentsFiles } from '../../components/push/actions';
import { generateTypes } from './actions';
import type { SpaceComponent } from '../../components/constants';

const mockComponent1: SpaceComponent = {
  name: 'hero',
  display_name: 'Hero',
  created_at: '2025-10-10T12:12:18.056Z',
  updated_at: '2025-11-07T11:29:44.892Z',
  id: 1,
  schema: {
    title: {
      type: 'text',
      required: true,
    },
    subtitle: {
      type: 'textarea',
      required: false,
    },
  },
  is_root: true,
  is_nestable: false,
  internal_tags_list: [],
  internal_tag_ids: [],
};

const mockComponent2: SpaceComponent = {
  name: 'feature',
  display_name: 'Feature',
  created_at: '2025-10-09T06:29:14.630Z',
  updated_at: '2025-10-09T06:29:14.630Z',
  id: 2,
  schema: {
    name: {
      type: 'text',
    },
  },
  is_root: false,
  is_nestable: true,
  internal_tags_list: [],
  internal_tag_ids: [],
};

describe('types generate integration', () => {
  beforeEach(() => {
    vol.reset();
  });

  describe('reading components from separate files', () => {
    it('should read separate component files and generate types', async () => {
      vol.fromJSON({
        '/project/components/12345/hero.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.json': JSON.stringify([mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        separateFiles: true,
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);

      const result = await generateTypes(
        { ...componentsData, datasources: [] },
        { strict: false },
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('export interface Hero');
      expect(result).toContain('export interface Feature');
      expect(result).toContain('title: string');
    });

    it('should read separate component files with suffix and generate types', async () => {
      vol.fromJSON({
        '/project/components/12345/hero.dev.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.dev.json': JSON.stringify([mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        separateFiles: true,
        suffix: 'dev',
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);

      const result = await generateTypes(
        { ...componentsData, datasources: [] },
        { strict: false },
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('export interface Hero');
      expect(result).toContain('export interface Feature');
    });

    it('should fail when explicitly using consolidated mode on separate files', async () => {
      // Passing separateFiles: false explicitly should NOT auto-detect
      vol.fromJSON({
        '/project/components/12345/hero.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.json': JSON.stringify([mockComponent2]),
      });

      await expect(
        readComponentsFiles({
          from: '12345',
          path: '/project',
          separateFiles: false,
          verbose: false,
        }),
      ).rejects.toThrow('No components found');
    });
  });

  describe('auto-detecting input format', () => {
    it('should auto-detect separate files when components.json is absent', async () => {
      vol.fromJSON({
        '/project/components/12345/hero.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.json': JSON.stringify([mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        // separateFiles not specified - auto-detect
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);
    });

    it('should auto-detect consolidated mode when components.json exists', async () => {
      vol.fromJSON({
        '/project/components/12345/components.json': JSON.stringify([mockComponent1, mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        // separateFiles not specified - auto-detect
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);
    });

    it('should auto-detect separate files with suffix', async () => {
      vol.fromJSON({
        '/project/components/12345/hero.dev.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.dev.json': JSON.stringify([mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        suffix: 'dev',
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);
    });

    it('should generate a single type file from auto-detected separate component files (#530)', async () => {
      // This is the exact scenario from issue #530:
      // Components pulled with --sf (separate JSON files), but user wants single .d.ts output
      vol.fromJSON({
        '/project/components/12345/hero.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.json': JSON.stringify([mockComponent2]),
      });

      // Read without separateFiles - auto-detect picks separate files mode
      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);

      // Generate a single combined output (no separateFiles in options)
      const result = await generateTypes(
        { ...componentsData, datasources: [] },
        { strict: false },
      );

      // Should be a single string, not an array of files
      expect(typeof result).toBe('string');
      expect(result).toContain('export interface Hero');
      expect(result).toContain('export interface Feature');
    });
  });

  describe('reading components from consolidated file', () => {
    it('should read consolidated file and generate types', async () => {
      vol.fromJSON({
        '/project/components/12345/components.json': JSON.stringify([mockComponent1, mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        separateFiles: false,
        verbose: false,
      });

      expect(componentsData.components).toHaveLength(2);

      const result = await generateTypes(
        { ...componentsData, datasources: [] },
        { strict: false },
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('export interface Hero');
      expect(result).toContain('export interface Feature');
    });
  });

  describe('generating separate type files from separate component files', () => {
    it('should read separate component files and generate separate type files', async () => {
      vol.fromJSON({
        '/project/components/12345/hero.json': JSON.stringify([mockComponent1]),
        '/project/components/12345/feature.json': JSON.stringify([mockComponent2]),
      });

      const componentsData = await readComponentsFiles({
        from: '12345',
        path: '/project',
        separateFiles: true,
        verbose: false,
      });

      const result = await generateTypes(
        { ...componentsData, datasources: [] },
        { strict: false, separateFiles: true },
      );

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        const heroFile = result.find(f => f.name === 'Hero');
        const featureFile = result.find(f => f.name === 'Feature');

        expect(heroFile).toBeDefined();
        expect(heroFile!.content).toContain('export interface Hero');
        expect(heroFile!.content).toContain('title: string');

        expect(featureFile).toBeDefined();
        expect(featureFile!.content).toContain('export interface Feature');
      }
    });
  });
});
