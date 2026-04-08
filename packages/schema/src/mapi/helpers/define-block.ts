import type { ComponentCreate, ComponentUpdate } from '../../generated/mapi-types';

export type { ComponentCreate, ComponentUpdate };

/**
 * Defines a block creation payload for the MAPI.
 *
 * @example
 * const payload = defineBlockCreate({
 *   name: 'page',
 *   schema: {
 *     // ...
 *   },
 * });
 */
export const defineBlockCreate = (
  block: ComponentCreate,
): ComponentCreate => block;

/**
 * Defines a block update payload for the MAPI.
 *
 * @example
 * const payload = defineBlockUpdate({
 *   display_name: 'Page',
 * });
 */
export const defineBlockUpdate = (
  block: ComponentUpdate,
): ComponentUpdate => block;
