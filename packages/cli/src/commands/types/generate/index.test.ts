import { beforeEach, describe, expect, it, vi } from 'vitest';
import { konsola } from '../../../utils';
import { generateStoryblokTypes, generateTypes } from './actions';
import chalk from 'chalk';
import { colorPalette } from '../../../constants';
// Import the main module first to ensure proper initialization
import '../index';
import { typesCommand } from '../command';
import { readComponentsFiles } from '../../components/push/actions';
import { generateSchemaTypes } from './schema-types';

const uiTitleMock = vi.hoisted(() => vi.fn());
const uiWarnMock = vi.hoisted(() => vi.fn());
const uiInfoMock = vi.hoisted(() => vi.fn());
const uiOkMock = vi.hoisted(() => vi.fn());
const uiBrMock = vi.hoisted(() => vi.fn());
const uiSpinnerSucceedMock = vi.hoisted(() => vi.fn());
const uiSpinnerFailedMock = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/ui', () => ({
  getUI: () => ({
    title: uiTitleMock,
    warn: uiWarnMock,
    info: uiInfoMock,
    ok: uiOkMock,
    br: uiBrMock,
    createSpinner: () => ({ start: vi.fn(), succeed: uiSpinnerSucceedMock, failed: uiSpinnerFailedMock }),
  }),
}));

vi.mock('./schema-types', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    generateSchemaTypes: vi.fn(),
  };
});

const mockResponse = [{
  name: 'component-name',
  display_name: 'Component Name',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12345,
  schema: { type: 'object' },
  color: undefined,
  internal_tags_list: [],
  internal_tag_ids: [],
}];

const mockSpaceData = {
  components: mockResponse,
  groups: [],
  presets: [],
  internalTags: [],
  datasources: [],
};

vi.mock('./actions', () => ({
  generateStoryblokTypes: vi.fn(),
  generateTypes: vi.fn(),
  getComponentType: vi.fn(),
}));

vi.mock('../../components/push/actions', () => ({
  readComponentsFiles: vi.fn(),
}));

vi.mock('../../../utils', async () => {
  const actualUtils = await vi.importActual('../../../utils');
  return {
    ...actualUtils,
    isVitestRunning: true,
    konsola: {
      ok: vi.fn(),
      title: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      br: vi.fn(),
    },
    handleError: (error: unknown, header = false) => {
      konsola.error(error as string, header);
      // Optionally, prevent process.exit during tests
    },
  };
});

describe('types generate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Fix the linter errors by using a type assertion
    (typesCommand as any)._optionValues = {};
    (typesCommand as any)._optionValueSources = {};
    for (const command of typesCommand.commands) {
      (command as any)._optionValues = {};
      (command as any)._optionValueSources = {};
    }
  });

  describe('default mode', () => {
    it('should prompt the user if the operation was sucessfull', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);

      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345']);

      expect(generateStoryblokTypes).toHaveBeenCalledWith({
        path: undefined,
      });

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({}));

      expect(konsola.ok).toHaveBeenCalledWith(`Successfully generated types for space ${chalk.hex(colorPalette.PRIMARY)('12345')}`, true);
    });

    it('should pass strict mode option to generateTypes when --strict flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--strict']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        strict: true,
      }));
    });

    it('should pass typePrefix option to generateTypes when --type-prefix flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--type-prefix', 'Custom']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        typePrefix: 'Custom',
      }));
    });

    it('should pass typeSuffix option to generateTypes when --type-suffix flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--type-suffix', 'CustomTypeSuffix']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        typeSuffix: 'CustomTypeSuffix',
      }));
    });

    it('should pass suffix option to generateTypes when --suffix flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--suffix', 'Component']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        suffix: 'Component',
      }));
    });

    it('should pass separateFiles option to generateTypes when --separate-files flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--separate-files']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        separateFiles: true,
      }));
    });

    it('should not pass separateFiles to readComponentsFiles even when --separate-files flag is used (auto-detect input)', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--separate-files']);

      expect(readComponentsFiles).toHaveBeenCalledWith(expect.not.objectContaining({
        separateFiles: true,
      }));
    });

    it('should not pass separateFiles to readComponentsFiles in default mode', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345']);

      expect(readComponentsFiles).toHaveBeenCalledWith(expect.not.objectContaining({
        separateFiles: expect.anything(),
      }));
    });

    it('should pass suffix to readComponentsFiles when --suffix flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--suffix', 'dev']);

      expect(readComponentsFiles).toHaveBeenCalledWith(expect.objectContaining({
        suffix: 'dev',
      }));
    });

    it('should pass customFieldsParser option to generateTypes when --custom-fields-parser flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--custom-fields-parser', '/path/to/parser.ts']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        customFieldsParser: '/path/to/parser.ts',
      }));
    });

    it('should pass compilerOptions option to generateTypes when --compiler-options flag is used', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345', '--compiler-options', '/path/to/options.json']);

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({
        compilerOptions: '/path/to/options.json',
      }));
    });

    it('warns that the legacy generator is deprecated when --future-schema is absent', async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue('// Generated types');

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '12345']);

      expect(konsola.warn).toHaveBeenCalledWith(expect.stringContaining('--future-schema'));
    });
  });

  describe('future-schema mode', () => {
    it('rejects legacy-only flags when --future-schema is used', async () => {
      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '295018', '--future-schema', '--strict']);

      expect(konsola.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('--strict') }),
        false,
      );
    });

    it('generates schema types and reports success, per-file output, and unmapped field types', async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: ['/project/.storyblok/types/295018/storyblok-schema.d.ts'],
        unmappedFieldTypes: ['storyblok-colorpicker'],
      });

      await typesCommand.parseAsync(['node', 'test', 'generate', '--space', '295018', '--future-schema']);

      expect(uiSpinnerSucceedMock).toHaveBeenCalled();
      expect(uiOkMock).toHaveBeenCalledWith('/project/.storyblok/types/295018/storyblok-schema.d.ts');
      expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining('storyblok-colorpicker'));
      expect(uiInfoMock).toHaveBeenCalledWith(expect.stringContaining('@storyblok/schema'));
      expect(uiSpinnerFailedMock).not.toHaveBeenCalled();
    });
  });
});
