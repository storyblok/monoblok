import type { DatasourceCreate, DatasourceUpdate } from '../types/datasource';

/**
 * Defines a datasource creation payload for the MAPI.
 *
 * @example
 * import { defineDatasourceCreate } from '@storyblok/schema/mapi';
 * const payload = defineDatasourceCreate({ name: 'Colors', slug: 'colors' });
 */
export const defineDatasourceCreate = (
  datasource: DatasourceCreate,
): DatasourceCreate => datasource;

/**
 * Defines a datasource update payload for the MAPI.
 *
 * @example
 * import { defineDatasourceUpdate } from '@storyblok/schema/mapi';
 * const payload = defineDatasourceUpdate({ name: 'Updated Colors' });
 */
export const defineDatasourceUpdate = (
  datasource: DatasourceUpdate,
): DatasourceUpdate => datasource;
