import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

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
      throw new Error(`Directory ${projectName} already exists`);
    }
    catch (error) {
      // Directory doesn't exist, which is what we want
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
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
    throw new Error(`Failed to generate project ${projectName}: ${(error as Error).message}`);
  }
};
