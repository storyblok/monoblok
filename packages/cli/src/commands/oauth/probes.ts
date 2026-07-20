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
