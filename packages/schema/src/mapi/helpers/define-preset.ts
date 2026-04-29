import type { Preset, PresetCreate, PresetUpdate } from '../../generated/mapi-types';

export type { Preset, PresetCreate, PresetUpdate };

const PRESET_DEFAULTS = {
  id: 1,
};

type PresetInput = { name: string; component_id: number } & Partial<Omit<Preset, 'name' | 'component_id'>>;

/**
 * Defines a preset for the MAPI.
 * API-assigned fields (`id`) are optional and filled with safe defaults.
 *
 * @example
 * import { definePreset } from '@storyblok/schema/mapi';
 * const preset = definePreset({ name: 'Hero Dark', component_id: 42 });
 */
export const definePreset = (preset: PresetInput): Preset => ({ ...PRESET_DEFAULTS, ...preset });

/**
 * Defines a preset creation payload for the MAPI.
 *
 * @example
 * import { definePresetCreate } from '@storyblok/schema/mapi';
 * const payload = definePresetCreate({ name: 'Hero Dark', component_id: 42 });
 */
export const definePresetCreate = (preset: PresetCreate): PresetCreate => preset;

/**
 * Defines a preset update payload for the MAPI.
 *
 * @example
 * import { definePresetUpdate } from '@storyblok/schema/mapi';
 * const payload = definePresetUpdate({ name: 'Hero Light' });
 */
export const definePresetUpdate = (preset: PresetUpdate): PresetUpdate => preset;
