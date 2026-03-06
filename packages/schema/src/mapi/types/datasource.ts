import type { datasource_create, datasource_update } from '../../generated/types';
import type { Prettify } from '../../types/utils';

/**
 * Payload for creating a datasource via the MAPI.
 * `name` and `slug` are required.
 */
export type DatasourceCreate = Prettify<datasource_create>;

/**
 * Payload for updating a datasource via the MAPI.
 * All fields are optional.
 */
export type DatasourceUpdate = Prettify<datasource_update>;
