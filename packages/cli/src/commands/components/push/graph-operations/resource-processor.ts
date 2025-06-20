import { colorPalette } from '../../../../constants';
import type { DependencyGraph, NodeProcessingResult, ProcessingLevel, PushResults } from './types';
import { determineProcessingOrder } from './dependency-graph';
import { progressDisplay } from '../progress-display';
import { pushComponent } from '../actions';
import type { SpaceComponent } from '../../constants';
import chalk from 'chalk';

// =============================================================================
// RESOURCE PROCESSING
// =============================================================================

/**
 * Processes all resources with 2-pass per level approach.
 */
export async function processAllResources(
  graph: DependencyGraph,
  space: string,
  maxConcurrency: number = 5,
): Promise<PushResults> {
  const levels = determineProcessingOrder(graph);
  const results: PushResults = { successful: [], failed: [] };

  // Calculate total resources for progress tracking
  const totalResources = levels.reduce((sum, level) => sum + level.nodes.length, 0);

  // Initialize progress display
  progressDisplay.start(totalResources);

  for (const level of levels) {
    if (level.isCyclic) {
      // Handle circular dependencies with stub creation
      const cyclicResults = await processCyclicLevel(level, graph, space, maxConcurrency);
      mergeResults(results, cyclicResults);
    }
    else {
      // Handle regular level
      const levelResults = await processLevel(level.nodes, graph, space, maxConcurrency);
      mergeResults(results, levelResults);
    }
  }

  // Show completion summary using progress display
  progressDisplay.handleEvent({
    type: 'complete',
    summary: {
      updated: results.successful.length,
      unchanged: 0, // No longer skip resources - all are processed
      failed: results.failed.length,
    },
  });

  return results;
}

/**
 * Processes a cyclic level with circular dependency handling.
 * Creates stub components for missing components in the cycle, then processes normally.
 */
async function processCyclicLevel(
  level: ProcessingLevel,
  graph: DependencyGraph,
  space: string,
  maxConcurrency: number,
): Promise<PushResults> {
  // Clear current progress display and show circular dependency message
  progressDisplay.clearProgress();
  console.log(`\n🔄 Detected circular dependencies: ${level.nodes.map(id => id.replace('component:', '')).join(', ')}`);

  // STEP 1: Create stub components for any missing components in the cycle
  await createStubComponents(level.nodes, graph, space);

  // STEP 2: Process the cyclic level normally (references can now resolve)
  return await processLevel(level.nodes, graph, space, maxConcurrency);
}

/**
 * Creates stub components for missing components in circular dependencies.
 */
async function createStubComponents(
  nodeIds: string[],
  graph: DependencyGraph,
  space: string,
): Promise<void> {
  const missingComponents: string[] = [];

  for (const nodeId of nodeIds) {
    const node = graph.nodes.get(nodeId);
    if (node && node.type === 'component' && !node.targetData) {
      missingComponents.push(node.name);
    }
  }

  if (missingComponents.length === 0) {
    return; // No missing components to create stubs for
  }

  console.log(`📝 Creating stub components for circular dependencies: ${missingComponents.join(', ')}`);

  // Create minimal stub components
  for (const nodeId of nodeIds) {
    const node = graph.nodes.get(nodeId);
    if (node && node.type === 'component' && !node.targetData) {
      try {
        const stubComponent = createMinimalStubComponent(node.name);
        const result = await pushComponent(space, stubComponent);

        if (result) {
          // Update the node's target data so future references can resolve
          node.updateTargetData(result);
          console.log(`${chalk.green('✓')} Created stub component: ${node.name}`);
        }
      }
      catch (error) {
        console.error(`✗ Failed to create stub component ${node.name}:`, error);
        throw error;
      }
    }
  }

  // Add a blank line before resuming normal processing
  console.log('');
}

/**
 * Creates a minimal stub component with only required fields.
 */
function createMinimalStubComponent(name: string): SpaceComponent {
  return {
    name,
    display_name: name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    id: 0, // Will be set by API
    schema: {}, // Minimal empty schema
    color: null,
    internal_tags_list: [],
    internal_tag_ids: [],
  };
}

/**
 * Processes a single level of nodes using 2-pass approach:
 * Pass 1: Resolve references (dependencies from previous levels exist)
 * Pass 2: Process all resources with resolved references
 */
async function processLevel(
  level: string[],
  graph: DependencyGraph,
  space: string,
  maxConcurrency: number,
): Promise<PushResults> {
  // PASS 1: Resolve references for this level (now that dependencies from previous levels exist)
  for (const nodeId of level) {
    const node = graph.nodes.get(nodeId)!;
    node.resolveReferences(graph);
  }

  // PASS 2: Process all nodes in this level with resolved references
  const semaphore: Array<Promise<NodeProcessingResult> | null> = Array.from({ length: maxConcurrency }, () => null);
  const promises: Promise<NodeProcessingResult>[] = [];

  for (let i = 0; i < level.length; i++) {
    const nodeId = level[i];

    // Wait for an available slot
    const slotIndex = i % maxConcurrency;
    if (i >= maxConcurrency && semaphore[slotIndex]) {
      await semaphore[slotIndex];
    }

    // Start processing the node
    const promise = processNode(nodeId, graph, space);
    promises.push(promise);
    semaphore[slotIndex] = promise;
  }

  const results = await Promise.all(promises);
  return aggregateResults(results);
}

/**
 * Process node with resolved references
 */
async function processNode(
  nodeId: string,
  graph: DependencyGraph,
  space: string,
): Promise<NodeProcessingResult> {
  const node = graph.nodes.get(nodeId)!;
  // Track start time for individual process timing
  const startTime = Date.now();

  try {
    // Always perform upsert - change detection removed due to unstable ID issues
    // Create/update the resource with resolved references
    const result = await node.upsert(space);
    node.updateTargetData(result);

    const elapsedMs = Date.now() - startTime;
    progressDisplay.handleEvent({
      type: 'success',
      name: node.getName(),
      resourceType: getResourceTypeName(node.type),
      color: getResourceTypeColor(node.type),
      elapsedMs,
    });

    return { name: node.getName() };
  }
  catch (error) {
    const elapsedMs = Date.now() - startTime;
    progressDisplay.handleEvent({
      type: 'error',
      name: node.getName(),
      resourceType: getResourceTypeName(node.type),
      error,
      elapsedMs,
    });
    return { name: node.getName(), error };
  }
}

/**
 * Aggregates results from multiple node processing operations
 */
function aggregateResults(results: NodeProcessingResult[]): PushResults {
  const aggregated: PushResults = { successful: [], failed: [] };

  for (const result of results) {
    if (result.error) {
      aggregated.failed.push({ name: result.name, error: result.error });
    }
    else {
      aggregated.successful.push(result.name);
    }
  }

  return aggregated;
}

/**
 * Merges results from multiple operations
 */
function mergeResults(target: PushResults, source: PushResults): void {
  target.successful.push(...source.successful);
  target.failed.push(...source.failed);
}

/**
 * Gets display name for a resource type
 */
function getResourceTypeName(type: string): string {
  switch (type) {
    case 'component': return 'component';
    case 'group': return 'group';
    case 'tag': return 'tag';
    case 'preset': return 'preset';
    default: return type;
  }
}

/**
 * Gets color for a resource type
 */
function getResourceTypeColor(type: string): string {
  switch (type) {
    case 'component': return colorPalette.COMPONENTS;
    case 'group': return colorPalette.GROUPS;
    case 'tag': return colorPalette.TAGS;
    case 'preset': return colorPalette.PRESETS;
    default: return colorPalette.COMPONENTS;
  }
}
