import type { SpaceComponentsDataState } from "../../constants";
import type { PushResults } from "./types";

import { buildDependencyGraph, validateGraph } from "./dependency-graph";
import { processAllResources } from "./resource-processor";
import { getActiveConfig } from "../../../../lib/config";
import { getUI } from "../../../../lib/ui";
import { getLogger } from "../../../../lib/logger/logger";

// Re-export commonly used utilities
export type { PushResults } from "./types";

// =============================================================================
// MAIN COORDINATOR
// =============================================================================

/**
 * Main function to push components using graph-based dependency resolution.
 *
 * Multi-step flow:
 * 1. Build dependency graph with colocated target data
 * 2. Validate graph (cycle detection)
 * 3. Process resources level-by-level with progress bar
 */
export async function pushWithDependencyGraph(
  space: string,
  spaceState: SpaceComponentsDataState,

  backpressure: number = getActiveConfig().api.rateLimit,
): Promise<PushResults> {
  const ui = getUI();
  const logger = getLogger();

  // Step 1: Build dependency graph
  const graphSpinner = ui.createSpinner("Building dependency graph...");
  logger.info("Building dependency graph");
  const context = { spaceState };
  const graph = buildDependencyGraph(context);
  graphSpinner.succeed(`Dependency graph built (${graph.nodes.size} resources)`);

  // Step 2: Validate graph
  const validateSpinner = ui.createSpinner("Validating graph...");
  try {
    validateGraph(graph);
    validateSpinner.succeed("Graph validation passed");
  } catch (error) {
    validateSpinner.failed("Graph validation failed");
    throw error;
  }

  // Step 3: Process resources (progress bar handles visual feedback)
  const results = await processAllResources(graph, space, backpressure);

  // Show completion summary
  const status =
    results.failed.length > 0
      ? `${results.successful.length} updated, ${results.failed.length} failed`
      : `${results.successful.length} updated`;
  ui.ok(status, true);

  return results;
}
