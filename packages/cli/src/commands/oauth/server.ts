import { createServer } from 'node:http';
import { CommandError } from '../../utils';

const SUCCESS_PAGE = `<!doctype html><html><body style="font-family: sans-serif; text-align: center; padding-top: 4rem;">
<h1>Storyblok CLI</h1><p>Authorization received. You can close this tab and return to the terminal.</p>
</body></html>`;

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

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(SUCCESS_PAGE);
      server.close();
      clearTimeout(timer);

      const error = url.searchParams.get('error');
      if (error) {
        reject(new CommandError(`Authorization failed: ${error} — ${url.searchParams.get('error_description') ?? 'no description'}`));
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        reject(new CommandError('Callback did not include code and state query params.'));
        return;
      }
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
    server.listen(port);
  });
};
