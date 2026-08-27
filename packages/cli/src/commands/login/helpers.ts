import chalk from "chalk";
import { input, password, select } from "@inquirer/prompts";
import type { RegionCode } from "../../constants";
import { colorPalette, regionNames, regions } from "../../constants";
import { handleError } from "../../utils";
import { loginWithEmailAndPassword, loginWithOtp, loginWithToken } from "./actions";
import { session } from "../../session";
import { type CLISpinner, getUI, stderrPromptContext } from "../../lib/ui";
import { performOAuthLogin } from "../../lib/oauth/login-flow";
import type { OAuthLoginResult } from "../../lib/oauth/login-flow";

/**
 * Result of an interactive login. OAuth logins carry no token here (the access
 * token lives in the OAuth credential store); PAT and email logins carry the
 * personal access token.
 */
export type InteractiveLoginResult =
  | { authType: "oauth"; region: RegionCode }
  | { authType: "pat"; token: string; region: RegionCode };

/**
 * Performs interactive login flow with OAuth, email/password, or token
 * @param options - Options for the login flow
 * @param options.verbose - Whether to show verbose error output
 * @param options.preSelectedRegion - Pre-selected region to skip region selection
 * @param options.showWelcomeMessage - Whether to show welcome message after login
 * @returns The login result, or null if cancelled/failed
 */
export async function performInteractiveLogin(options?: {
  verbose?: boolean;
  preSelectedRegion?: RegionCode;
  showWelcomeMessage?: boolean;
}): Promise<InteractiveLoginResult | null> {
  const { verbose = false, preSelectedRegion, showWelcomeMessage = true } = options || {};
  const ui = getUI();
  let activeSpinner: CLISpinner | null = null;

  try {
    const strategy = await select(
      {
        message: "How would you like to login?",
        choices: [
          {
            name: "With OAuth (recommended — opens your browser)",
            value: "login-with-oauth",
            short: "OAuth",
          },
          {
            name: "With email",
            value: "login-with-email",
            short: "Email",
          },
          {
            name: "With Token (Personal Access Token – works also for SSO accounts)",
            value: "login-with-token",
            short: "Token",
          },
        ],
      },
      stderrPromptContext,
    );

    let userToken: string;
    let userRegion: RegionCode;

    if (strategy === "login-with-oauth") {
      const region =
        preSelectedRegion ||
        (await select({
          message: "Please select the region you would like to work in:",
          choices: Object.values(regions).map((region: RegionCode) => ({
            name: regionNames[region],
            value: region,
          })),
          default: regions.EU,
        }));
      const result = await performOAuthLoginStrategy({ region, verbose });
      return result ? { authType: "oauth", region } : null;
    }

    if (strategy === "login-with-token") {
      ui.info(
        [
          "🔑 You can use a Personal Access Token to log in.",
          "This works for all accounts, including SSO accounts.",
          `Generate one in your Storyblok account settings: ${chalk.underline.blue("https://app.storyblok.com/#/me/account?tab=token")}`,
        ].join("\n"),
      );

      userToken = await password(
        {
          message: "Please enter your Personal Access Token:",
          validate: (value: string) => {
            return value.length > 0;
          },
        },
        stderrPromptContext,
      );

      userRegion =
        preSelectedRegion ||
        (await select(
          {
            message: "Please select the region you would like to work in:",
            choices: Object.values(regions).map((region: RegionCode) => ({
              name: regionNames[region],
              value: region,
            })),
            default: regions.EU,
          },
          stderrPromptContext,
        ));

      activeSpinner = ui.createSpinner(`Logging in with token`);
      const user = await loginWithToken(userToken, userRegion);
      activeSpinner.succeed();

      if (user) {
        const { updateSession, persistCredentials } = session();
        updateSession(user.email, userToken, userRegion);
        await persistCredentials(userRegion);
        if (showWelcomeMessage) {
          ui.ok(
            `Successfully logged in to region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[userRegion]} (${userRegion})`)}. Welcome ${chalk.hex(colorPalette.PRIMARY)(user.friendly_name)}.`,
            true,
          );
        }
        return { authType: "pat", token: userToken, region: userRegion };
      }
    } else {
      const userEmail = await input(
        {
          message: "Please enter your email address:",
          required: true,
          validate: (value: string) => {
            const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
            return emailRegex.test(value);
          },
        },
        stderrPromptContext,
      );
      const userPassword = await password(
        {
          message: "Please enter your password:",
        },
        stderrPromptContext,
      );

      userRegion =
        preSelectedRegion ||
        (await select(
          {
            message: "Please select the region you would like to work in:",
            choices: Object.values(regions).map((region: RegionCode) => ({
              name: regionNames[region],
              value: region,
            })),
            default: regions.EU,
          },
          stderrPromptContext,
        ));

      activeSpinner = ui.createSpinner(`Logging in with email`);
      const response = await loginWithEmailAndPassword(userEmail, userPassword, userRegion);
      activeSpinner.succeed();

      if (response?.otp_required) {
        const otp = await input(
          {
            message:
              "Add the code from your Authenticator app, or the one we sent to your e-mail / phone:",
            required: true,
          },
          stderrPromptContext,
        );

        const otpResponse = await loginWithOtp(userEmail, userPassword, otp, userRegion);
        if (otpResponse?.access_token) {
          userToken = otpResponse.access_token;
        }
      } else if (response?.access_token) {
        userToken = response.access_token;
      }

      if (userToken!) {
        const { updateSession, persistCredentials } = session();
        updateSession(userEmail, userToken, userRegion);
        await persistCredentials(userRegion);
        if (showWelcomeMessage) {
          ui.ok(
            `Successfully logged in to region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[userRegion]} (${userRegion})`)}. Welcome ${chalk.hex(colorPalette.PRIMARY)(userEmail)}.`,
            true,
          );
        }
        return { authType: "pat", token: userToken, region: userRegion };
      }
    }

    return null;
  } catch (error) {
    activeSpinner?.failed();
    ui.br();
    handleError(error as Error, verbose);
    return null;
  }
}

/**
 * Runs the OAuth Authorization Code login flow and reports the granted scopes and spaces.
 * @returns the login result, or null when the flow was cancelled or failed.
 */
export async function performOAuthLoginStrategy(options: {
  region: RegionCode;
  verbose?: boolean;
}): Promise<OAuthLoginResult | null> {
  const { region, verbose = false } = options;
  const ui = getUI();
  try {
    const result = await performOAuthLogin({ region });
    const spaceList = result.spaces.length
      ? result.spaces.map((space) => `${space.id} (${space.region})`).join(", ")
      : "none (grant is not space-scoped)";
    ui.ok(
      `Successfully logged in with OAuth in region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[region]} (${region})`)}.\n` +
        `Granted scopes: ${result.scopes.join(", ")}\n` +
        `Authorized spaces: ${spaceList}`,
      true,
    );
    return result;
  } catch (error) {
    handleError(error as Error, verbose);
    return null;
  }
}
