import type { DatasourceCreate as DatasourceCreateGenerated, DatasourceUpdate as DatasourceUpdateGenerated } from '../../generated/mapi-types';
import type { Prettify } from '../../types/utils';

/**
 * Payload for creating a datasource via the MAPI.
 * `name` and `slug` are required.
 */
export type DatasourceCreate = Prettify<DatasourceCreateGenerated>;

/**
 * Payload for updating a datasource via the MAPI.
 * All fields are optional.
 */
export type DatasourceUpdate = Prettify<DatasourceUpdateGenerated>;
