import type { ComponentCreate, ComponentFolderCreate, ComponentUpdate, Datasource, DatasourceCreate, Field } from '../../types';
import { isRecord } from './utils';

function isSchemaField(value: unknown): value is Field {
  return isRecord(value) && 'type' in value;
}

/** Converts a Component's schema (which includes _uid/component sentinels) to a clean record. */
function toSchemaRecord(schema: Record<string, unknown>): Record<string, Field> {
  const result: Record<string, Field> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '_uid' || key === 'component' || !isSchemaField(value)) { continue; }
    result[key] = value;
  }
  return result;
}

/** Builds the shared component payload fields used for both create and update. */
function buildComponentPayload(input: unknown) {
  if (!isRecord(input)) { return { name: '' }; }

  return {
    name: typeof input.name === 'string' ? input.name : '',
    // Fields in COMPONENT_DEFAULTS are always sent with their reset value so that
    // removing a field from the local schema actually clears it on the API.
    // (Root-level fields are additive on MAPI update — omitting preserves the old value.)
    display_name: typeof input.display_name === 'string' ? input.display_name : '',
    description: typeof input.description === 'string' ? input.description : '',
    color: typeof input.color === 'string' ? input.color : '',
    icon: typeof input.icon === 'string' ? input.icon : '',
    preview_field: typeof input.preview_field === 'string' ? input.preview_field : '',
    internal_tag_ids: Array.isArray(input.internal_tag_ids) ? input.internal_tag_ids : [],
    // Conditionally sent: only included when explicitly set in local schema
    ...(isRecord(input.schema) && { schema: toSchemaRecord(input.schema) }),
    ...(typeof input.is_root === 'boolean' && { is_root: input.is_root }),
    ...(typeof input.is_nestable === 'boolean' && { is_nestable: input.is_nestable }),
    ...(typeof input.component_group_uuid === 'string' && { component_group_uuid: input.component_group_uuid }),
  };
}

/** Converts an unknown input to a ComponentCreate-compatible payload. */
export function toComponentCreate(input: unknown): ComponentCreate {
  return buildComponentPayload(input) satisfies ComponentCreate;
}

/** Converts an unknown input to a ComponentUpdate-compatible payload. */
export function toComponentUpdate(input: unknown): ComponentUpdate {
  return buildComponentPayload(input) satisfies ComponentUpdate;
}

/** Converts an unknown input to a ComponentFolderCreate-compatible payload. */
export function toComponentFolderCreate(input: unknown): ComponentFolderCreate {
  if (!isRecord(input)) { return { name: '' }; }

  return {
    name: typeof input.name === 'string' ? input.name : '',
    ...(typeof input.parent_id === 'number' && { parent_id: input.parent_id }),
  } satisfies ComponentFolderCreate;
}

/** Converts an unknown input to a DatasourceCreate-compatible payload. */
export function toDatasourceCreate(input: unknown): DatasourceCreate {
  if (!isRecord(input)) { return { name: '', slug: '' }; }

  const result: DatasourceCreate = {
    name: typeof input.name === 'string' ? input.name : '',
    slug: typeof input.slug === 'string' ? input.slug : '',
  };

  if (Array.isArray(input.dimensions)) {
    result.dimensions_attributes = input.dimensions
      .filter((d: unknown) => isRecord(d) && typeof d.name === 'string' && typeof d.entry_value === 'string')
      .map((d: Record<string, unknown>) => ({
        name: d.name as string,
        entry_value: d.entry_value as string,
      }));
  }

  return result;
}

/**
 * Builds a datasource update payload that handles dimension deletions.
 * The Storyblok API requires `{ id, _destroy: true }` to remove dimensions;
 * an empty `dimensions_attributes` array is a no-op.
 */
export function toDatasourceUpdate(input: unknown, remote: Datasource): Record<string, unknown> {
  const base = toDatasourceCreate(input);
  const localDims = base.dimensions_attributes ?? [];
  const remoteDims = remote.dimensions ?? [];

  if (remoteDims.length === 0) { return base; }

  const localKeys = new Set(localDims.map(d => `${d.name}::${d.entry_value}`));
  const destroyEntries = remoteDims
    .filter(rd => rd.id != null && !localKeys.has(`${rd.name}::${rd.entry_value}`))
    .map(rd => ({ id: rd.id, _destroy: true }));

  if (destroyEntries.length > 0) {
    return {
      ...base,
      dimensions_attributes: [...localDims, ...destroyEntries],
    };
  }

  return base;
}
