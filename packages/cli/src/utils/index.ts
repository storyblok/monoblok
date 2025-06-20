import { fileURLToPath } from 'node:url';
import { dirname } from 'pathe';
import type { RegionCode } from '../constants';
import { regions } from '../constants';

export * from './auth';
export * from './error/';
export * from './format';
export * from './konsola';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

export function isRegion(value: RegionCode): value is RegionCode {
  return Object.values(regions).includes(value);
}

export function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

export const isVitest = process.env.VITEST === 'true';
