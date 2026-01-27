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
 * @param options - Optional filter options
 * @param options.space - The space ID to filter by
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
