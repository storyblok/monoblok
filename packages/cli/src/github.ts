import { Octokit } from 'octokit';

let octokit: Octokit;
let lastToken: string | undefined;

export const createOctokit = (token?: string) => {
  if (!octokit || token !== lastToken) {
    const options: {
      auth?: string;
      request: {
        fetch: typeof fetch;
      };
    } = {
      request: {
        fetch,
      },
    };
    if (token) {
      options.auth = token;
    }
    octokit = new Octokit(options);
  }
  return octokit;
};
