import type { component_create, component_update } from '../../generated/types';
import type { Prettify } from '../../types/utils';

/**
 * Payload for creating a component via the MAPI.
 * `name` is required; `schema` is typed as a generic record when provided.
 */
export type ComponentCreate = Prettify<component_create>;

/**
 * Payload for updating a component via the MAPI.
 * All fields are optional.
 */
export type ComponentUpdate = Prettify<component_update>;
