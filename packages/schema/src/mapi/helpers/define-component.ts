import type { ComponentCreate, ComponentUpdate } from '../types/component';

/**
 * Defines a component creation payload for the MAPI.
 *
 * @example
 * import { defineComponentCreate } from '@storyblok/schema/mapi';
 * const payload = defineComponentCreate({ name: 'page', schema: { ... } });
 */
export const defineComponentCreate = (
  component: ComponentCreate,
): ComponentCreate => component;

/**
 * Defines a component update payload for the MAPI.
 *
 * @example
 * import { defineComponentUpdate } from '@storyblok/schema/mapi';
 * const payload = defineComponentUpdate({ display_name: 'Page' });
 */
export const defineComponentUpdate = (
  component: ComponentUpdate,
): ComponentUpdate => component;
