import type { SpaceData } from '../constants';
import { minimatch } from 'minimatch';
import { collectWhitelistDependencies } from './graph-operations/dependency-graph';

/**
 * Collects all dependencies (groups, tags, and components) for a set of components
 */
function collectAllDependencies(
  components: SpaceData['components'],
  allComponents: SpaceData['components'],
  allGroups: SpaceData['groups'],
  allTags: SpaceData['internalTags'],
) {
  const requiredComponents = new Set<string>();
  const requiredGroupUuids = new Set<string>();
  const requiredTagIds = new Set<number>();

  // Add initial components
  components.forEach(component => requiredComponents.add(component.name));

  // Recursively collect component dependencies
  function collectComponentDeps(componentName: string, visited = new Set<string>()) {
    if (visited.has(componentName)) { return; } // Prevent infinite loops
    visited.add(componentName);

    const component = allComponents.find(c => c.name === componentName);
    if (!component) { return; }

    // Collect direct component group assignment
    if (component.component_group_uuid) {
      requiredGroupUuids.add(component.component_group_uuid);
    }

    // Collect direct internal tag assignments
    if (component.internal_tag_ids && component.internal_tag_ids.length > 0) {
      component.internal_tag_ids.forEach((tagId) => {
        // Handle both string and number tag IDs
        const numericTagId = typeof tagId === 'string' ? Number.parseInt(tagId, 10) : tagId;
        if (!Number.isNaN(numericTagId)) {
          requiredTagIds.add(numericTagId);
        }
      });
    }

    // Collect schema whitelist dependencies
    if (component.schema) {
      const schemaDeps = collectWhitelistDependencies(component.schema);

      // Add schema group dependencies
      schemaDeps.groupUuids.forEach((groupUuid) => {
        requiredGroupUuids.add(groupUuid);
      });

      // Add schema tag dependencies
      schemaDeps.tagIds.forEach((tagId) => {
        requiredTagIds.add(tagId);
      });

      // Add schema component dependencies (recursive)
      schemaDeps.componentNames.forEach((componentName) => {
        if (!requiredComponents.has(componentName)) {
          requiredComponents.add(componentName);
          collectComponentDeps(componentName, visited);
        }
      });
    }
  }

  // Collect dependencies for all components
  components.forEach(component => collectComponentDeps(component.name));

  // Collect parent groups for hierarchical dependencies
  function collectParentGroups(groupUuid: string, visited = new Set<string>()) {
    if (visited.has(groupUuid)) { return; } // Prevent infinite loops
    visited.add(groupUuid);

    const group = allGroups.find(g => g.uuid === groupUuid);
    if (group && group.parent_uuid) {
      requiredGroupUuids.add(group.parent_uuid);
      collectParentGroups(group.parent_uuid, visited);
    }
  }

  // Ensure we include parent groups for all required groups
  const initialGroupUuids = Array.from(requiredGroupUuids);
  initialGroupUuids.forEach(groupUuid => collectParentGroups(groupUuid));

  // Filter to only include required resources
  const filteredComponents = allComponents.filter(component => requiredComponents.has(component.name));
  const filteredGroups = allGroups.filter(group => requiredGroupUuids.has(group.uuid));
  const filteredTags = allTags.filter(tag => requiredTagIds.has(tag.id));

  return { filteredComponents, filteredGroups, filteredTags };
}

/**
 * Filters space data to only include a specific component and its dependencies
 */
export function filterSpaceDataByComponent(spaceData: SpaceData, componentName: string): SpaceData {
  // Find the target component
  const targetComponent = spaceData.components.find(component => component.name === componentName);
  if (!targetComponent) {
    return {
      components: [],
      groups: [],
      internalTags: [],
      presets: [],
    };
  }

  // Collect all dependencies for this component
  const { filteredComponents, filteredGroups, filteredTags } = collectAllDependencies(
    [targetComponent],
    spaceData.components,
    spaceData.groups,
    spaceData.internalTags,
  );

  // Find presets for all included components
  const componentIds = filteredComponents.map(component => component.id);
  const filteredPresets = spaceData.presets.filter(
    preset => componentIds.includes(preset.component_id),
  );

  return {
    components: filteredComponents,
    groups: filteredGroups,
    internalTags: filteredTags,
    presets: filteredPresets,
  };
}

/**
 * Filters space data to only include components matching a glob pattern and their dependencies
 */
export function filterSpaceDataByPattern(spaceData: SpaceData, pattern: string): SpaceData {
  // Filter components by pattern
  const matchingComponents = spaceData.components.filter(component =>
    minimatch(component.name, pattern),
  );

  if (matchingComponents.length === 0) {
    return {
      components: [],
      groups: [],
      internalTags: [],
      presets: [],
    };
  }

  // Collect all dependencies for matching components
  const { filteredComponents, filteredGroups, filteredTags } = collectAllDependencies(
    matchingComponents,
    spaceData.components,
    spaceData.groups,
    spaceData.internalTags,
  );

  // Find presets for all included components
  const componentIds = filteredComponents.map(component => component.id);
  const filteredPresets = spaceData.presets.filter(
    preset => componentIds.includes(preset.component_id),
  );

  return {
    components: filteredComponents,
    groups: filteredGroups,
    internalTags: filteredTags,
    presets: filteredPresets,
  };
}
