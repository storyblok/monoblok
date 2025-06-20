import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Build the signup URL with UTM parameters
 */
export function buildSignupUrl(): string {
  const baseUrl = 'https://app.storyblok.com';

  const utmParams = new URLSearchParams({
    utm_source: 'storyblok-cli',
    utm_medium: 'cli',
    utm_campaign: 'signup',
  });

  return `${baseUrl}/#/signup?${utmParams.toString()}`;
}

/**
 * Open the signup URL in the default browser
 */
export async function openSignupInBrowser(url: string): Promise<void> {
  let command: string;

  switch (process.platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "" "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
      break;
  }

  try {
    await execAsync(command);
  }
  catch (error) {
    throw new Error(`Failed to open browser: ${error}`);
  }
}
