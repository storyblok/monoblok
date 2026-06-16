import type { Component, ComponentFolder, Datasource, DatasourceEntry, Preset } from '../../types';

/** Local schema loaded from the user's TypeScript entry file. */
export interface SchemaData {
  components: Component[];
  /** Component groups derived from the directory layout (name-only; parent encoded by the hierarchy). */
  componentFolders: ComponentFolder[];
  datasources: Datasource[];
  /** Block name → its group path segments (from the `components/` directory layout). */
  folderPathByComponentName: Map<string, string[]>;
  /** Block name → its inline `presets`, lifted off for reconciliation. */
  presetsByComponentName: Map<string, Preset[]>;
  /** Datasource name → its inline `entries`, lifted off for reconciliation. */
  entriesByDatasourceName: Map<string, DatasourceEntry[]>;
}

/** Remote state fetched from the Storyblok space. */
export interface RemoteSchemaData {
  components: Map<string, Component>;
  componentFolders: Map<string, ComponentFolder>;
  datasources: Map<string, Datasource>;
}

export type DiffAction = 'create' | 'update' | 'unchanged' | 'stale';

export interface EntityDiff {
  type: 'component' | 'componentFolder' | 'datasource';
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
  type: 'component' | 'componentFolder' | 'datasource';
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
