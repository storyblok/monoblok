import { delimiter } from "node:path";

// What a user's shell has: none of the lowercase `npm_*`/`pnpm_*` variables this pnpm script sets,
// which npm would read as config (catalogs, `resolution-mode`, ...), and none of the
// `node_modules/.bin` folders pnpm puts on `PATH`: a build that calls a tool it does not declare
// must fail here as it would for a user. A user's own `NPM_CONFIG_*` stays: npm reads those too.
export const userEnv = (env: NodeJS.ProcessEnv = process.env): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env)
      .filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined && !/^(npm|pnpm)_|^INIT_CWD$/.test(entry[0]),
      )
      .map(([key, value]) => [key, key === "PATH" ? withoutWorkspaceBins(value) : value]),
  );

function withoutWorkspaceBins(path: string): string {
  return path
    .split(delimiter)
    .filter((entry) => !/[\\/]node_modules[\\/]\.bin$|[\\/]node-gyp-bin$/.test(entry))
    .join(delimiter);
}

// What `.env` is supposed to provide: if the blueprint only works with these in the process env,
// the check has to fail.
export function withoutBlueprintEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => key !== "STORYBLOK_DELIVERY_API_TOKEN" && key !== "STORYBLOK_REGION",
    ),
  );
}
