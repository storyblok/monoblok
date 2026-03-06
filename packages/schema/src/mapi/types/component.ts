import type { ComponentCreate as ComponentCreateGenerated, ComponentUpdate as ComponentUpdateGenerated } from '../../generated/mapi-types';
import type { Prettify } from '../../types/utils';

/**
 * Payload for creating a component via the MAPI.
 * `name` is required; `schema` is typed as a generic record when provided.
 */
export type ComponentCreate = Prettify<ComponentCreateGenerated>;

/**
 * Payload for updating a component via the MAPI.
 * All fields are optional.
 */
export type ComponentUpdate = Prettify<ComponentUpdateGenerated>;
