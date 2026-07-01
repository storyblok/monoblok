import { spawn } from 'node:child_process';
import { join } from 'pathe';
import fs from 'node:fs/promises';
import { saveToFile } from '../../utils/filesystem';
import { appDomains, type RegionCode } from '../../constants';
import { FileSystemError, handleFileSystemError } from '../../utils/error/filesystem-error';
import open from 'open';
import { createOctokit } from '../../github';
import { type Template, templates } from './constants';
import { getUI } from '../../utils/ui';

const ui = getUI({ enabled: true });

/** Repository item from GitHub search API response */
type SearchReposResponse = Awaited<ReturnType<ReturnType<typeof createOctokit>['rest']['search']['repos']>>;
type SearchRepoItem = SearchReposResponse['data']['items'][number];
/**
 * Generates a new project from a Storyblok blueprint template
 * @param blueprint - The blueprint name (react, vue, svelte, etc.)
 * @param projectName - The name of the project directory to create
 * @param targetPath - The target directory path where the project should be created
 * @returns Promise<void>
 */
export const generateProject = async (
  blueprint: string,
  projectName: string,
  targetPath: string = process.cwd(),
): Promise<void> => {
  try {
    const projectPath = join(targetPath, projectName);
    const templateRepo = `storyblok/blueprint-core-${blueprint}`;

    // Check if directory already exists
    try {
      await fs.access(projectPath);
      // If we reach this point, the directory already exists
      // Create a mock ENOTEMPTY error to use with our filesystem error system
      const existsError: NodeJS.ErrnoException = new Error(`Directory ${projectName} already exists`) as NodeJS.ErrnoException;
      existsError.code = 'ENOTEMPTY';
      existsError.path = projectPath;
      throw new FileSystemError('directory_not_empty', 'mkdir', existsError, `Directory ${projectName} already exists`);
    }
    catch (error) {
      const fsError = error as NodeJS.ErrnoException;

      // Directory doesn't exist (ENOENT), which is what we want
      if (fsError.code === 'ENOENT') {
        // Continue with project creation
      }
      else {
        // Handle other filesystem errors using the error handler
        handleFileSystemError('read', fsError);
      }
    }

    // Clone the template repository using degit
    const degitProcess = spawn('npx', ['degit', templateRepo, projectPath], {
      stdio: 'inherit',
      shell: true,
    });

    return new Promise((resolve, reject) => {
      degitProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        }
        else {
          reject(new Error(`Failed to clone template. Process exited with code ${code}`));
        }
      });

      degitProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn degit process: ${error.message}`));
      });
    });
  }
  catch (error) {
    handleFileSystemError('read', error as NodeJS.ErrnoException);
  }
};

/**
 * Creates a .env file in the project directory with Storyblok configuration
 * @param projectPath - The absolute path to the project directory
 * @param storyblokVars - The Storyblok environment variables to include in the .env file
 * @param additionalVars - Optional additional environment variables to include
 * @returns Promise<void>
 */
export const createEnvFile = async (
  projectPath: string,
  storyblokVars: Record<string, string>,
  additionalVars?: Record<string, string>,
): Promise<void> => {
  try {
    const envPath = join(projectPath, '.env');

    // Build the .env content
    let envContent = `# Storyblok Configuration
${Object.entries(storyblokVars).map(([key, value]) => `${key}=${value}`).join('\n')}
`;

    // Add any additional environment variables
    if (additionalVars && Object.keys(additionalVars).length > 0) {
      envContent += '\n# Additional Configuration\n';
      for (const [key, value] of Object.entries(additionalVars)) {
        envContent += `${key}=${value}\n`;
      }
    }

    // Use the filesystem utility to save the file
    await saveToFile(envPath, envContent);
  }
  catch (error) {
    throw new Error(`Failed to create .env file: ${(error as Error).message}`);
  }
};

/**
 * Updates Angular environment files with Storyblok configuration
 * Angular uses TypeScript environment files instead of .env files
 * @param projectPath - The absolute path to the project directory
 * @param token - The Storyblok access token
 * @param region - The Storyblok region code
 * @returns Promise<void>
 */
export const updateAngularEnvironmentFiles = async (
  projectPath: string,
  token?: string,
  region?: RegionCode,
): Promise<void> => {
  const environmentsDir = join(projectPath, 'src', 'environments');
  const envFiles = ['environment.ts', 'environment.development.ts'];

  for (const envFile of envFiles) {
    const filePath = join(environmentsDir, envFile);
    try {
      let content = await fs.readFile(filePath, 'utf-8');

      // Replace placeholder values with actual values
      if (token) {
        content = content.replaceAll('STORYBLOK_DELIVERY_API_TOKEN', token);
      }
      if (region) {
        content = content.replaceAll('STORYBLOK_REGION', region);
      }

      await saveToFile(filePath, content);
    }
    catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      // If file doesn't exist, skip it silently
      if (fsError.code === 'ENOENT') {
        continue;
      }
      throw new Error(`Failed to update ${envFile}: ${(error as Error).message}`);
    }
  }
};

// Helper to create .env file (or Angular environment files) and handle errors
export async function handleEnvFileCreation(resolvedPath: string, token?: string, region?: RegionCode, template?: string): Promise<boolean> {
  // Angular uses TypeScript environment files instead of .env
  if (template === 'angular') {
    if (!token && !region) {
      ui.info('No environment variables to write');
      return true;
    }
    try {
      await updateAngularEnvironmentFiles(resolvedPath, token, region);
      const writtenVars = [token && 'accessToken', region && 'region'].filter(Boolean).join(', ');
      ui.ok(`Updated Angular environment files with: ${writtenVars}`, true);
      return true;
    }
    catch (error) {
      ui.warn(`Failed to update Angular environment files: ${(error as Error).message}`);
      if (token) {
        ui.info(
          `You can manually add accessToken to src/environments/environment.ts and src/environments/environment.development.ts`,
        );
      }
      if (region) {
        ui.info(
          `You can manually add region to src/environments/environment.ts and src/environments/environment.development.ts`,
        );
      }
      return false;
    }
  }

  // Default behavior for other frameworks: create .env file
  const envVars: Record<string, string> = {};
  if (token) {
    envVars.STORYBLOK_DELIVERY_API_TOKEN = token;
  }
  if (region) {
    envVars.STORYBLOK_REGION = region;
  }
  if (Object.keys(envVars).length === 0) {
    ui.info('No environment variables to write');
    return true;
  }
  try {
    await createEnvFile(resolvedPath, envVars);
    const writtenKeys = Object.keys(envVars).join(', ');
    ui.ok(`Created .env file with: ${writtenKeys}`, true);
    return true;
  }
  catch (error) {
    ui.warn(`Failed to create .env file: ${(error as Error).message}`);
    if (token) {
      ui.info(
        `You can manually add STORYBLOK_DELIVERY_API_TOKEN to your .env file.`,
      );
    }
    if (region) {
      ui.info(
        `You can manually add STORYBLOK_REGION to your .env file.`,
      );
    }
    return false;
  }
}

/**
 * Generates the Storyblok app URL for a specific space based on region
 * @param spaceId - The ID of the Storyblok space
 * @param region - The region code (eu, us, cn, ca, ap)
 * @returns The complete URL to the space dashboard
 */
export const generateSpaceUrl = (spaceId: number, region: RegionCode): string => {
  const domain = appDomains[region];

  const utmParams = new URLSearchParams({
    utm_source: 'storyblok-cli',
    utm_medium: 'cli',
    utm_campaign: 'create',
  });
  return `https://${domain}/#/me/spaces/${spaceId}/dashboard?${utmParams.toString()}`;
};

/**
 * Opens the Storyblok space dashboard in the user's default browser
 * @param spaceId - The ID of the Storyblok space
 * @param region - The region code (eu, us, cn, ca, ap)
 * @returns Promise<void>
 */
export const openSpaceInBrowser = async (spaceId: number, region: RegionCode): Promise<void> => {
  try {
    const spaceUrl = generateSpaceUrl(spaceId, region);

    await open(spaceUrl);
  }
  catch (error) {
    throw new Error(`Failed to open space in browser: ${(error as Error).message}`);
  }
};

/**
 * Extracts port from repository topics
 * @param topics - Array of repository topics
 * @returns Port number as string, defaults to '3000' if not found
 */
export const extractPortFromTopics = (topics: string[]): string => {
  const portTopic = topics.find(topic => topic.startsWith('port-'));
  if (portTopic) {
    const port = portTopic.replace('port-', '');
    // Validate that it's a valid port number
    if (/^\d+$/.test(port) && Number.parseInt(port) > 0 && Number.parseInt(port) <= 65535) {
      return port;
    }
  }
  return '3000'; // Default fallback port
};

/**
 * Converts a GitHub repository to the format expected by the CLI
 * Uses static template name and location as priority if available
 * @param repo - GitHub repository data from search API
 * @returns Formatted blueprint object
 */
export const repositoryToTemplate = (repo: SearchRepoItem): Template => {
  const technology = repo.name.replace('blueprint-core-', '');
  const port = extractPortFromTopics(repo.topics || []);
  const staticTemplate = templates[technology.toUpperCase() as keyof typeof templates];

  return {
    // Prioritize static template name over derived name
    name: staticTemplate?.name || technology.charAt(0).toUpperCase() + technology.slice(1),
    value: technology,
    template: repo.clone_url,
    // Prioritize static template location over topic-derived port
    location: staticTemplate?.location || (port ? `https://localhost:${port}/` : 'https://localhost:3000/'),
    description: repo.description,
    updated_at: repo.updated_at,
    stars: repo.stargazers_count,
  };
};

export const fetchBlueprintRepositories = async (): Promise<Template[]> => {
  try {
    const octokit = createOctokit();

    // Search for repositories matching the blueprint pattern
    const { data } = await octokit.rest.search.repos({
      q: 'org:storyblok blueprint-core-',
      sort: 'updated',
      order: 'desc',
      per_page: 100,
    });

    // Filter and convert repositories to blueprints
    const blueprints = data.items
      .filter(repo => repo.name.startsWith('blueprint-core-'))
      .map(repositoryToTemplate)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0));

    return blueprints;
  }
  catch {
    ui.warn('Failed to fetch blueprints from GitHub. Using offline template list.');
    return Object.values(templates);
  }
};
