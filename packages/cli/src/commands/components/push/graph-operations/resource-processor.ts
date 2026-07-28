import type { DependencyGraph, NodeProcessingResult, ProcessingLevel, PushResults } from './types';
import { determineProcessingOrder } from './dependency-graph';
import { pushComponent } from '../actions';
import type { ComponentCreate } from '../../../../types';
import { getActiveConfig } from '../../../../lib/config';
import { getUI } from '../../../../lib/ui';
import { getLogger } from '../../../../lib/logger/logger';

// =============================================================================
// RESOURCE PROCESSING
// =============================================================================

/**
 * Processes all resources with 2-pass per level approach.
 */
export async function processAllResources(
  graph: DependencyGraph,
  space: string,

  backpressure: number = getActiveConfig().api.rateLimit,
): Promise<PushResults> {
  const ui = getUI();
  const levels = determineProcessingOrder(graph);
  const results: PushResults = { successful: [], failed: [] };

  // Calculate total resources for progress tracking
  const totalResources = levels.reduce((sum, level) => sum + level.nodes.length, 0);

  const progressBar = ui.createProgressBar({ title: 'Pushing' });
  progressBar.setTotal(totalResources);
  const startTime = Date.now();

  try {
    for (const level of levels) {
      if (level.isCyclic) {
        // Handle circular dependencies with stub creation
        const cyclicResults = await processCyclicLevel(level, graph, space, backpressure, progressBar);
        mergeResults(results, cyclicResults);
      }
      else {
        // Handle regular level
        const levelResults = await processLevel(level.nodes, graph, space, backpressure, progressBar);
        mergeResults(results, levelResults);
      }
    }
  }
  finally {
    progressBar.stop();
  }

  // Show completion summary
  const elapsedMs = Date.now() - startTime;
  const timeStr = formatElapsedTime(elapsedMs);
  ui.br();
  ui.ok(`Completed: ${results.successful.length} updated, ${results.failed.length} failed${timeStr ? ` in ${timeStr}` : ''}`, true);

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
  backpressure: number,
  progressBar: { increment: (count?: number) => void },
): Promise<PushResults> {
  const logger = getLogger();
  logger.warn(`Detected circular dependencies: ${level.nodes.map(id => id.replace('component:', '')).join(', ')}`);

  // STEP 1: Create stub components for any missing components in the cycle
  await createStubComponents(level.nodes, graph, space);

  // STEP 2: Process the cyclic level normally (references can now resolve)
  return await processLevel(level.nodes, graph, space, backpressure, progressBar);
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

  const logger = getLogger();
  logger.info(`Creating stub components for circular dependencies: ${missingComponents.join(', ')}`);

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
          logger.info(`Created stub component: ${node.name}`);
        }
      }
      catch (error) {
        logger.error(`Failed to create stub component ${node.name}`, { error: error as Error });
        throw error;
      }
    }
  }
}

/**
 * Creates a minimal stub component with only required fields.
 */
function createMinimalStubComponent(name: string): ComponentCreate {
  return {
    name,
    display_name: name,
    schema: {}, // Minimal empty schema
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
  backpressure: number,
  progressBar: { increment: (count?: number) => void },
): Promise<PushResults> {
  // PASS 1: Resolve references for this level (now that dependencies from previous levels exist)
  for (const nodeId of level) {
    const node = graph.nodes.get(nodeId)!;
    node.resolveReferences(graph);
  }

  // PASS 2: Process all nodes in this level with resolved references
  const semaphore: Array<Promise<NodeProcessingResult> | null> = Array.from({ length: backpressure }, () => null);
  const promises: Promise<NodeProcessingResult>[] = [];

  for (let i = 0; i < level.length; i++) {
    const nodeId = level[i];

    // Wait for an available slot
    const slotIndex = i % backpressure;
    if (i >= backpressure && semaphore[slotIndex]) {
      await semaphore[slotIndex];
    }

    // Start processing the node
    const promise = processNode(nodeId, graph, space, progressBar);
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
  progressBar: { increment: (count?: number) => void },
): Promise<NodeProcessingResult> {
  const node = graph.nodes.get(nodeId)!;
  const logger = getLogger();

  try {
    // Always perform upsert - change detection removed due to unstable ID issues
    // Create/update the resource with resolved references
    const result = await node.upsert(space);
    node.updateTargetData(result);

    progressBar.increment();
    logger.info(`${getResourceTypeName(node.type)} updated: ${node.getName()}`);

    return { name: node.getName() };
  }
  catch (error) {
    progressBar.increment();
    logger.error(`${getResourceTypeName(node.type)} failed: ${node.getName()}`, { error: error as Error });
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

function formatElapsedTime(ms: number): string {
  if (ms < 1000) { return `${ms}ms`; }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}
