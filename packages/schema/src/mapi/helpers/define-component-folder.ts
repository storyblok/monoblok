import type { ComponentFolder, ComponentFolderCreate, ComponentFolderUpdate } from '../types/component-folder';

const COMPONENT_FOLDER_DEFAULTS = {
  id: 1,
  uuid: '',
};

type ComponentFolderInput = { name: string } & Partial<Omit<ComponentFolder, 'name'>>;

/**
 * Defines a component folder for the MAPI.
 * API-assigned fields (`id`, `uuid`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineComponentFolder } from '@storyblok/schema/mapi';
 * const folder = defineComponentFolder({ name: 'Layout' });
 */
export const defineComponentFolder = (componentFolder: ComponentFolderInput): ComponentFolder => ({
  ...COMPONENT_FOLDER_DEFAULTS,
  ...componentFolder,
});

/**
 * Defines a component folder creation payload for the MAPI.
 *
 * @example
 * import { defineComponentFolderCreate } from '@storyblok/schema/mapi';
 * const payload = defineComponentFolderCreate({ name: 'Layout' });
 */
export const defineComponentFolderCreate = (componentFolder: ComponentFolderCreate): ComponentFolderCreate => componentFolder;

/**
 * Defines a component folder update payload for the MAPI.
 *
 * @example
 * import { defineComponentFolderUpdate } from '@storyblok/schema/mapi';
 * const payload = defineComponentFolderUpdate({ name: 'Updated Layout' });
 */
export const defineComponentFolderUpdate = (componentFolder: ComponentFolderUpdate): ComponentFolderUpdate => componentFolder;
