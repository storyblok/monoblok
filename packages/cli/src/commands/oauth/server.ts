import { createServer } from 'node:http';
import { CommandError } from '../../utils';

const page = (heading: string, message: string): string =>
  `<!doctype html><html><body style="font-family: sans-serif; text-align: center; padding-top: 4rem;">
<h1>${heading}</h1><p>${message}</p>
</body></html>`;

const SUCCESS_PAGE = page('Storyblok CLI', 'Authorization received. You can close this tab and return to the terminal.');
const ERROR_PAGE = page('Storyblok CLI', 'Authorization failed. You can close this tab and return to the terminal.');

export const waitForCallback = (port: number, path: string, timeoutMs = 300_000): Promise<{ code: string; state: string }> => {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout;

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname !== path) {
        res.writeHead(404);
        res.end();
        return;
      }

      server.close();
      clearTimeout(timer);

      const fail = (error: CommandError): void => {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_PAGE);
        reject(error);
      };

      const error = url.searchParams.get('error');
      if (error) {
        fail(new CommandError(`Authorization failed: ${error} — ${url.searchParams.get('error_description') ?? 'no description'}`));
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        fail(new CommandError('Callback did not include code and state query params.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(SUCCESS_PAGE);
      resolve({ code, state });
    });

    timer = setTimeout(() => {
      server.close();
      reject(new CommandError('Timed out waiting for the browser authorization callback.'));
    }, timeoutMs);
    timer.unref?.();

    server.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    // Bind to loopback only so the authorization code is never accepted from other hosts.
    server.listen(port, '127.0.0.1');
  });
};
