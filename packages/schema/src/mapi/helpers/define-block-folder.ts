import type { ComponentFolder, ComponentFolderCreate, ComponentFolderUpdate } from '../../generated/mapi-types';

export type { ComponentFolder, ComponentFolderCreate, ComponentFolderUpdate };

const BLOCK_FOLDER_DEFAULTS = {
  id: 1,
  uuid: '',
};

type BlockFolderInput = { name: string } & Partial<Omit<ComponentFolder, 'name'>>;

/**
 * Defines a block folder for the MAPI.
 * API-assigned fields (`id`, `uuid`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineBlockFolder } from '@storyblok/schema/mapi';
 * const folder = defineBlockFolder({ name: 'Layout' });
 */
export const defineBlockFolder = (blockFolder: BlockFolderInput): ComponentFolder => ({
  ...BLOCK_FOLDER_DEFAULTS,
  ...blockFolder,
});

/**
 * Defines a block folder creation payload for the MAPI.
 *
 * @example
 * import { defineBlockFolderCreate } from '@storyblok/schema/mapi';
 * const payload = defineBlockFolderCreate({ name: 'Layout' });
 */
export const defineBlockFolderCreate = (blockFolder: ComponentFolderCreate): ComponentFolderCreate => blockFolder;

/**
 * Defines a block folder update payload for the MAPI.
 *
 * @example
 * import { defineBlockFolderUpdate } from '@storyblok/schema/mapi';
 * const payload = defineBlockFolderUpdate({ name: 'Updated Layout' });
 */
export const defineBlockFolderUpdate = (blockFolder: ComponentFolderUpdate): ComponentFolderUpdate => blockFolder;
