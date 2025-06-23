import type {
  SpaceComponent,
  SpaceComponentGroup,
  SpaceComponentInternalTag,
  SpaceComponentPreset,
  SpaceDataState,
} from '../../../constants';

// =============================================================================
// TEST DATA BUILDERS
// =============================================================================

export function createTestTag(overrides: Partial<SpaceComponentInternalTag> = {}): SpaceComponentInternalTag {
  return {
    id: 1,
    name: 'test-tag',
    object_type: 'component',
    ...overrides,
  };
}

export function createTestGroup(overrides: Partial<SpaceComponentGroup> = {}): SpaceComponentGroup {
  return {
    id: 1,
    name: 'test-group',
    uuid: 'test-group-uuid',
    parent_id: null,
    parent_uuid: null,
    ...overrides,
  };
}

export function createTestComponent(overrides: Partial<SpaceComponent> = {}): SpaceComponent {
  return {
    id: 1,
    name: 'test-component',
    display_name: 'Test Component',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    schema: {},
    color: null,
    internal_tags_list: [],
    internal_tag_ids: [],
    ...overrides,
  };
}

export function createTestPreset(overrides: Partial<SpaceComponentPreset> = {}): SpaceComponentPreset {
  return {
    id: 1,
    name: 'test-preset',
    preset: { title: 'Test Preset' },
    component_id: 1,
    space_id: 1,
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    image: '',
    color: '',
    icon: '',
    description: '',
    ...overrides,
  };
}

// =============================================================================
// COMPLEX SCENARIO BUILDERS
// =============================================================================

/**
 * Creates a scenario with hierarchical groups (parent-child relationships)
 */
export function createHierarchicalGroupsScenario() {
  const parentGroup = createTestGroup({
    id: 1,
    name: 'parent-group',
    uuid: 'parent-uuid',
  });

  const childGroup = createTestGroup({
    id: 2,
    name: 'child-group',
    uuid: 'child-uuid',
    parent_id: 1,
    parent_uuid: 'parent-uuid',
  });

  const grandchildGroup = createTestGroup({
    id: 3,
    name: 'grandchild-group',
    uuid: 'grandchild-uuid',
    parent_id: 2,
    parent_uuid: 'child-uuid',
  });

  return { parentGroup, childGroup, grandchildGroup };
}

/**
 * Creates a scenario with components that have complex schema dependencies
 */
export function createComplexSchemaDependenciesScenario() {
  const tag1 = createTestTag({ id: 1, name: 'tag-1' });
  const tag2 = createTestTag({ id: 2, name: 'tag-2' });

  const group1 = createTestGroup({ id: 1, name: 'group-1', uuid: 'group-1-uuid' });
  const group2 = createTestGroup({ id: 2, name: 'group-2', uuid: 'group-2-uuid' });

  const baseComponent = createTestComponent({
    id: 1,
    name: 'base-component',
    schema: {
      title: { type: 'text' },
    },
  });

  const complexComponent = createTestComponent({
    id: 2,
    name: 'complex-component',
    component_group_uuid: 'group-1-uuid',
    internal_tag_ids: ['1', '2'],
    schema: {
      content: {
        type: 'bloks',
        component_whitelist: ['base-component'],
        component_group_whitelist: ['group-2-uuid'],
        component_tag_whitelist: [1, 2],
      },
      nested: {
        type: 'blocks',
        blocks: [{
          type: 'bloks',
          component_whitelist: ['base-component'],
        }],
      },
    },
  });

  return { tag1, tag2, group1, group2, baseComponent, complexComponent };
}

/**
 * Creates a scenario with presets that depend on components
 */
export function createPresetDependenciesScenario() {
  const component1 = createTestComponent({
    id: 1,
    name: 'component-1',
  });

  const component2 = createTestComponent({
    id: 2,
    name: 'component-2',
  });

  const preset1 = createTestPreset({
    id: 1,
    name: 'preset-1',
    component_id: 1,
    preset: { title: 'Default Title 1' },
  });

  const preset2 = createTestPreset({
    id: 2,
    name: 'preset-2',
    component_id: 2,
    preset: { title: 'Default Title 2' },
  });

  return { component1, component2, preset1, preset2 };
}

/**
 * Creates a scenario where source and target spaces have different IDs
 * This tests the core reconciliation logic
 */
export function createSourceTargetReconciliationScenario() {
  // Source space data (what we're pushing from)
  const sourceTag = createTestTag({ id: 100, name: 'shared-tag' });
  const sourceGroup = createTestGroup({ id: 200, name: 'shared-group', uuid: 'shared-group-uuid' });
  const sourceComponent = createTestComponent({
    id: 300,
    name: 'shared-component',
    component_group_uuid: 'shared-group-uuid',
    internal_tag_ids: ['100'],
  });
  const sourcePreset = createTestPreset({
    id: 400,
    name: 'shared-preset',
    component_id: 300,
  });

  // Target space data (what exists in destination, with different IDs)
  const targetTag = createTestTag({ id: 500, name: 'shared-tag' });
  const targetGroup = createTestGroup({ id: 600, name: 'shared-group', uuid: 'shared-group-uuid' });
  const targetComponent = createTestComponent({
    id: 700,
    name: 'shared-component',
    component_group_uuid: 'shared-group-uuid',
    internal_tag_ids: ['500'], // Note: different tag ID
  });
  const targetPreset = createTestPreset({
    id: 800,
    name: 'shared-preset',
    component_id: 700, // Note: different component ID
  });

  return {
    source: { tag: sourceTag, group: sourceGroup, component: sourceComponent, preset: sourcePreset },
    target: { tag: targetTag, group: targetGroup, component: targetComponent, preset: targetPreset },
  };
}

/**
 * Creates a complete SpaceDataState for testing
 */
export function createTestSpaceDataState(
  localData: {
    components?: SpaceComponent[];
    groups?: SpaceComponentGroup[];
    tags?: SpaceComponentInternalTag[];
    presets?: SpaceComponentPreset[];
  } = {},
  targetData: {
    components?: SpaceComponent[];
    groups?: SpaceComponentGroup[];
    tags?: SpaceComponentInternalTag[];
    presets?: SpaceComponentPreset[];
  } = {},
): SpaceDataState {
  return {
    local: {
      components: localData.components || [],
      groups: localData.groups || [],
      internalTags: localData.tags || [],
      presets: localData.presets || [],
    },
    target: {
      components: new Map((targetData.components || []).map(c => [c.name, c])),
      groups: new Map((targetData.groups || []).map(g => [g.name, g])),
      tags: new Map((targetData.tags || []).map(t => [t.name, t])),
      presets: new Map((targetData.presets || []).map(p => [p.name, p])),
    },
  };
}

// =============================================================================
// EDGE CASE SCENARIOS
// =============================================================================

/**
 * Creates a scenario with circular dependencies (should be detected and handled)
 */
export function createCircularDependencyScenario() {
  const componentA = createTestComponent({
    id: 1,
    name: 'component-a',
    schema: {
      content: {
        type: 'bloks',
        component_whitelist: ['component-b'],
      },
    },
  });

  const componentB = createTestComponent({
    id: 2,
    name: 'component-b',
    schema: {
      content: {
        type: 'bloks',
        component_whitelist: ['component-a'], // Circular reference
      },
    },
  });

  return { componentA, componentB };
}

/**
 * Creates a scenario with missing dependencies (references that don't exist)
 */
export function createMissingDependenciesScenario() {
  const component = createTestComponent({
    id: 1,
    name: 'component-with-missing-deps',
    component_group_uuid: 'non-existent-group-uuid',
    internal_tag_ids: ['999'], // Non-existent tag
    schema: {
      content: {
        type: 'bloks',
        component_whitelist: ['non-existent-component'],
        component_group_whitelist: ['non-existent-group-uuid'],
        component_tag_whitelist: [999],
      },
    },
  });

  return { component };
}

/**
 * Creates a scenario where target space has resources that don't exist in source
 */
export function createTargetOnlyResourcesScenario() {
  const sourceComponent = createTestComponent({ id: 1, name: 'source-only' });
  const targetComponent1 = createTestComponent({ id: 2, name: 'source-only' });
  const targetComponent2 = createTestComponent({ id: 3, name: 'target-only' });

  return {
    source: [sourceComponent],
    target: [targetComponent1, targetComponent2],
  };
}
