import { resolvePath, saveToFile } from '../../../utils/filesystem';
import type { SpaceComponent } from '../../components/constants';
import { join, resolve } from 'node:path';
import { handleFileSystemError } from '../../../utils';

const getMigrationTemplate = () => {
  return `export default function (block) {
  // Example to change a string to boolean
  // block.field_name = !!(block.field_name)

  // Example to transfer content from other field
  // block.target_field = block.source_field

  // Example to transform an array
  // block.array_field = block.array_field.map(item => ({ ...item, new_prop: 'value' }))

  return block;
}
`;
};

export const generateMigration = async (space: string, path: string | undefined, component: SpaceComponent, suffix?: string) => {
  const resolvedPath = path
    ? resolve(process.cwd(), path, 'migrations', space)
    : resolvePath(path, `migrations/${space}`);

  const fileName = suffix ? `${component.name}.${suffix}.js` : `${component.name}.js`;
  const migrationPath = join(resolvedPath, fileName);

  try {
    await saveToFile(migrationPath, getMigrationTemplate());
  }
  catch (error) {
    handleFileSystemError('write', error as Error);
  }
};
