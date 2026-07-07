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
      const redactedResponse = {
        ...tokens.raw,
        access_token: maskToken(tokens.access_token),
        ...(tokens.refresh_token ? { refresh_token: maskToken(tokens.refresh_token) } : {}),
      };
      konsola.info(`Raw token response (redacted): ${JSON.stringify(redactedResponse, null, 2)}`);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });

export { loginSubcommand };
