import type { Component, ComponentFolder, InternalTag, SpaceComponentsData } from './constants';
import { minimatch } from 'minimatch';
import { CommandError } from '../../utils';
import { collectWhitelistDependencies } from './push/graph-operations/dependency-graph';

/**
 * Collects the dependencies required to make a set of matched components independently
 * pushable, following option A: the matched components plus their assigned groups (with
 * ancestors), assigned tags, and the groups/tags referenced by their own schema whitelists
 * (groups with ancestors). Sibling components referenced via `component_whitelist` are NOT
 * pulled in: those references are name-based, need no id remapping, and self-heal once a
 * component of that name exists in the target.
 */
export function collectAllDependencies(
  components: Component[],
  allComponents: Component[],
  allGroups: ComponentFolder[],
  allTags: InternalTag[],
) {
  const requiredComponents = new Set<string>();
  const requiredGroupUuids = new Set<string>();
  const requiredTagIds = new Set<number>();

  components.forEach(component => requiredComponents.add(component.name));

  function collectComponentDeps(componentName: string, visited = new Set<string>()) {
    if (visited.has(componentName)) { return; }
    visited.add(componentName);

    const component = allComponents.find(c => c.name === componentName);
    if (!component) { return; }

    if (component.component_group_uuid) {
      requiredGroupUuids.add(component.component_group_uuid);
    }

    if (component.internal_tag_ids && component.internal_tag_ids.length > 0) {
      component.internal_tag_ids.forEach((tagId) => {
        const numericTagId = typeof tagId === 'string' ? Number.parseInt(tagId, 10) : tagId;
        if (!Number.isNaN(numericTagId)) {
          requiredTagIds.add(numericTagId);
        }
      });
    }

    if (component.schema) {
      const schemaDeps = collectWhitelistDependencies(component.schema);
      schemaDeps.groupUuids.forEach(groupUuid => requiredGroupUuids.add(groupUuid));
      schemaDeps.tagIds.forEach(tagId => requiredTagIds.add(tagId));
      // Option A: do NOT add schemaDeps.componentNames. Sibling components are not pulled in.
    }
  }

  components.forEach(component => collectComponentDeps(component.name));

  function collectParentGroups(groupUuid: string, visited = new Set<string>()) {
    if (visited.has(groupUuid)) { return; }
    visited.add(groupUuid);

    const group = allGroups.find(g => g.uuid === groupUuid);
    if (group && group.parent_uuid) {
      requiredGroupUuids.add(group.parent_uuid);
      collectParentGroups(group.parent_uuid, visited);
    }
  }

  const initialGroupUuids = Array.from(requiredGroupUuids);
  initialGroupUuids.forEach(groupUuid => collectParentGroups(groupUuid));

  const filteredComponents = allComponents.filter(component => requiredComponents.has(component.name));
  const filteredGroups = allGroups.filter(group => group.uuid !== undefined && requiredGroupUuids.has(group.uuid));
  const filteredTags = allTags.filter(tag => tag.id !== undefined && requiredTagIds.has(tag.id));

  return { filteredComponents, filteredGroups, filteredTags };
}

function emptySpaceData(): SpaceComponentsData {
  return { components: [], groups: [], internalTags: [], presets: [], datasources: [] };
}

/**
 * Filters space data to only include a specific component (exact name) and its dependencies.
 */
export function filterSpaceDataByComponent(spaceData: SpaceComponentsData, componentName: string): SpaceComponentsData {
  const targetComponent = spaceData.components.find(component => component.name === componentName);
  if (!targetComponent) {
    return emptySpaceData();
  }

  const { filteredComponents, filteredGroups, filteredTags } = collectAllDependencies(
    [targetComponent],
    spaceData.components,
    spaceData.groups,
    spaceData.internalTags,
  );

  const componentIds = filteredComponents.map(component => component.id);
  const filteredPresets = spaceData.presets.filter(preset => componentIds.includes(preset.component_id));

  return {
    components: filteredComponents,
    groups: filteredGroups,
    internalTags: filteredTags,
    presets: filteredPresets,
    datasources: [],
  };
}

/**
 * Filters space data to only include components matching a glob pattern and their dependencies.
 */
export function filterSpaceDataByPattern(spaceData: SpaceComponentsData, pattern: string): SpaceComponentsData {
  const matchingComponents = spaceData.components.filter(component => minimatch(component.name, pattern));

  if (matchingComponents.length === 0) {
    return emptySpaceData();
  }

  const { filteredComponents, filteredGroups, filteredTags } = collectAllDependencies(
    matchingComponents,
    spaceData.components,
    spaceData.groups,
    spaceData.internalTags,
  );

  const componentIds = filteredComponents.map(component => component.id);
  const filteredPresets = spaceData.presets.filter(preset => componentIds.includes(preset.component_id));

  return {
    components: filteredComponents,
    groups: filteredGroups,
    internalTags: filteredTags,
    presets: filteredPresets,
    datasources: [],
  };
}

/**
 * Resolves a group selector (a name, or a `Parent/Child` path) to the set of UUIDs covering
 * the matched group and all of its descendants. Throws when the name is ambiguous or missing.
 */
export function resolveGroupSelector(groups: ComponentFolder[], selector: string): Set<string> {
  const byUuid = new Map(groups.filter(g => g.uuid).map(g => [g.uuid as string, g]));
  const nameOf = (uuid?: string) => (uuid ? byUuid.get(uuid)?.name : undefined);

  let matched: ComponentFolder | undefined;

  if (selector.includes('/')) {
    const segments = selector.split('/').map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) {
      throw new CommandError(`No component group found for path "${selector}".`);
    }
    let parentUuid: string | undefined;
    for (const segment of segments) {
      const candidates = groups.filter(g => g.name === segment && (g.parent_uuid ?? undefined) === parentUuid);
      if (candidates.length === 0) {
        throw new CommandError(`No component group found for path "${selector}".`);
      }
      if (candidates.length > 1) {
        throw new CommandError(`The component group path "${selector}" is ambiguous.`);
      }
      matched = candidates[0];
      parentUuid = matched.uuid;
    }
  }
  else {
    const candidates = groups.filter(g => g.name === selector);
    if (candidates.length === 0) {
      throw new CommandError(`No component group found named "${selector}".`);
    }
    if (candidates.length > 1) {
      const paths = candidates.map((g) => {
        const parts = [g.name];
        const visited = new Set<string>();
        let p = g.parent_uuid;
        while (p && !visited.has(p)) {
          visited.add(p);
          parts.unshift(nameOf(p) ?? p);
          p = byUuid.get(p)?.parent_uuid;
        }
        return parts.join('/');
      });
      throw new CommandError(`The component group name "${selector}" is ambiguous. Use a path: ${paths.join(', ')}.`);
    }
    matched = candidates[0];
  }

  const result = new Set<string>();
  const queue: string[] = matched?.uuid ? [matched.uuid] : [];
  while (queue.length > 0) {
    const uuid = queue.shift() as string;
    if (result.has(uuid)) { continue; }
    result.add(uuid);
    for (const child of groups) {
      if (child.parent_uuid === uuid && child.uuid) {
        queue.push(child.uuid);
      }
    }
  }
  return result;
}

/**
 * Resolves tag names to their numeric ids. Throws when any name is missing.
 */
export function resolveTagSelector(tags: InternalTag[], names: string[]): Set<number> {
  const byName = new Map(tags.filter(t => t.id !== undefined).map(t => [t.name, t.id as number]));
  const result = new Set<number>();
  const missing: string[] = [];
  for (const name of names) {
    const id = byName.get(name);
    if (id === undefined) {
      missing.push(name);
    }
    else {
      result.add(id);
    }
  }
  if (missing.length > 0) {
    throw new CommandError(`No component tag found named: ${missing.join(', ')}.`);
  }
  return result;
}
