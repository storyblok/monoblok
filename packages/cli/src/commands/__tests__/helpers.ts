import { vol } from 'memfs';

/**
 * Default space ID used across tests.
 */
export const DEFAULT_SPACE = '12345';

/**
 * Global ID generator for tests.
 * Each call increments and returns a unique ID.
 */
let id = 0;
export const getID = () => {
  id += 1;
  return id;
};

/*
 * NOTE: Session and config store mocks cannot be exported and used with vi.mock()
 * because vi.mock() is hoisted to the top of the file and cannot reference imported variables.
 *
 * Instead, copy-paste these mocks directly in your test files:
 *
 * Session mock (preconditions.isLoggedIn):
 * ```
 * vi.mock('../../../session', () => ({
 *   session: vi.fn(() => ({
 *     state: {
 *       isLoggedIn: true,
 *       password: 'valid-token',
 *       region: 'eu',
 *     },
 *     initializeSession: vi.fn().mockResolvedValue(undefined),
 *   })),
 * }));
 * ```
 *
 * Config store mock (disables maxConcurrency for faster tests):
 * ```
 * vi.mock('../../../lib/config/store', async (importOriginal) => {
 *   const actual = await importOriginal<typeof import('../../../lib/config/store')>();
 *   return {
 *     ...actual,
 *     setActiveConfig: (config: import('../../../lib/config/types').ResolvedCliConfig) =>
 *       actual.setActiveConfig({ ...config, api: { ...config.api, maxConcurrency: -1 } }),
 *   };
 * });
 * ```
 */

/**
 * MockComponent interface used for component mocking in tests.
 */
export interface MockComponent {
  name: string;
  schema: Record<string, unknown>;
  component_group_uuid: string | null;
}

/**
 * Factory function to create mock components.
 */
export const makeMockComponent = (overrides: Partial<MockComponent> = {}): MockComponent => {
  return {
    name: 'component',
    schema: {},
    component_group_uuid: null,
    ...overrides,
  };
};

/**
 * Gets log file contents from the virtual file system.
 * @param logPrefix - The prefix to match (e.g., 'storyblok-assets-pull-')
 * @param options.space - Optional space to filter by
 */
export const getLogFileContents = (
  logPrefix: string,
  options: { space?: string } = {},
) => {
  const { space } = options;

  return Object.entries(vol.toJSON())
    .find(([filename]) => {
      const matchesPrefix = filename.includes(logPrefix);
      const matchesSpace = space ? filename.includes(`/${space}/`) : true;
      return matchesPrefix && matchesSpace;
    })?.[1];
};

/**
 * Gets report file contents from the virtual file system.
 * @param reportPrefix - The prefix to match (e.g., 'storyblok-assets-push-')
 * @param space - The space ID to filter by
 */
export const getReport = (reportPrefix: string, space: string = DEFAULT_SPACE) => {
  const reportFile = Object.entries(vol.toJSON())
    .find(([filename]) => filename.includes(`reports/${space}/${reportPrefix}`))?.[1];

  return reportFile ? JSON.parse(reportFile) : undefined;
};
