# DX-484 OAuth CLI POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the OAuth Authorization Code Grant flow end-to-end against production EU with the sandbox org, via throwaway `storyblok oauth` CLI commands, producing verified answers in a findings doc.

**Architecture:** A new `storyblok oauth` parent command with four subcommands (`setup`, `login`, `call`, `refresh`) under `packages/cli/src/commands/oauth/`, following the CLI's parent/subcommand pattern. Client credentials and tokens persist in a new `oauth` section of `~/.storyblok/credentials.json`. Raw `fetch` is used for the OAuth token endpoint (form-encoded) and probes (need raw status/headers/body); `customFetch` for the JSON `/v1/oauth_clients` MAPI calls.

**Tech Stack:** TypeScript, Commander (via `getProgram()`), `@inquirer/prompts`, `open`, `node:http`, `node:crypto`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-07-dx-484-oauth-cli-poc-design.md` (read it first — it contains the backend facts and the manual runbook).

## Global Constraints

- Work happens in the worktree `.worktrees/feat-DX-484-oauth-login-poc` (branch `feat/DX-484-oauth-login-poc`). All commands below run from that directory.
- **POC / throwaway code: no unit tests.** Verification per task = `pnpm nx lint:fix storyblok` + `pnpm nx test:types storyblok` + build/smoke. The real verification is the manual runbook (Task 7), driven by the user.
- Repo rule: never `git push --force`; commits only because the user approved executing this plan. Commit messages end with the footer line `Fixes DX-484`.
- Fixed callback: `http://localhost:4900/oauth/callback` (constant, one place).
- Existing `login` command must remain untouched.
- Secrets (PAT, client secret, tokens) must never be printed in full — mask with the existing `maskToken` util where displayed.
- Environment: production EU. Base URLs come from existing constants (`managementApiRegions.eu` = `mapi.storyblok.com`, `getStoryblokUrl(region)` = `https://mapi.storyblok.com/v1`).

---

### Task 1: Scaffold the `oauth` parent command

**Files:**
- Modify: `packages/cli/src/constants.ts` (add `OAUTH` to `commands` and `colorPalette`)
- Modify: `packages/cli/src/index.ts` (register command import)
- Create: `packages/cli/src/commands/oauth/command.ts`
- Create: `packages/cli/src/commands/oauth/constants.ts`
- Create: `packages/cli/src/commands/oauth/index.ts`

**Interfaces:**
- Produces: `oauthCommand` (Commander command, exported from `command.ts`) — Tasks 3/5/6 attach subcommands to it. Constants `OAUTH_CALLBACK_PORT: number`, `OAUTH_CALLBACK_PATH: string`, `OAUTH_REDIRECT_URI: string`, `OAUTH_APP_NAME: string`, `DEFAULT_LOGIN_SCOPES: string[]` from `constants.ts`.

- [ ] **Step 1: Add the command constant and color**

In `packages/cli/src/constants.ts`, add to the `commands` object (after `STORIES: 'stories',`):

```ts
  OAUTH: 'oauth',
```

and to the `colorPalette` object (same file, after the `LOGIN` entry):

```ts
  OAUTH: '#dad4ff',
```

- [ ] **Step 2: Create the POC constants**

Create `packages/cli/src/commands/oauth/constants.ts`:

```ts
export const OAUTH_CALLBACK_PORT = 4900;
export const OAUTH_CALLBACK_PATH = '/oauth/callback';
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;
export const OAUTH_APP_NAME = 'Storyblok CLI';
// Fallback when no scope list was stored at setup time (manual path).
export const DEFAULT_LOGIN_SCOPES = ['read_content', 'write_content', 'offline_access'];
```

- [ ] **Step 3: Create the parent command**

Create `packages/cli/src/commands/oauth/command.ts`:

```ts
import { commands } from '../../constants';
import { getProgram } from '../../program';

const program = getProgram();

export const oauthCommand = program
  .command(commands.OAUTH)
  .description('POC: OAuth Authorization Code Grant flow (DX-484)');
```

Create `packages/cli/src/commands/oauth/index.ts` (subcommand imports get added in later tasks):

```ts
import './command';

export { oauthCommand } from './command';
```

- [ ] **Step 4: Register the command**

In `packages/cli/src/index.ts`, add after `import './commands/stories';`:

```ts
import './commands/oauth';
```

- [ ] **Step 5: Verify**

```bash
pnpm nx lint:fix storyblok && pnpm nx test:types storyblok
pnpm nx build storyblok && node packages/cli/dist/index.mjs oauth --help
```

Expected: lint/types pass; help output shows `oauth` with the POC description.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/constants.ts packages/cli/src/index.ts packages/cli/src/commands/oauth
git commit -m "feat(cli): scaffold oauth POC command

Fixes DX-484"
```

---

### Task 2: OAuth credentials store

**Files:**
- Create: `packages/cli/src/commands/oauth/store.ts`

**Interfaces:**
- Consumes: `getCredentials` from `src/creds.ts`, `saveToFile`/`getStoryblokGlobalPath` from `src/utils/filesystem.ts`.
- Produces:
  - `type OauthClientCredentials = { client_id: string; client_secret: string; scopes?: string[] }`
  - `type OauthTokens = { auth_type: 'oauth'; access_token: string; refresh_token?: string; expires_at: string }`
  - `getOauthEntry(region: RegionCode): Promise<{ client?: OauthClientCredentials; tokens?: OauthTokens }>`
  - `resolveOauthClient(region: RegionCode): Promise<OauthClientCredentials | null>` (env vars win)
  - `updateOauthEntry(region: RegionCode, patch: { client?: OauthClientCredentials; tokens?: OauthTokens }): Promise<void>`

- [ ] **Step 1: Implement the store**

Create `packages/cli/src/commands/oauth/store.ts`:

```ts
import { join } from 'pathe';
import type { RegionCode } from '../../constants';
import { getCredentials } from '../../creds';
import { getStoryblokGlobalPath, saveToFile } from '../../utils/filesystem';

export interface OauthClientCredentials {
  client_id: string;
  client_secret: string;
  // Allowed scopes captured at setup time (PAT path); used as the default login scope set.
  scopes?: string[];
}

export interface OauthTokens {
  auth_type: 'oauth';
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

export interface OauthRegionEntry {
  client?: OauthClientCredentials;
  tokens?: OauthTokens;
}

const credentialsPath = () => join(getStoryblokGlobalPath(), 'credentials.json');

const readAll = async (): Promise<Record<string, unknown>> => {
  return (await getCredentials(credentialsPath()) as Record<string, unknown> | null) ?? {};
};

export const getOauthEntry = async (region: RegionCode): Promise<OauthRegionEntry> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OauthRegionEntry>;
  return oauth[region] ?? {};
};

export const getOauthClientFromEnv = (): OauthClientCredentials | null => {
  const clientId = process.env.STORYBLOK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { client_id: clientId, client_secret: clientSecret };
  }
  return null;
};

export const resolveOauthClient = async (region: RegionCode): Promise<OauthClientCredentials | null> => {
  return getOauthClientFromEnv() ?? (await getOauthEntry(region)).client ?? null;
};

export const updateOauthEntry = async (region: RegionCode, patch: OauthRegionEntry): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OauthRegionEntry>;
  oauth[region] = { ...oauth[region], ...patch };
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};
```

Note: `getCredentials` returns the parsed `credentials.json` object keyed by machine name (its `StoryblokCredentials` type annotation is looser than reality — hence the local cast). The `oauth` key sits next to those machine entries, matching the spec's storage shape.

- [ ] **Step 2: Verify**

```bash
pnpm nx lint:fix storyblok && pnpm nx test:types storyblok
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/oauth/store.ts
git commit -m "feat(cli): oauth POC credentials store

Fixes DX-484"
```

---

### Task 3: `storyblok oauth setup`

**Files:**
- Create: `packages/cli/src/commands/oauth/actions.ts`
- Create: `packages/cli/src/commands/oauth/setup.ts`
- Modify: `packages/cli/src/commands/oauth/index.ts`

**Interfaces:**
- Consumes: `oauthCommand` (Task 1), `updateOauthEntry`/`OauthClientCredentials` (Task 2), `customFetch`/`FetchError` from `src/utils/fetch.ts`, `getStoryblokUrl` from `src/utils/api-routes.ts`, `maskToken`/`CommandError`/`handleError`/`isRegion` from `src/utils`.
- Produces: `findOrCreateCliClient(pat: string, region: RegionCode): Promise<OauthClientCredentials>` and `fetchScopeCatalog(pat: string, region: RegionCode): Promise<string[]>` in `actions.ts` (also used by the runbook and debugging).

- [ ] **Step 1: Implement the MAPI actions**

Create `packages/cli/src/commands/oauth/actions.ts`:

```ts
import type { RegionCode } from '../../constants';
import { getStoryblokUrl } from '../../utils/api-routes';
import { customFetch, FetchError } from '../../utils/fetch';
import { CommandError } from '../../utils';
import { OAUTH_APP_NAME, OAUTH_REDIRECT_URI } from './constants';
import type { OauthClientCredentials } from './store';

interface OauthClientSummary {
  id: number;
  name: string;
}

interface OauthClientDetail extends OauthClientSummary {
  oauth_identifier: string;
  oauth_secret?: string;
}

interface OauthClientsListResponse {
  oauth_clients: OauthClientSummary[];
}

interface OauthClientResponse {
  oauth_client: OauthClientDetail;
}

interface ScopeMetadataResponse {
  available_scopes: unknown;
  additional_scopes: string[];
}

const patHeaders = (pat: string) => ({ Authorization: pat });

// The grouped-scopes shape is a UI-oriented structure; flatten defensively and
// keep only plain scope strings. Log the raw payload once during the runbook to confirm.
export const fetchScopeCatalog = async (pat: string, region: RegionCode): Promise<string[]> => {
  const url = getStoryblokUrl(region);
  const { available_scopes, additional_scopes } = await customFetch<ScopeMetadataResponse>(
    `${url}/oauth_clients/metadata`,
    { headers: patHeaders(pat) },
  );
  const grouped = Array.isArray(available_scopes)
    ? available_scopes
    : Object.values(available_scopes as Record<string, unknown>);
  const flat = (grouped as unknown[]).flat(Infinity).filter(scope => typeof scope === 'string') as string[];
  return [...new Set([...flat, ...additional_scopes])];
};

export const findOrCreateCliClient = async (pat: string, region: RegionCode): Promise<OauthClientCredentials> => {
  const url = getStoryblokUrl(region);
  const headers = patHeaders(pat);

  try {
    const { oauth_clients } = await customFetch<OauthClientsListResponse>(`${url}/oauth_clients`, { headers });
    const existing = oauth_clients.find(client => client.name === OAUTH_APP_NAME);
    const scopes = await fetchScopeCatalog(pat, region);

    if (existing) {
      const { oauth_client } = await customFetch<OauthClientResponse>(`${url}/oauth_clients/${existing.id}`, { headers });
      if (!oauth_client.oauth_secret) {
        throw new CommandError(`Found existing "${OAUTH_APP_NAME}" app (id ${existing.id}) but the response did not include a secret. Record this in the findings doc.`);
      }
      return { client_id: oauth_client.oauth_identifier, client_secret: oauth_client.oauth_secret, scopes };
    }

    const { oauth_client } = await customFetch<OauthClientResponse>(`${url}/oauth_clients`, {
      method: 'POST',
      headers,
      body: {
        oauth_client: {
          name: OAUTH_APP_NAME,
          oauth_redirect_uri: OAUTH_REDIRECT_URI,
          allowed_scopes: scopes,
        },
      },
    });
    if (!oauth_client.oauth_secret) {
      throw new CommandError('Created app but the response did not include a secret. Record this in the findings doc.');
    }
    return { client_id: oauth_client.oauth_identifier, client_secret: oauth_client.oauth_secret, scopes };
  }
  catch (error) {
    if (error instanceof FetchError && error.response.status === 403) {
      const backendMessage = JSON.stringify(error.response.data);
      throw new CommandError(
        `Access to /v1/oauth_clients was denied (403): ${backendMessage}\n`
        + `Managing OAuth clients requires an org manager role and the org must be enabled for OAuth grants.\n`
        + `If you are not an org manager, ask your org admin for a client id + secret and run:\n`
        + `  storyblok oauth setup --client-id <id> --client-secret <secret>`,
      );
    }
    throw error;
  }
};
```

- [ ] **Step 2: Implement the setup subcommand**

Create `packages/cli/src/commands/oauth/setup.ts`:

```ts
import { input, password, select } from '@inquirer/prompts';
import type { RegionCode } from '../../constants';
import { colorPalette, commands, regions } from '../../constants';
import { getProgram } from '../../program';
import { CommandError, handleError, isRegion, konsola, maskToken } from '../../utils';
import { findOrCreateCliClient } from './actions';
import { updateOauthEntry } from './store';
import { oauthCommand } from './command';

const program = getProgram();

const setupCommand = oauthCommand
  .command('setup')
  .description('One-time OAuth client provisioning for your org (POC)')
  .option('-t, --token <token>', 'Personal access token of an org manager (find-or-create the "Storyblok CLI" app)')
  .option('--client-id <clientId>', 'OAuth client id shared by your org admin')
  .option('--client-secret <clientSecret>', 'OAuth client secret shared by your org admin')
  .option('-r, --region <region>', 'Region (eu, us, cn, ca, ap)', regions.EU)
  .action(async (options: { token?: string; clientId?: string; clientSecret?: string; region: RegionCode }) => {
    konsola.title(`${commands.OAUTH} setup`, colorPalette.OAUTH);
    const verbose = program.opts().verbose;

    try {
      if (!isRegion(options.region)) {
        throw new CommandError(`The provided region: ${options.region} is not valid. Please use one of: ${Object.values(regions).join(' | ')}`);
      }
      const region = options.region;

      let pat = options.token;
      let manualClientId = options.clientId;
      let manualClientSecret = options.clientSecret;

      if ((manualClientId && !manualClientSecret) || (!manualClientId && manualClientSecret)) {
        throw new CommandError('--client-id and --client-secret must be provided together.');
      }

      if (!pat && !manualClientId) {
        const path = await select({
          message: 'How do you want to provision the OAuth client?',
          choices: [
            { name: 'I manage this org — use my personal access token (creates a "Storyblok CLI" app)', value: 'pat' },
            { name: 'My org admin shared a client id + secret with me', value: 'manual' },
          ],
        });
        if (path === 'pat') {
          pat = await password({ message: 'Personal access token (used once, not stored):' });
        }
        else {
          manualClientId = await input({ message: 'OAuth client id:' });
          manualClientSecret = await password({ message: 'OAuth client secret:' });
        }
      }

      if (pat) {
        const client = await findOrCreateCliClient(pat, region);
        await updateOauthEntry(region, { client });
        konsola.ok(`OAuth client ${maskToken(client.client_id)} stored for region ${region}. The token was not persisted.`, true);
        return;
      }

      if (!manualClientId?.trim() || !manualClientSecret?.trim()) {
        throw new CommandError('Client id and client secret must not be empty.');
      }
      await updateOauthEntry(region, {
        client: { client_id: manualClientId.trim(), client_secret: manualClientSecret.trim() },
      });
      konsola.ok(`OAuth client ${maskToken(manualClientId.trim())} stored for region ${region}.`, true);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });

export { setupCommand };
```

Note: this POC uses `konsola` like the existing `login` command does (the `getUI()` singleton is only enabled for migrated commands via program hooks; matching `login` keeps the POC self-consistent). If lint complains about `konsola` usage, switch the calls to `const ui = getUI({ enabled: true })` + `ui.ok(...)`/`ui.title(...)` — same signatures.

- [ ] **Step 3: Register the subcommand**

In `packages/cli/src/commands/oauth/index.ts`, replace the content with:

```ts
import './command';
import './setup';

export { oauthCommand } from './command';
```

- [ ] **Step 4: Verify**

```bash
pnpm nx lint:fix storyblok && pnpm nx test:types storyblok
pnpm nx build storyblok && node packages/cli/dist/index.mjs oauth setup --help
```

Expected: pass; help shows `--token`, `--client-id`, `--client-secret`, `--region`.

Manual smoke (no real PAT needed): `node packages/cli/dist/index.mjs oauth setup --client-id foo --client-secret bar` then `cat ~/.storyblok/credentials.json` — expect an `oauth.eu.client` entry; file mode stays 0600 (`ls -l ~/.storyblok/credentials.json`).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/oauth
git commit -m "feat(cli): oauth setup POC command (PAT and manual paths)

Fixes DX-484"
```

---

### Task 4: PKCE and callback-server helpers

**Files:**
- Create: `packages/cli/src/commands/oauth/pkce.ts`
- Create: `packages/cli/src/commands/oauth/server.ts`

**Interfaces:**
- Produces:
  - `generatePkce(): { verifier: string; challenge: string }` — S256; verifier is 64 base64url chars (backend requires 43–128 chars of `[A-Za-z0-9-._~]`; base64url's `A-Za-z0-9-_` is a subset).
  - `generateState(): string`
  - `waitForCallback(port: number, path: string): Promise<{ code: string; state: string }>` — one-shot `node:http` server; resolves on the first matching request, rejects on `error`/`error_description` params, missing code/state, or port-in-use.

- [ ] **Step 1: Implement PKCE**

Create `packages/cli/src/commands/oauth/pkce.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

export const generatePkce = (): { verifier: string; challenge: string } => {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

export const generateState = (): string => randomBytes(16).toString('base64url');
```

- [ ] **Step 2: Implement the callback server**

Create `packages/cli/src/commands/oauth/server.ts`:

```ts
import { createServer } from 'node:http';

const SUCCESS_PAGE = `<!doctype html><html><body style="font-family: sans-serif; text-align: center; padding-top: 4rem;">
<h1>Storyblok CLI</h1><p>Authorization received. You can close this tab and return to the terminal.</p>
</body></html>`;

export const waitForCallback = (port: number, path: string): Promise<{ code: string; state: string }> => {
  return new Promise((resolve, reject) => {
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

      const error = url.searchParams.get('error');
      if (error) {
        reject(new Error(`Authorization failed: ${error} — ${url.searchParams.get('error_description') ?? 'no description'}`));
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        reject(new Error('Callback did not include code and state query params.'));
        return;
      }
      resolve({ code, state });
    });

    server.on('error', reject);
    server.listen(port);
  });
};
```

- [ ] **Step 3: Verify**

```bash
pnpm nx lint:fix storyblok && pnpm nx test:types storyblok
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/oauth/pkce.ts packages/cli/src/commands/oauth/server.ts
git commit -m "feat(cli): PKCE and callback server helpers for oauth POC

Fixes DX-484"
```

---

### Task 5: `storyblok oauth login`

**Files:**
- Create: `packages/cli/src/commands/oauth/token-endpoint.ts`
- Create: `packages/cli/src/commands/oauth/login.ts`
- Modify: `packages/cli/src/commands/oauth/index.ts`

**Interfaces:**
- Consumes: Tasks 1–4 exports; `managementApiRegions` from `src/constants.ts`; `open` package.
- Produces: `exchangeToken(region: RegionCode, params: Record<string, string>): Promise<TokenResponse>` in `token-endpoint.ts` where `TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; raw: Record<string, unknown> }` — Task 6's `refresh` reuses it.

- [ ] **Step 1: Implement the token endpoint client**

The token endpoint is Rack::OAuth2 — it expects `application/x-www-form-urlencoded`, so raw `fetch` (not `customFetch`, which JSON-encodes) is used. Create `packages/cli/src/commands/oauth/token-endpoint.ts`:

```ts
import type { RegionCode } from '../../constants';
import { managementApiRegions } from '../../constants';
import { CommandError } from '../../utils';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  raw: Record<string, unknown>;
}

export const exchangeToken = async (region: RegionCode, params: Record<string, string>): Promise<TokenResponse> => {
  const response = await fetch(`https://${managementApiRegions[region]}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const text = await response.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  }
  catch {
    throw new CommandError(`Token endpoint returned non-JSON (${response.status} ${response.statusText}): ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new CommandError(`Token endpoint error ${response.status}: ${JSON.stringify(raw)}`);
  }

  return {
    access_token: raw.access_token as string,
    refresh_token: raw.refresh_token as string | undefined,
    expires_in: raw.expires_in as number,
    scope: raw.scope as string | undefined,
    raw,
  };
};
```

- [ ] **Step 2: Implement the login subcommand**

Create `packages/cli/src/commands/oauth/login.ts`:

```ts
import open from 'open';
import type { RegionCode } from '../../constants';
import { colorPalette, commands, managementApiRegions, regions } from '../../constants';
import { getProgram } from '../../program';
import { CommandError, handleError, isRegion, konsola, maskToken } from '../../utils';
import { DEFAULT_LOGIN_SCOPES, OAUTH_CALLBACK_PATH, OAUTH_CALLBACK_PORT } from './constants';
import { generatePkce, generateState } from './pkce';
import { waitForCallback } from './server';
import { getOauthEntry, resolveOauthClient, updateOauthEntry } from './store';
import { exchangeToken } from './token-endpoint';
import { oauthCommand } from './command';

const program = getProgram();

const loginSubcommand = oauthCommand
  .command('login')
  .description('Login via OAuth Authorization Code Grant with PKCE (POC)')
  .option('-r, --region <region>', 'Region (eu, us, cn, ca, ap)', regions.EU)
  .option('--scope <scopes...>', 'Override the requested scopes (POC: used to force insufficient-scope errors)')
  .option('--port <port>', 'Override the callback port (POC: dev_oauth_redirect_uri experiment)', `${OAUTH_CALLBACK_PORT}`)
  .action(async (options: { region: RegionCode; scope?: string[]; port: string }) => {
    konsola.title(`${commands.OAUTH} login`, colorPalette.OAUTH);
    const verbose = program.opts().verbose;

    try {
      if (!isRegion(options.region)) {
        throw new CommandError(`The provided region: ${options.region} is not valid. Please use one of: ${Object.values(regions).join(' | ')}`);
      }
      const region = options.region;

      const client = await resolveOauthClient(region);
      if (!client) {
        throw new CommandError(
          'No OAuth client credentials found. Set STORYBLOK_OAUTH_CLIENT_ID / STORYBLOK_OAUTH_CLIENT_SECRET '
          + 'or run: storyblok oauth setup',
        );
      }

      const port = Number(options.port);
      const redirectUri = `http://localhost:${port}${OAUTH_CALLBACK_PATH}`;
      const scopes = options.scope ?? (await getOauthEntry(region)).client?.scopes ?? DEFAULT_LOGIN_SCOPES;
      const { verifier, challenge } = generatePkce();
      const state = generateState();

      const authorizeUrl = `https://${managementApiRegions[region]}/oauth/init?${new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })}`;

      const callback = waitForCallback(port, OAUTH_CALLBACK_PATH);
      konsola.info(`Opening browser for authorization (listening on ${redirectUri})...`);
      konsola.info(`If the browser does not open, visit:\n${authorizeUrl}`);
      await open(authorizeUrl);

      const { code, state: returnedState } = await callback;
      if (returnedState !== state) {
        throw new CommandError('State mismatch — possible CSRF; aborting without exchanging the code.');
      }

      const tokens = await exchangeToken(region, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: client.client_id,
        client_secret: client.client_secret,
        code_verifier: verifier,
      });

      await updateOauthEntry(region, {
        tokens: {
          auth_type: 'oauth',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
      });

      konsola.ok(`Logged in. Access token ${maskToken(tokens.access_token)} (expires in ${tokens.expires_in}s).`, true);
      konsola.info(`Granted scope: ${tokens.scope ?? '(none reported)'}`);
      konsola.info(`Refresh token returned: ${tokens.refresh_token ? `yes (${maskToken(tokens.refresh_token)})` : 'NO'}`);
      konsola.info(`Raw token response keys: ${Object.keys(tokens.raw).join(', ')}`);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });

export { loginSubcommand };
```

- [ ] **Step 3: Register the subcommand**

In `packages/cli/src/commands/oauth/index.ts`, add after `import './setup';`:

```ts
import './login';
```

- [ ] **Step 4: Verify**

```bash
pnpm nx lint:fix storyblok && pnpm nx test:types storyblok
pnpm nx build storyblok && node packages/cli/dist/index.mjs oauth login --help
```

Expected: pass; help shows `--region`, `--scope`, `--port`.

Manual smoke without a real client: unset the env vars, remove any `oauth` section from `~/.storyblok/credentials.json`, run `node packages/cli/dist/index.mjs oauth login` — expect the "No OAuth client credentials found" error mentioning `oauth setup`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/oauth
git commit -m "feat(cli): oauth login POC command (PKCE + local callback)

Fixes DX-484"
```

---

### Task 6: `oauth call` and `oauth refresh` probes

**Files:**
- Create: `packages/cli/src/commands/oauth/probes.ts`
- Modify: `packages/cli/src/commands/oauth/index.ts`

**Interfaces:**
- Consumes: `exchangeToken` (Task 5), store (Task 2), `managementApiRegions`.
- Produces: nothing consumed later — these print raw evidence for the findings doc.

- [ ] **Step 1: Implement the probes**

Create `packages/cli/src/commands/oauth/probes.ts`:

```ts
import type { RegionCode } from '../../constants';
import { colorPalette, commands, managementApiRegions, regions } from '../../constants';
import { getProgram } from '../../program';
import { CommandError, handleError, isRegion, konsola, maskToken } from '../../utils';
import { getOauthEntry, resolveOauthClient, updateOauthEntry } from './store';
import { exchangeToken } from './token-endpoint';
import { oauthCommand } from './command';

const program = getProgram();

const requireTokens = async (region: RegionCode) => {
  const { tokens } = await getOauthEntry(region);
  if (!tokens) {
    throw new CommandError('No OAuth tokens stored. Run: storyblok oauth login');
  }
  return tokens;
};

oauthCommand
  .command('call [path]')
  .description('POC probe: call a MAPI path with the stored OAuth access token and print the raw response')
  .option('-s, --space <space>', 'Space id (used by the default path)')
  .option('-r, --region <region>', 'Region (eu, us, cn, ca, ap)', regions.EU)
  .action(async (path: string | undefined, options: { space?: string; region: RegionCode }) => {
    konsola.title(`${commands.OAUTH} call`, colorPalette.OAUTH);
    const verbose = program.opts().verbose;

    try {
      if (!isRegion(options.region)) {
        throw new CommandError(`Invalid region: ${options.region}`);
      }
      const region = options.region;
      const tokens = await requireTokens(region);

      const requestPath = path ?? (options.space ? `/v1/spaces/${options.space}` : undefined);
      if (!requestPath) {
        throw new CommandError('Provide a path argument or --space for the default GET /v1/spaces/:id probe.');
      }

      const url = `https://${managementApiRegions[region]}${requestPath}`;
      konsola.info(`GET ${url}`);
      konsola.info(`Authorization: Bearer ${maskToken(tokens.access_token)} (stored expiry: ${tokens.expires_at})`);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const body = await response.text();

      konsola.info(`Status: ${response.status} ${response.statusText}`);
      konsola.info(`WWW-Authenticate: ${response.headers.get('www-authenticate') ?? '(not set)'}`);
      konsola.info(`Body: ${body.slice(0, 2000)}`);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });

oauthCommand
  .command('refresh')
  .description('POC probe: force a refresh_token grant and report whether the refresh token rotated')
  .option('-r, --region <region>', 'Region (eu, us, cn, ca, ap)', regions.EU)
  .action(async (options: { region: RegionCode }) => {
    konsola.title(`${commands.OAUTH} refresh`, colorPalette.OAUTH);
    const verbose = program.opts().verbose;

    try {
      if (!isRegion(options.region)) {
        throw new CommandError(`Invalid region: ${options.region}`);
      }
      const region = options.region;
      const tokens = await requireTokens(region);
      if (!tokens.refresh_token) {
        throw new CommandError('No refresh token stored — was offline_access granted? Record this in the findings doc.');
      }
      const client = await resolveOauthClient(region);
      if (!client) {
        throw new CommandError('No OAuth client credentials found. Run: storyblok oauth setup');
      }

      const refreshed = await exchangeToken(region, {
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        client_secret: client.client_secret,
      });

      const accessChanged = refreshed.access_token !== tokens.access_token;
      const refreshChanged = !!refreshed.refresh_token && refreshed.refresh_token !== tokens.refresh_token;

      await updateOauthEntry(region, {
        tokens: {
          auth_type: 'oauth',
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        },
      });

      konsola.ok(`Refreshed. New access token: ${maskToken(refreshed.access_token)} (changed: ${accessChanged})`, true);
      konsola.info(`Refresh token in response: ${refreshed.refresh_token ? maskToken(refreshed.refresh_token) : 'NOT RETURNED'}`);
      konsola.info(`Refresh token rotated: ${refreshChanged}`);
      konsola.info(`Raw response keys: ${Object.keys(refreshed.raw).join(', ')}`);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
```

- [ ] **Step 2: Register the probes**

In `packages/cli/src/commands/oauth/index.ts`, add after `import './login';`:

```ts
import './probes';
```

- [ ] **Step 3: Verify**

```bash
pnpm nx lint:fix storyblok && pnpm nx test:types storyblok
pnpm nx build storyblok && node packages/cli/dist/index.mjs oauth --help
```

Expected: pass; `oauth --help` lists `setup`, `login`, `call`, `refresh`.

Manual smoke: with no tokens stored, `node packages/cli/dist/index.mjs oauth call --space 1` → "No OAuth tokens stored. Run: storyblok oauth login".

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/oauth
git commit -m "feat(cli): oauth call/refresh POC probes

Fixes DX-484"
```

---

### Task 7: Findings doc skeleton + manual runbook

The runbook itself is user-driven (real PAT, browser consent, 15-minute waits). This task prepares the evidence-capture document so every runbook step has a place to land.

**Files:**
- Create: `DX-484-oauth-poc-findings.md` (worktree root)

- [ ] **Step 1: Create the findings skeleton**

Create `DX-484-oauth-poc-findings.md`:

```markdown
# DX-484 OAuth POC — Findings

**Environment:** production EU (`app.storyblok.com` / `mapi.storyblok.com`), sandbox org.
**Date:** <!-- fill in when the runbook runs -->
**CLI branch:** `feat/DX-484-oauth-login-poc`

## Must-answer questions

### 1. Does `offline_access` actually return a refresh token?
- **Answer:**
- **Evidence:** (raw `/oauth/token` response with secrets redacted)
- Share with the MCP team — they are blocked on this question.

### 2. Does refresh work as documented (new access token, refresh token unchanged)?
- **Answer:**
- **Note:** storyrails `token_endpoint.rb` revokes the old grant and issues a NEW refresh token on every
  refresh (rotation) — the "refresh token unchanged" expectation appears wrong at the code level.
  Record what actually happens.
- **Evidence:** (`oauth refresh` output)

### 3. Are expired-token vs missing-scope errors distinguishable (401 vs 403 shapes)?
- **Expired token (after 15 min):**
  - Status:
  - WWW-Authenticate header:
  - Body:
- **Missing scope (narrowed-scope grant):**
  - Status:
  - Body: (expected per code: `{"error": "Insufficient scope: <scope> is required"}`)
- **Verdict for the refresh-on-401 interceptor:**

### 4. Does find-or-create behave sanely on re-runs?
- **Answer:** (no duplicate apps? secret readable via show?)
- **Evidence:**

### 5. Does `/oauth/authorize` accept `dev_oauth_redirect_uri` as well as `oauth_redirect_uri`?
- **Answer:** (code says yes — `authorize_request.rb#redirect_urls_for`)
- **Evidence:**

### 6. Any surprises in consent UX with a CLI as the app?
- App name/icon rendering:
- Space selection step:
- `/oauth/init` vs direct `/oauth/authorize` entry:
- Other notes:

## Additional observations

- Scope catalog (`GET /v1/oauth_clients/metadata`) raw shape:
- Non-manager 403 shape from `/v1/oauth_clients`:
- Org not enabled for OAuth grants (if hit):
- Env-var client credentials path (`STORYBLOK_OAUTH_CLIENT_ID/SECRET`):
- Anything else:

## Runbook log

(Chronological notes per runbook step from the design doc, section "Manual runbook".)
```

- [ ] **Step 2: Commit**

```bash
git add DX-484-oauth-poc-findings.md
git commit -m "docs: findings skeleton for DX-484 oauth POC

Fixes DX-484"
```

- [ ] **Step 3: Hand off to the user for the manual runbook**

Tell the user the build command (`pnpm nx build storyblok`, then `node packages/cli/dist/index.mjs oauth …` from the worktree) and walk them through the runbook in the design doc (`docs/superpowers/specs/2026-07-07-dx-484-oauth-cli-poc-design.md`, "Manual runbook" section), filling `DX-484-oauth-poc-findings.md` as evidence comes in. Preconditions to confirm first:
1. The sandbox org has `allow_oauth_grants` enabled (otherwise `oauth setup --token <PAT>` returns the 403 "Organization is not enabled for OAuth grants" — itself a finding).
2. The user has an org-manager PAT for the sandbox org; the spaces from `.env.qa-engineer-manual` are used for `oauth call --space <id>` probes.
```
