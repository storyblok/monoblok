import type { Component, ComponentFolder, Datasource } from '../../types';

/**
 * Local schema loaded from the user's TypeScript entry file: blocks, datasource
 * definitions, and the block folders (component groups) they declare. A block's
 * group membership is diffed and pushed only when it opts in via a `folder`
 * key; blocks without one stay unmanaged and their remote group is left as-is.
 */
/** A locally defined block folder in slug-path identity space. */
export interface LocalFolder {
  /** Display name used when the group must be created. */
  name: string;
  /** Slugified name path — the folder's identity. */
  path: string;
  parentPath: string | null;
}

export interface SchemaData {
  components: Component[];
  folders: LocalFolder[];
  datasources: Datasource[];
}

/** Remote state fetched from the Storyblok space. */
export interface RemoteSchemaData {
  components: Map<string, Component>;
  componentFolders: Map<string, ComponentFolder>;
  datasources: Map<string, Datasource>;
}

/**
 * A schema reduced to name-keyed maps — the common shape both a local file and a
 * remote space resolve to. `diffSchema` compares two of these regardless of where
 * each side came from.
 */
export interface NormalizedSchema {
  components: Map<string, Component>;
  datasources: Map<string, Datasource>;
  /** Block folders (component groups) keyed by slug path — the folder's identity. */
  folders: Map<string, LocalFolder>;
}

export type DiffAction = 'create' | 'update' | 'unchanged' | 'stale';

export interface EntityDiff {
  type: 'component' | 'datasource' | 'folder';
  name: string;
  action: DiffAction;
  /** Field-level changes; populated for `update`, empty for other actions. */
  changes: FieldChange[];
  /** Raw source-side (`from`) entity, or null when the entity is created (target-only). */
  before: Record<string, unknown> | null;
  /** Raw target-side (`to`) entity, or null when the entity is stale (source-only). */
  after: Record<string, unknown> | null;
}

export interface DiffResult {
  diffs: EntityDiff[];
  creates: number;
  updates: number;
  unchanged: number;
  stale: number;
}

export interface FieldChange {
  field: string;
  change: 'added' | 'removed' | 'modified';
  before?: unknown;
  after?: unknown;
}

export interface ChangesetEntry {
  type: 'component' | 'datasource' | 'folder';
  name: string;
  action: 'create' | 'update' | 'delete';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fieldChanges?: FieldChange[];
}

/** Persisted record of a push operation. Contains the full pre-push remote state for rollback and a list of what changed. */
export interface ChangesetData {
  timestamp: string;
  spaceId: number;
  /** Full pre-push remote state — used to roll back if needed. */
  remote: {
    components: Component[];
    componentFolders: ComponentFolder[];
    datasources: Datasource[];
  };
  changes: ChangesetEntry[];
}
