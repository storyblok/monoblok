import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { saveToFile } from '../../utils/filesystem';
import { appDomains, type RegionCode } from '../../constants';
import { FileSystemError, handleFileSystemError } from '../../utils/error/filesystem-error';
import open from 'open';
import { createOctokit } from '../../github';
import { handleAPIError } from '../../utils';
import type { DynamicBlueprint } from './constants';
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
    const projectPath = path.join(targetPath, projectName);
    const templateRepo = `storyblok/blueprint-starter-${blueprint}`;

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
 * @param accessToken - The Storyblok access token to include in the .env file
 * @param additionalVars - Optional additional environment variables to include
 * @returns Promise<void>
 */
export const createEnvFile = async (
  projectPath: string,
  accessToken: string,
  additionalVars?: Record<string, string>,
): Promise<void> => {
  try {
    const envPath = path.join(projectPath, '.env');

    // Build the .env content
    let envContent = `# Storyblok Configuration
STORYBLOK_DELIVERY_API_TOKEN=${accessToken}
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
 * Generates the Storyblok app URL for a specific space based on region
 * @param spaceId - The ID of the Storyblok space
 * @param region - The region code (eu, us, cn, ca, ap)
 * @returns The complete URL to the space dashboard
 */
export const generateSpaceUrl = (spaceId: number, region: RegionCode): string => {
  const domain = appDomains[region];
  return `https://${domain}/#/me/spaces/${spaceId}/dashboard`;
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
 * @param repo - GitHub repository data
 * @returns Formatted blueprint object
 */
export const repositoryToBlueprint = (repo: any): DynamicBlueprint => {
  const technology = repo.name.replace('blueprint-starter-', '');
  const port = extractPortFromTopics(repo.topics || []);

  return {
    name: technology.charAt(0).toUpperCase() + technology.slice(1),
    value: technology,
    template: repo.clone_url,
    location: port ? `https://localhost:${port}/` : 'https://localhost:3000/',
    description: repo.description,
    updated_at: repo.updated_at,
  };
};

export const fetchBlueprintRepositories = async () => {
  try {
    const octokit = createOctokit();

    // Search for repositories matching the blueprint pattern
    const { data } = await octokit.rest.search.repos({
      q: 'org:storyblok blueprint-starter-',
      sort: 'updated',
      order: 'desc',
      per_page: 100,
    });

    // Filter and convert repositories to blueprints
    const blueprints = data.items
      .filter(repo => repo.name.startsWith('blueprint-starter-'))
      .map(repositoryToBlueprint)
      .sort((a, b) => a.name.localeCompare(b.name));

    return blueprints;
  }
  catch (error) {
    // Fallback to hardcoded blueprints if GitHub search fails
    handleAPIError('fetch_blueprints', error as Error, 'Failed to fetch blueprints from GitHub');
  }
};
