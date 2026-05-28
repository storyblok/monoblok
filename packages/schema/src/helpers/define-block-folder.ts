import type { ComponentFolder, ComponentFolderCreate, ComponentFolderUpdate } from '../generated/mapi/types.gen';

export type { ComponentFolder, ComponentFolderCreate, ComponentFolderUpdate };

const BLOCK_FOLDER_DEFAULTS = {
  id: 1,
  uuid: '',
  parent_id: null,
  parent_uuid: null,
};

type BlockFolderInput = { name: string } & Partial<Omit<ComponentFolder, 'name'>>;

/**
 * Defines a block folder for the MAPI.
 * API-assigned fields (`id`, `uuid`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineBlockFolder } from '@storyblok/schema';
 * const folder = defineBlockFolder({ name: 'Layout' });
 */
export const defineBlockFolder = (blockFolder: BlockFolderInput): ComponentFolder => ({
  ...BLOCK_FOLDER_DEFAULTS,
  ...blockFolder,
  parent_id: blockFolder.parent_id ?? BLOCK_FOLDER_DEFAULTS.parent_id,
  parent_uuid: blockFolder.parent_uuid ?? BLOCK_FOLDER_DEFAULTS.parent_uuid,
});

/**
 * Defines a block folder creation payload for the MAPI.
 *
 * @example
 * import { defineBlockFolderCreate } from '@storyblok/schema';
 * const payload = defineBlockFolderCreate({ name: 'Layout' });
 */
export const defineBlockFolderCreate = (blockFolder: ComponentFolderCreate): ComponentFolderCreate => blockFolder;

/**
 * Defines a block folder update payload for the MAPI.
 *
 * @example
 * import { defineBlockFolderUpdate } from '@storyblok/schema';
 * const payload = defineBlockFolderUpdate({ name: 'Updated Layout' });
 */
export const defineBlockFolderUpdate = (blockFolder: ComponentFolderUpdate): ComponentFolderUpdate => blockFolder;
