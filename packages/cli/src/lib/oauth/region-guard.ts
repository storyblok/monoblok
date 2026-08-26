import type { RegionCode } from "../../constants";
import { regionNames } from "../../constants";
import { CommandError } from "../../utils";

// Commands that establish or tear down a session pick their own region and must not be
// measured against the session already on disk.
const SESSION_COMMANDS = new Set(["login", "logout", "signup"]);

export const isSessionCommand = (commandName: string): boolean => SESSION_COMMANDS.has(commandName);

const describe = (region: RegionCode): string => `${regionNames[region]} (${region})`;

/**
 * Reconciles an explicit `--region` with the OAuth session. A session resolves through the
 * store's `activeRegion`, so without this an explicit region is silently ignored and the
 * command reads or writes another region's data while reporting success. When the requested
 * region has its own grant the session moves there; otherwise the run stops.
 */
export const assertOAuthRegionAuthorized = async (
  requested: RegionCode | undefined,
  active: RegionCode | undefined,
  switchToRegion: (region: RegionCode) => Promise<boolean>,
): Promise<void> => {
  if (!requested || !active || requested === active) {
    return;
  }
  if (await switchToRegion(requested)) {
    return;
  }
  throw new CommandError(
    `Your OAuth login is for region ${describe(active)}, but region ${describe(requested)} was requested. ` +
      `Run \`storyblok login --oauth --region ${requested}\` to authorize that region, or drop the region option to use ${describe(active)}.`,
  );
};
