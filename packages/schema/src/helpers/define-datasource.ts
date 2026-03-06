import type { Datasource } from '../types/datasource';

/**
 * Defines a datasource object with type safety.
 * Returns the input as-is, validated against the Datasource type.
 */
export const defineDatasource = (datasource: Datasource): Datasource => datasource;
