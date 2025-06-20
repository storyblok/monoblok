import type { SpaceDataState } from '../../constants';
import type { GraphBuildingContext, PushResults } from './types';

import { buildDependencyGraph, validateGraph } from './dependency-graph';
import { processAllResources } from './resource-processor';

// Re-export commonly used utilities
export type { PushResults } from './types';

// =============================================================================
// MAIN COORDINATOR
// =============================================================================

/**
 * Main function to push components using graph-based dependency resolution.
 *
 * Architecture:
 * - Build dependency graph with colocated target data
 * - For each level: resolve references then process resources
 * - Target data is embedded in each graph node for efficient upserts
 *
 * Benefits:
 * - Deterministic processing order
 * - References resolved when dependencies exist
 * - Clean behavioral node abstraction with colocated data
 * - Robust error handling and progress tracking
 */
export async function pushWithDependencyGraph(
  space: string,
  spaceState: SpaceDataState,
  maxConcurrency: number = 5,
): Promise<PushResults> {
  // Build and validate the dependency graph with colocated target data
  const context: GraphBuildingContext = { spaceState };
  const graph = buildDependencyGraph(context);
  validateGraph(graph);

  // Process all resources using the dependency graph
  const results = await processAllResources(graph, space, maxConcurrency);

  return results;
}
