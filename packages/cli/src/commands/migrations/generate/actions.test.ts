import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMigration } from './actions';
import { resolvePath, saveToFile } from '../../../utils/filesystem';
import { join, resolve } from 'node:path';
import { handleFileSystemError } from '../../../utils';
import type { SpaceComponent } from '../../components';

// Mock the filesystem utils
vi.mock('../../../utils/filesystem', () => ({
  saveToFile: vi.fn(),
  resolvePath: vi.fn(),
}));

// Mock the error handler
vi.mock('../../../utils', () => ({
  handleFileSystemError: vi.fn(),
}));

describe('generateMigration', () => {
  const mockSpace = '295017';
  const mockPath = '';
  const mockComponent: SpaceComponent = {
    name: 'test_component',
    display_name: 'Test Component',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    id: 1,
    schema: {
      fullname: {
        type: 'text',
        pos: 0,
      },
      email: {
        type: 'text',
        pos: 1,
      },
    },
    color: null,
    internal_tags_list: [],
    internal_tag_ids: [],
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    // Mock implementation for resolvePath
    vi.mocked(resolvePath).mockImplementation((_, path) => join(process.cwd(), '.storyblok', path));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should generate migration file with correct template', async () => {
    // Arrange
    const expectedPath = join(process.cwd(), '.storyblok', `migrations/${mockSpace}`);
    const expectedFilePath = join(expectedPath, `${mockComponent.name}.js`);

    const expectedTemplate = `export default function (block) {
  // Example to change a string to boolean
  // block.field_name = !!(block.field_name)

  // Example to transfer content from other field
  // block.target_field = block.source_field

  // Example to transform an array
  // block.array_field = block.array_field.map(item => ({ ...item, new_prop: 'value' }))

  return block;
}
`;

    // Act
    await generateMigration(mockSpace, mockPath, mockComponent);

    // Assert
    expect(saveToFile).toHaveBeenCalledWith(expectedFilePath, expectedTemplate);
  });

  it('should use custom path when provided', async () => {
    // Arrange
    const customPath = '/custom/path';
    const expectedPath = resolve(process.cwd(), customPath, 'migrations', mockSpace);
    const expectedFilePath = join(expectedPath, `${mockComponent.name}.js`);

    // Act
    await generateMigration(mockSpace, customPath, mockComponent);

    // Assert
    expect(saveToFile).toHaveBeenCalledTimes(1);
    expect(saveToFile).toHaveBeenCalledWith(
      expectedFilePath,
      expect.any(String),
    );
  });

  it('should handle filesystem errors properly', async () => {
    // Arrange
    const mockError = new Error('Failed to write file');
    vi.mocked(saveToFile).mockRejectedValueOnce(mockError);

    // Act
    await generateMigration(mockSpace, mockPath, mockComponent);

    // Assert
    expect(handleFileSystemError).toHaveBeenCalledWith('write', mockError);
  });
});
