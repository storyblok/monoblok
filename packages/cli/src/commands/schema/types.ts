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

export type DiffAction = 'create' | 'update' | 'unchanged' | 'stale';

export interface EntityDiff {
  type: 'component' | 'datasource' | 'folder';
  name: string;
  action: DiffAction;
  diff: string | null;
  local: Record<string, unknown> | null;
  remote: Record<string, unknown> | null;
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
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
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
