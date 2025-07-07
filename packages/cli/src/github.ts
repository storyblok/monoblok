import { Octokit } from 'octokit';

let octokit: Octokit;

export const createOctokit = (token?: string) => {
  if (!octokit) {
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
