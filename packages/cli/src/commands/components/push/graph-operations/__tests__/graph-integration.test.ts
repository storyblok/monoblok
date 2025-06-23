import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDependencyGraph, determineProcessingOrder, validateGraph } from '../dependency-graph';
import { processAllResources } from '../resource-processor';
import type { SpaceDataState } from '../../../constants';

// Mock the API functions
vi.mock('../../actions', () => ({
  upsertComponent: vi.fn(),
  upsertComponentGroup: vi.fn(),
  upsertComponentInternalTag: vi.fn(),
  upsertComponentPreset: vi.fn(),
  pushComponent: vi.fn(),
}));

// Mock progress display
vi.mock('../../progress-display', () => ({
  progressDisplay: {
    start: vi.fn(),
    handleEvent: vi.fn(),
  },
}));

describe('graph Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('source/Target Reconciliation', () => {
    it('should correctly reconcile resources with different IDs between source and target spaces', () => {
      // Scenario: Source space has resources with IDs 100-400, target space has same resources with IDs 500-800
      const spaceState: SpaceDataState = {
        local: {
          components: [{
            id: 300,
            name: 'shared-component',
            display_name: 'Shared Component',
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            schema: {},
            color: null,
            internal_tags_list: [],
            internal_tag_ids: ['100'], // References source tag ID
            component_group_uuid: 'shared-group-uuid', // References source group
          }],
          groups: [{
            id: 200,
            name: 'shared-group',
            uuid: 'shared-group-uuid',
            parent_id: null,
            parent_uuid: null,
          }],
          internalTags: [{
            id: 100,
            name: 'shared-tag',
            object_type: 'component' as const,
          }],
          presets: [{
            id: 400,
            name: 'shared-preset',
            preset: { title: 'Test Preset' },
            component_id: 300, // References source component ID
            space_id: 1,
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            image: '',
            color: '',
            icon: '',
            description: '',
          }],
        },
        target: {
          components: new Map([['shared-component', {
            id: 700,
            name: 'shared-component',
            display_name: 'Shared Component',
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            schema: {},
            color: null,
            internal_tags_list: [],
            internal_tag_ids: ['500'], // Different tag ID in target
            component_group_uuid: 'shared-group-uuid',
          }]]),
          groups: new Map([['shared-group', {
            id: 600,
            name: 'shared-group',
            uuid: 'shared-group-uuid',
            parent_id: null,
            parent_uuid: null,
          }]]),
          tags: new Map([['shared-tag', {
            id: 500,
            name: 'shared-tag',
            object_type: 'component' as const,
          }]]),
          presets: new Map([['shared-preset', {
            id: 800,
            name: 'shared-preset',
            preset: { title: 'Test Preset' },
            component_id: 700, // Different component ID in target
            space_id: 2,
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            image: '',
            color: '',
            icon: '',
            description: '',
          }]]),
        },
      };

      // Build the dependency graph
      const graph = buildDependencyGraph({ spaceState });

      // Validate the graph structure
      expect(graph.nodes.size).toBe(4); // tag, group, component, preset
      expect(graph.nodes.has('tag:100')).toBe(true);
      expect(graph.nodes.has('group:shared-group-uuid')).toBe(true);
      expect(graph.nodes.has('component:shared-component')).toBe(true);
      expect(graph.nodes.has('preset:shared-preset')).toBe(true);

      // Check dependencies are correctly established
      const componentNode = graph.nodes.get('component:shared-component')!;
      const presetNode = graph.nodes.get('preset:shared-preset')!;
      const tagNode = graph.nodes.get('tag:100')!;
      const groupNode = graph.nodes.get('group:shared-group-uuid')!;

      // Component should depend on tag and group
      expect(componentNode.dependencies.has('tag:100')).toBe(true);
      expect(componentNode.dependencies.has('group:shared-group-uuid')).toBe(true);

      // Preset should depend on component
      expect(presetNode.dependencies.has('component:shared-component')).toBe(true);

      // Check target data is correctly colocated
      expect(componentNode.targetData?.id).toBe(700);
      expect(tagNode.targetData?.id).toBe(500);
      expect(groupNode.targetData?.id).toBe(600);
      expect(presetNode.targetData?.id).toBe(800);
    });

    it('should handle hierarchical group dependencies correctly', () => {
      const spaceState: SpaceDataState = {
        local: {
          components: [],
          groups: [
            {
              id: 1,
              name: 'parent-group',
              uuid: 'parent-uuid',
              parent_id: null,
              parent_uuid: null,
            },
            {
              id: 2,
              name: 'child-group',
              uuid: 'child-uuid',
              parent_id: 1,
              parent_uuid: 'parent-uuid',
            },
            {
              id: 3,
              name: 'grandchild-group',
              uuid: 'grandchild-uuid',
              parent_id: 2,
              parent_uuid: 'child-uuid',
            },
          ],
          internalTags: [],
          presets: [],
        },
        target: {
          components: new Map(),
          groups: new Map([
            ['parent-group', { id: 10, name: 'parent-group', uuid: 'parent-uuid', parent_id: null, parent_uuid: null }],
            ['child-group', { id: 20, name: 'child-group', uuid: 'child-uuid', parent_id: 10, parent_uuid: 'parent-uuid' }],
            ['grandchild-group', { id: 30, name: 'grandchild-group', uuid: 'grandchild-uuid', parent_id: 20, parent_uuid: 'child-uuid' }],
          ]),
          tags: new Map(),
          presets: new Map(),
        },
      };

      const graph = buildDependencyGraph({ spaceState });
      const processingOrder = determineProcessingOrder(graph);

      // Parent should be processed before child, child before grandchild
      const parentLevel = processingOrder.findIndex(level => level.nodes.includes('group:parent-uuid'));
      const childLevel = processingOrder.findIndex(level => level.nodes.includes('group:child-uuid'));
      const grandchildLevel = processingOrder.findIndex(level => level.nodes.includes('group:grandchild-uuid'));

      expect(parentLevel).toBeLessThan(childLevel);
      expect(childLevel).toBeLessThan(grandchildLevel);
    });

    it('should resolve references correctly during processing', async () => {
      const { upsertComponent, upsertComponentGroup, upsertComponentInternalTag, upsertComponentPreset } = await import('../../actions');

      // Mock successful upserts with new target IDs
      (upsertComponentInternalTag as any).mockResolvedValue({ id: 1001, name: 'test-tag', object_type: 'component' });
      (upsertComponentGroup as any).mockResolvedValue({ id: 2001, name: 'test-group', uuid: 'test-group-uuid', parent_id: null, parent_uuid: null });
      (upsertComponent as any).mockResolvedValue({
        id: 3001,
        name: 'test-component',
        display_name: 'Test Component',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        schema: {},
        color: null,
        internal_tags_list: [],
        internal_tag_ids: ['1001'], // Should be resolved to new tag ID
        component_group_uuid: 'test-group-uuid',
      });
      (upsertComponentPreset as any).mockResolvedValue({
        id: 4001,
        name: 'test-preset',
        preset: { title: 'Test' },
        component_id: 3001, // Should be resolved to new component ID
        space_id: 1,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        image: '',
        color: '',
        icon: '',
        description: '',
      });

      const spaceState: SpaceDataState = {
        local: {
          components: [{
            id: 100,
            name: 'test-component',
            display_name: 'Test Component',
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            schema: {},
            color: null,
            internal_tags_list: [],
            internal_tag_ids: ['200'], // Source tag ID
            component_group_uuid: 'test-group-uuid',
          }],
          groups: [{
            id: 300,
            name: 'test-group',
            uuid: 'test-group-uuid',
            parent_id: null,
            parent_uuid: null,
          }],
          internalTags: [{
            id: 200,
            name: 'test-tag',
            object_type: 'component' as const,
          }],
          presets: [{
            id: 400,
            name: 'test-preset',
            preset: { title: 'Test' },
            component_id: 100, // Source component ID
            space_id: 1,
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            image: '',
            color: '',
            icon: '',
            description: '',
          }],
        },
        target: {
          components: new Map(),
          groups: new Map(),
          tags: new Map(),
          presets: new Map(),
        },
      };

      const graph = buildDependencyGraph({ spaceState });
      const results = await processAllResources(graph, 'test-space', 5, true);

      // All resources should be processed successfully
      expect(results.successful).toHaveLength(4);
      expect(results.failed).toHaveLength(0);

      // Verify that references were resolved correctly
      const componentCall = (upsertComponent as any).mock.calls[0];
      const componentData = componentCall[1];

      // Component should reference the resolved tag ID (1001) not the source ID (200)
      expect(componentData.internal_tag_ids).toEqual(['1001']);

      const presetCall = (upsertComponentPreset as any).mock.calls[0];
      const presetData = presetCall[1];

      // Preset should reference the resolved component ID (3001) not the source ID (100)
      expect(presetData.component_id).toBe(3001);
    });
  });

  describe('complex Schema Dependencies', () => {
    it('should resolve nested schema references correctly', async () => {
      const { upsertComponent, upsertComponentGroup, upsertComponentInternalTag } = await import('../../actions');

      // Mock successful upserts
      (upsertComponentInternalTag as any).mockResolvedValue({ id: 1001, name: 'schema-tag', object_type: 'component' });
      (upsertComponentGroup as any).mockResolvedValue({ id: 2001, name: 'schema-group', uuid: 'schema-group-uuid', parent_id: null, parent_uuid: null });
      (upsertComponent as any)
        .mockResolvedValueOnce({ id: 3001, name: 'base-component', display_name: 'Base', created_at: '2023-01-01T00:00:00.000Z', updated_at: '2023-01-01T00:00:00.000Z', schema: {}, color: null, internal_tags_list: [], internal_tag_ids: [] })
        .mockResolvedValueOnce({
          id: 3002,
          name: 'complex-component',
          display_name: 'Complex',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          schema: {
            content: {
              type: 'bloks',
              component_whitelist: ['base-component'],
              component_group_whitelist: ['schema-group-uuid'], // Should be resolved
              component_tag_whitelist: [1001], // Should be resolved
            },
          },
          color: null,
          internal_tags_list: [],
          internal_tag_ids: [],
        });

      const spaceState: SpaceDataState = {
        local: {
          components: [
            {
              id: 1,
              name: 'base-component',
              display_name: 'Base',
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              schema: {},
              color: null,
              internal_tags_list: [],
              internal_tag_ids: [],
            },
            {
              id: 2,
              name: 'complex-component',
              display_name: 'Complex',
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              schema: {
                content: {
                  type: 'bloks',
                  component_whitelist: ['base-component'],
                  component_group_whitelist: ['schema-group-uuid'],
                  component_tag_whitelist: [100], // Source tag ID
                },
              },
              color: null,
              internal_tags_list: [],
              internal_tag_ids: [],
            },
          ],
          groups: [{
            id: 200,
            name: 'schema-group',
            uuid: 'schema-group-uuid',
            parent_id: null,
            parent_uuid: null,
          }],
          internalTags: [{
            id: 100,
            name: 'schema-tag',
            object_type: 'component' as const,
          }],
          presets: [],
        },
        target: {
          components: new Map(),
          groups: new Map(),
          tags: new Map(),
          presets: new Map(),
        },
      };

      const graph = buildDependencyGraph({ spaceState });
      await processAllResources(graph, 'test-space', 5, true);

      // Verify that schema references were resolved
      const complexComponentCall = (upsertComponent as any).mock.calls.find(
        call => call[1].name === 'complex-component',
      );

      expect(complexComponentCall).toBeDefined();
      const schemaContent = complexComponentCall[1].schema.content;

      // Tag whitelist should be resolved to new tag ID
      expect(schemaContent.component_tag_whitelist).toEqual([1001]);

      // Group whitelist should remain as UUID (UUIDs don't change)
      expect(schemaContent.component_group_whitelist).toEqual(['schema-group-uuid']);
    });
  });

  describe('error Handling', () => {
    it('should handle missing dependencies gracefully', () => {
      const spaceState: SpaceDataState = {
        local: {
          components: [{
            id: 1,
            name: 'component-with-missing-deps',
            display_name: 'Component with Missing Deps',
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
            schema: {},
            color: null,
            internal_tags_list: [],
            internal_tag_ids: ['999'], // Non-existent tag
            component_group_uuid: 'non-existent-group-uuid',
          }],
          groups: [],
          internalTags: [],
          presets: [],
        },
        target: {
          components: new Map(),
          groups: new Map(),
          tags: new Map(),
          presets: new Map(),
        },
      };

      // Should not throw, but should handle missing dependencies
      expect(() => {
        const graph = buildDependencyGraph({ spaceState });
        validateGraph(graph);
      }).not.toThrow();
    });

    it('should detect circular dependencies', () => {
      const spaceState: SpaceDataState = {
        local: {
          components: [
            {
              id: 1,
              name: 'component-a',
              display_name: 'Component A',
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              schema: {
                content: {
                  type: 'bloks',
                  component_whitelist: ['component-b'],
                },
              },
              color: null,
              internal_tags_list: [],
              internal_tag_ids: [],
            },
            {
              id: 2,
              name: 'component-b',
              display_name: 'Component B',
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              schema: {
                content: {
                  type: 'bloks',
                  component_whitelist: ['component-a'], // Circular reference
                },
              },
              color: null,
              internal_tags_list: [],
              internal_tag_ids: [],
            },
          ],
          groups: [],
          internalTags: [],
          presets: [],
        },
        target: {
          components: new Map(),
          groups: new Map(),
          tags: new Map(),
          presets: new Map(),
        },
      };

      const graph = buildDependencyGraph({ spaceState });

      // Should detect the circular dependency but not throw (components can have circular refs)
      expect(() => validateGraph(graph)).not.toThrow();

      // Processing order should handle the circular dependency
      const processingOrder = determineProcessingOrder(graph);
      expect(processingOrder.length).toBeGreaterThan(0);
    });
  });
});
