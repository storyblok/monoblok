import type {
  SpaceComponent,
  SpaceComponentGroup,
  SpaceComponentInternalTag,
  SpaceComponentPreset,
} from '../../constants';
import type { DependencyGraph, GraphBuildingContext, NodeData, NodeType, ProcessingLevel, SchemaDependencies, TargetResourceInfo, UnifiedNode } from './types';
import { upsertComponent, upsertComponentGroup, upsertComponentInternalTag, upsertComponentPreset } from '../actions';

// =============================================================================
// GRAPH BUILDING
// =============================================================================

/**
 * Builds a complete dependency graph from the space data with colocated target data.
 * Each node in the graph represents a resource (component, group, or tag) and
 * maintains bidirectional links to its dependencies and dependents.
 * Target data is colocated with each node for efficient upsert operations.
 */
export function buildDependencyGraph(context: GraphBuildingContext): DependencyGraph {
  const { spaceState } = context;
  const graph: DependencyGraph = { nodes: new Map() };

  // Helper function to establish bidirectional dependencies
  function addDependency(dependentId: string, dependencyId: string) {
    const dependent = graph.nodes.get(dependentId);
    const dependency = graph.nodes.get(dependencyId);

    if (dependent && dependency) {
      dependent.dependencies.add(dependencyId);
      dependency.dependents.add(dependentId);
    }
  }

  // Create nodes for all tags with colocated target data
  spaceState.local.internalTags.forEach((tag) => {
    const nodeId = `tag:${tag.id}`;
    const targetTag = spaceState.target.tags.get(tag.name);
    const node = new TagNode(nodeId, tag, targetTag);
    graph.nodes.set(nodeId, node);
  });

  // Create nodes for all groups with colocated target data
  spaceState.local.groups.forEach((group) => {
    const nodeId = `group:${group.uuid}`;
    const targetGroup = spaceState.target.groups.get(group.name);
    const node = new GroupNode(nodeId, group, targetGroup);
    graph.nodes.set(nodeId, node);
  });

  // Create nodes for all components with colocated target data
  spaceState.local.components.forEach((component) => {
    const nodeId = `component:${component.name}`;
    const targetComponent = spaceState.target.components.get(component.name);
    const node = new ComponentNode(nodeId, component, targetComponent);
    graph.nodes.set(nodeId, node);
  });

  // Create nodes for all presets with colocated target data
  spaceState.local.presets.forEach((preset) => {
    const nodeId = `preset:${preset.name}`;
    const targetPreset = spaceState.target.presets.get(preset.name);
    const targetData = targetPreset
      ? {
          resource: targetPreset,
          id: targetPreset.id,
        }
      : undefined;
    const node = new PresetNode(preset, targetData);
    graph.nodes.set(nodeId, node);
  });

  // Add group parent dependencies
  spaceState.local.groups.forEach((group) => {
    if (group.parent_uuid) {
      const childId = `group:${group.uuid}`;
      const parentId = `group:${group.parent_uuid}`;
      addDependency(childId, parentId);
    }
  });

  // Add component dependencies based on schema analysis
  spaceState.local.components.forEach((component) => {
    const componentId = `component:${component.name}`;

    // Add dependencies on internal_tag_ids (direct component tag references)
    if (component.internal_tag_ids && component.internal_tag_ids.length > 0) {
      component.internal_tag_ids.forEach((tagId) => {
        const tagNodeId = `tag:${tagId}`;
        addDependency(componentId, tagNodeId);
      });
    }

    // Add dependencies on component_group_uuid (component group assignment)
    if (component.component_group_uuid) {
      const groupId = `group:${component.component_group_uuid}`;
      addDependency(componentId, groupId);
    }

    // Add dependencies on preset_id (component preset reference)
    if (component.preset_id) {
      // Find the preset by ID and create dependency
      const preset = spaceState.local.presets.find(p => p.id === component.preset_id);
      if (preset) {
        const presetId = `preset:${preset.name}`;
        addDependency(componentId, presetId);
      }
    }

    if (component.schema) {
      const dependencies = collectWhitelistDependencies(component.schema);

      // Add dependencies on groups (from schema whitelists)
      dependencies.groupUuids.forEach((groupUuid) => {
        const groupId = `group:${groupUuid}`;
        addDependency(componentId, groupId);
      });

      // Add dependencies on tags (from schema whitelists)
      dependencies.tagIds.forEach((tagId) => {
        const tagNodeId = `tag:${tagId}`;
        addDependency(componentId, tagNodeId);
      });

      // Add dependencies on other components
      dependencies.componentNames.forEach((componentName) => {
        const dependencyId = `component:${componentName}`;
        addDependency(componentId, dependencyId);
      });
    }
  });

  // Add preset dependencies on components
  spaceState.local.presets.forEach((preset) => {
    const presetId = `preset:${preset.name}`;

    // Find the component this preset belongs to
    const component = spaceState.local.components.find(c => c.id === preset.component_id);
    if (component) {
      const componentId = `component:${component.name}`;
      addDependency(presetId, componentId);
    }
  });

  return graph;
}

// =============================================================================
// DEPENDENCY EXTRACTION
// =============================================================================

/**
 * Extracts dependency information from a component schema.
 * Traverses the schema to find references to groups, tags, and other components.
 */
export function collectWhitelistDependencies(schema: Record<string, any>): SchemaDependencies {
  const groupUuids = new Set<string>();
  const tagIds = new Set<number>();
  const componentNames = new Set<string>();

  function traverseField(field: Record<string, any>) {
    if (field.type === 'bloks') {
      // Collect group dependencies
      if (field.component_group_whitelist && Array.isArray(field.component_group_whitelist)) {
        field.component_group_whitelist.forEach((uuid: string) => groupUuids.add(uuid));
      }

      // Collect tag dependencies
      if (field.component_tag_whitelist && Array.isArray(field.component_tag_whitelist)) {
        field.component_tag_whitelist.forEach((tagId: number) => tagIds.add(tagId));
      }

      // Collect component dependencies
      if (field.component_whitelist && Array.isArray(field.component_whitelist)) {
        field.component_whitelist.forEach((name: string) => componentNames.add(name));
      }
    }

    // Recursively traverse nested fields
    Object.values(field).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            traverseField(item);
          }
        });
      }
      else if (typeof value === 'object' && value !== null) {
        traverseField(value);
      }
    });
  }

  // Traverse all fields in the schema
  Object.values(schema).forEach((field) => {
    if (typeof field === 'object' && field !== null) {
      traverseField(field);
    }
  });

  return { groupUuids, tagIds, componentNames };
}

// =============================================================================
// GRAPH VALIDATION
// =============================================================================

/**
 * Detects problematic cycles in the dependency graph.
 * Returns an array of cycle descriptions that would prevent successful processing.
 */
export function detectProblematicCycles(graph: DependencyGraph): string[] {
  const problematicCycles: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): boolean {
    if (recursionStack.has(nodeId)) {
      // Found a cycle - check if it's problematic
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart).concat(nodeId);

      // Cycles involving groups or tags are always problematic
      const hasGroupOrTag = cycle.some(id => id.startsWith('group:') || id.startsWith('tag:'));
      if (hasGroupOrTag) {
        problematicCycles.push(`Problematic cycle: ${cycle.join(' → ')}`);
      }

      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const dependencyId of node.dependencies) {
        if (dfs(dependencyId, [...path])) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  // Check each node for cycles
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return problematicCycles;
}

/**
 * Detects circular component whitelists (which are allowed but worth noting).
 */
export function detectCircularWhitelists(graph: DependencyGraph): string[] {
  const circularWhitelists: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): boolean {
    if (recursionStack.has(nodeId)) {
      // Found a cycle - check if it's just component whitelists
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart).concat(nodeId);

      // Only report if it's purely component-to-component cycles
      const isComponentOnly = cycle.every(id => id.startsWith('component:'));
      if (isComponentOnly) {
        circularWhitelists.push(cycle.join(' → '));
      }

      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const dependencyId of node.dependencies) {
        if (dfs(dependencyId, [...path])) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  // Check each component node for circular whitelists
  for (const nodeId of graph.nodes.keys()) {
    if (nodeId.startsWith('component:') && !visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return circularWhitelists;
}

/**
 * Detects strongly connected components using Tarjan's algorithm.
 * Returns an array of SCCs, where each SCC is an array of node IDs.
 */
export function detectStronglyConnectedComponents(nodeIds: string[], graph: DependencyGraph): string[][] {
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let currentIndex = 0;

  function strongConnect(nodeId: string) {
    // Set the depth index for this node to the smallest unused index
    index.set(nodeId, currentIndex);
    lowLink.set(nodeId, currentIndex);
    currentIndex++;
    stack.push(nodeId);
    onStack.add(nodeId);

    // Consider successors of this node
    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const dependencyId of node.dependencies) {
        if (nodeIds.includes(dependencyId)) { // Only consider nodes in the remaining set
          if (!index.has(dependencyId)) {
            // Successor has not yet been visited; recurse on it
            strongConnect(dependencyId);
            lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, lowLink.get(dependencyId)!));
          }
          else if (onStack.has(dependencyId)) {
            // Successor is in stack and hence in the current SCC
            lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, index.get(dependencyId)!));
          }
        }
      }
    }

    // If this is a root node, pop the stack and create an SCC
    if (lowLink.get(nodeId) === index.get(nodeId)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);
      sccs.push(scc);
    }
  }

  // Run the algorithm for all unvisited nodes
  for (const nodeId of nodeIds) {
    if (!index.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return sccs;
}

/**
 * Determines the processing order using topological sorting with SCC handling.
 * Returns an array of ProcessingLevels, which can be either regular or cyclic levels.
 */
export function determineProcessingOrder(graph: DependencyGraph): ProcessingLevel[] {
  const levels: ProcessingLevel[] = [];
  const inDegree = new Map<string, number>();

  // Calculate in-degrees for all nodes
  for (const [nodeId, node] of graph.nodes) {
    inDegree.set(nodeId, node.dependencies.size);
  }

  // Process nodes level by level
  while (inDegree.size > 0) {
    // Find all nodes with no remaining dependencies
    const currentLevel: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        currentLevel.push(nodeId);
      }
    }

    if (currentLevel.length === 0) {
      // If no nodes can be processed, we have cycles - detect SCCs
      const remainingNodes = Array.from(inDegree.keys());
      const sccs = detectStronglyConnectedComponents(remainingNodes, graph);

      for (const scc of sccs) {
        // Validate that SCCs only contain components (not groups/tags)
        const hasNonComponent = scc.some(nodeId =>
          nodeId.startsWith('group:') || nodeId.startsWith('tag:'),
        );

        if (hasNonComponent) {
          throw new Error(`Unsupported circular dependency involving groups, tags, or presets: ${scc.join(' → ')}`);
        }

        // Add as cyclic level - these will need special processing
        levels.push({ nodes: scc, isCyclic: true });

        // Remove SCC nodes from processing
        scc.forEach(nodeId => inDegree.delete(nodeId));
      }

      continue; // Continue with remaining nodes after handling cycles
    }

    // Add regular level
    levels.push({ nodes: currentLevel, isCyclic: false });

    // Remove processed nodes and update in-degrees
    for (const nodeId of currentLevel) {
      inDegree.delete(nodeId);
      const node = graph.nodes.get(nodeId)!;

      // Decrease in-degree for all dependents
      for (const dependentId of node.dependents) {
        const currentDegree = inDegree.get(dependentId);
        if (currentDegree !== undefined) {
          inDegree.set(dependentId, currentDegree - 1);
        }
      }
    }
  }

  return levels;
}

// =============================================================================
// GRAPH VALIDATION
// =============================================================================

/**
 * Validates the dependency graph and throws errors for critical issues.
 */
export function validateGraph(graph: DependencyGraph): void {
  console.log(`📊 Built dependency graph with ${graph.nodes.size} nodes`);

  // Check for problematic cycles
  const problematicCycles = detectProblematicCycles(graph);
  if (problematicCycles.length > 0) {
    throw new Error(`❌ Problematic cycles detected:\n${problematicCycles.join('\n')}`);
  }

  // Report circular whitelists (informational)
  const circularWhitelists = detectCircularWhitelists(graph);
  if (circularWhitelists.length > 0) {
    console.log(`ℹ️  Circular component whitelists detected (allowed): ${circularWhitelists.join(', ')}`);
  }

  console.log(`✅ Graph validation passed`);
}

// =============================================================================
// CONCRETE NODE IMPLEMENTATIONS
// =============================================================================

class GraphNode<TSource extends NodeData> implements UnifiedNode<TSource> {
  id: string;
  type: NodeType;
  name: string;
  sourceData: TSource;
  targetData?: TargetResourceInfo<TSource>;
  dependencies: Set<string>;
  dependents: Set<string>;

  constructor(id: string, type: NodeType, name: string, sourceData: TSource, targetResource?: TSource) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.sourceData = sourceData;
    this.dependencies = new Set();
    this.dependents = new Set();

    // Set target data if target resource exists
    if (targetResource) {
      this.targetData = {
        resource: targetResource,
        id: (targetResource as any).id,
      };
    }
  }

  getName(): string {
    return this.name;
  }

  resolveReferences(_graph: DependencyGraph): void {
    // Base implementation does nothing - override in derived classes if needed
  }

  async upsert(_space: string): Promise<TSource> {
    throw new Error('upsert must be implemented by derived classes');
  }

  updateTargetData(result: TSource): void {
    this.targetData = {
      resource: result,
      id: (result as any).id,
    };
  }
}

export class TagNode extends GraphNode<SpaceComponentInternalTag> {
  constructor(id: string, data: SpaceComponentInternalTag, targetTag?: SpaceComponentInternalTag) {
    super(id, 'tag', data.name, data, targetTag);
  }

  resolveReferences(_graph: DependencyGraph): void {
    // Tags don't have references to resolve
  }

  async upsert(space: string): Promise<SpaceComponentInternalTag> {
    const existingId = this.targetData?.id;
    const result = await upsertComponentInternalTag(space, this.sourceData, existingId as number | undefined);
    if (!result) {
      throw new Error(`Failed to upsert tag ${this.name}`);
    }
    return result;
  }
}

export class GroupNode extends GraphNode<SpaceComponentGroup> {
  constructor(id: string, data: SpaceComponentGroup, targetGroup?: SpaceComponentGroup) {
    super(id, 'group', data.name, data, targetGroup);
  }

  resolveReferences(graph: DependencyGraph): void {
    // Resolve parent group reference if it exists
    if (this.sourceData.parent_uuid) {
      const parentNodeId = `group:${this.sourceData.parent_uuid}`;
      const parentNode = graph.nodes.get(parentNodeId) as GroupNode;

      if (parentNode?.targetData) {
        // Update the source data to use the target space parent ID
        this.sourceData = {
          ...this.sourceData,
          parent_id: parentNode.targetData.id as number,
        };
      }
    }
  }

  async upsert(space: string): Promise<SpaceComponentGroup> {
    const existingId = this.targetData?.id;
    const result = await upsertComponentGroup(space, this.sourceData, existingId as number | undefined);
    if (!result) {
      throw new Error(`Failed to upsert group ${this.name}`);
    }
    return result;
  }
}

export class ComponentNode extends GraphNode<SpaceComponent> {
  constructor(id: string, data: SpaceComponent, targetComponent?: SpaceComponent) {
    super(id, 'component', data.name, data, targetComponent);
  }

  resolveReferences(graph: DependencyGraph): void {
    // Create a copy of source data to modify
    const updatedData = { ...this.sourceData };

    // Resolve component group reference
    if (this.sourceData.component_group_uuid) {
      const groupNodeId = `group:${this.sourceData.component_group_uuid}`;
      const groupNode = graph.nodes.get(groupNodeId) as GroupNode;

      if (groupNode?.targetData) {
        updatedData.component_group_uuid = groupNode.targetData.resource.uuid;
      }
    }

    // Resolve internal tag references
    if (this.sourceData.internal_tag_ids && this.sourceData.internal_tag_ids.length > 0) {
      const resolvedTagIds: string[] = [];

      for (const tagId of this.sourceData.internal_tag_ids) {
        const tagNodeId = `tag:${tagId}`;
        const tagNode = graph.nodes.get(tagNodeId) as TagNode;

        if (tagNode?.targetData) {
          resolvedTagIds.push(String(tagNode.targetData.id));
        }
        else {
          // Keep original ID if not found in graph (might be a tag that already exists in target)
          resolvedTagIds.push(tagId);
        }
      }

      updatedData.internal_tag_ids = resolvedTagIds;
    }

    // Resolve preset reference
    if (this.sourceData.preset_id) {
      // Find the preset by ID and resolve to target preset ID
      const preset = this.findPresetById(this.sourceData.preset_id, graph);
      if (preset) {
        const presetNodeId = `preset:${preset.name}`;
        const presetNode = graph.nodes.get(presetNodeId);

        if (presetNode?.targetData) {
          updatedData.preset_id = presetNode.targetData.id as number;
        }
      }
    }

    // Resolve schema references (component whitelists, group whitelists, tag whitelists)
    if (this.sourceData.schema) {
      updatedData.schema = this.resolveSchemaReferences(this.sourceData.schema, graph);
    }

    // Update the source data with resolved references
    this.sourceData = updatedData;
  }

  private findPresetById(presetId: number, graph: DependencyGraph): SpaceComponentPreset | null {
    // Find preset by matching source preset_id
    for (const [_nodeId, node] of graph.nodes) {
      if (node.type === 'preset' && (node.sourceData as SpaceComponentPreset).id === presetId) {
        return node.sourceData as SpaceComponentPreset;
      }
    }
    return null;
  }

  private resolveSchemaReferences(schema: Record<string, any>, graph: DependencyGraph): Record<string, any> {
    const resolvedSchema = JSON.parse(JSON.stringify(schema)); // Deep copy

    function resolveField(field: any): any {
      if (typeof field !== 'object' || field === null) {
        return field;
      }

      if (Array.isArray(field)) {
        return field.map(resolveField);
      }

      const resolvedField = { ...field };

      // Resolve bloks field references
      if (resolvedField.type === 'bloks') {
        // Resolve component group whitelist
        if (resolvedField.component_group_whitelist && Array.isArray(resolvedField.component_group_whitelist)) {
          resolvedField.component_group_whitelist = resolvedField.component_group_whitelist.map((groupUuid: string) => {
            const groupNodeId = `group:${groupUuid}`;
            const groupNode = graph.nodes.get(groupNodeId) as GroupNode;
            return groupNode?.targetData?.resource.uuid || groupUuid;
          });
        }

        // Resolve component tag whitelist
        if (resolvedField.component_tag_whitelist && Array.isArray(resolvedField.component_tag_whitelist)) {
          resolvedField.component_tag_whitelist = resolvedField.component_tag_whitelist.map((tagId: number) => {
            const tagNodeId = `tag:${tagId}`;
            const tagNode = graph.nodes.get(tagNodeId) as TagNode;
            return tagNode?.targetData?.id || tagId;
          });
        }

        // Component whitelist doesn't need ID resolution as it uses names
      }

      // Recursively resolve nested fields
      Object.keys(resolvedField).forEach((key) => {
        if (typeof resolvedField[key] === 'object' && resolvedField[key] !== null) {
          resolvedField[key] = resolveField(resolvedField[key]);
        }
      });

      return resolvedField;
    }

    const result: Record<string, any> = {};
    Object.keys(resolvedSchema).forEach((key) => {
      result[key] = resolveField(resolvedSchema[key]);
    });

    return result;
  }

  async upsert(space: string): Promise<SpaceComponent> {
    const existingId = this.targetData?.id;
    const result = await upsertComponent(space, this.sourceData, existingId as number | undefined);
    if (!result) {
      throw new Error(`Failed to upsert component ${this.name}`);
    }
    return result;
  }
}

/**
 * Preset node implementation
 * Presets depend on components (via component_id)
 */
class PresetNode implements UnifiedNode<SpaceComponentPreset> {
  public readonly id: string;
  public readonly name: string;
  public readonly type: NodeType = 'preset';
  public readonly sourceData: SpaceComponentPreset;
  public targetData?: TargetResourceInfo<SpaceComponentPreset>;
  public readonly dependencies = new Set<string>();
  public readonly dependents = new Set<string>();

  constructor(preset: SpaceComponentPreset, targetData?: TargetResourceInfo<SpaceComponentPreset>) {
    this.sourceData = preset;
    this.targetData = targetData;
    this.id = `preset:${preset.name}`;
    this.name = preset.name;
  }

  getName(): string {
    return this.name;
  }

  resolveReferences(graph: DependencyGraph): void {
    // Find the component this preset belongs to and update component_id
    const componentName = this.findComponentNameById(this.sourceData.component_id, graph);
    if (componentName) {
      const componentNode = graph.nodes.get(`component:${componentName}`);
      if (componentNode?.targetData) {
        this.sourceData.component_id = componentNode.targetData.id as number;
      }
    }
  }

  private findComponentNameById(componentId: number, graph: DependencyGraph): string | null {
    // Find component by matching source component_id
    for (const [_nodeId, node] of graph.nodes) {
      if (node.type === 'component' && (node.sourceData as SpaceComponent).id === componentId) {
        return node.name;
      }
    }
    return null;
  }

  async upsert(space: string): Promise<SpaceComponentPreset> {
    const existingId = this.targetData?.id as number | undefined;
    const result = await upsertComponentPreset(space, this.sourceData, existingId);
    if (!result) {
      throw new Error(`Failed to upsert preset: ${this.name}`);
    }
    return result;
  }

  updateTargetData(result: SpaceComponentPreset): void {
    this.targetData = {
      resource: result,
      id: result.id,
    };
  }
}
