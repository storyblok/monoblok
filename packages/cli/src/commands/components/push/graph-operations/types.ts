import type { RegionCode } from '../../../../constants';
import type {
  SpaceComponent,
  SpaceComponentGroup,
  SpaceComponentInternalTag,
  SpaceComponentPreset,
  SpaceDataState,
} from '../../constants';

// =============================================================================
// CORE TYPES
// =============================================================================

/** Types of nodes in our dependency graph */
export type NodeType = 'component' | 'group' | 'tag' | 'preset';

/** Data that can be stored in a graph node */
export type NodeData = SpaceComponent | SpaceComponentGroup | SpaceComponentInternalTag | SpaceComponentPreset;

/** Target resource information colocated with graph nodes */
export interface TargetResourceInfo<T extends NodeData> {
  resource: T;
  id: string | number;
}

/** A unified node that tracks both source and target resources */
export interface UnifiedNode<T extends NodeData> {
  id: string;
  name: string;
  type: NodeType;
  sourceData: T;
  targetData?: TargetResourceInfo<T>;
  dependencies: Set<string>;
  dependents: Set<string>;

  // Methods that each node must implement
  getName: () => string;
  resolveReferences: (graph: DependencyGraph) => void;
  upsert: (space: string) => Promise<T>;
  updateTargetData: (result: T) => void;
}

/** The complete dependency graph using unified nodes */
export interface DependencyGraph {
  nodes: Map<string, UnifiedNode<any>>;
}

/** Results from the push operation */
export interface PushResults {
  successful: string[];
  failed: Array<{ name: string; error: unknown }>;
}

/** Dependencies extracted from component schemas */
export interface SchemaDependencies {
  groupUuids: Set<string>;
  tagIds: Set<number>;
  componentNames: Set<string>;
}

// =============================================================================
// PROCESSING TYPES
// =============================================================================

/** Processing level that can be either regular or circular */
export interface ProcessingLevel {
  nodes: string[];
  isCyclic: boolean;
}

/** Result from processing a single node */
export interface NodeProcessingResult {
  name: string;
  error?: any;
}

/** Configuration for the push operation */
export interface PushConfig {
  space: string;
  password: string;
  region: RegionCode;
  maxConcurrency: number;
}

/** Graph building context with source and target data */
export interface GraphBuildingContext {
  spaceState: SpaceDataState;
}
