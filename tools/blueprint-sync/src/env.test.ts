import { delimiter } from "node:path";
import { describe, expect, it } from "vitest";

import { userEnv, withoutBlueprintEnv } from "./env.ts";

describe("userEnv", () => {
  it("should drop what pnpm sets for scripts and keep the user's own npm config", () => {
    expect(
      userEnv({
        npm_config_resolution_mode: "highest",
        pnpm_config_catalog: "x",
        INIT_CWD: "/somewhere",
        NPM_CONFIG_REGISTRY: "https://mirror.example",
        PATH: "/bin",
      }),
    ).toEqual({ NPM_CONFIG_REGISTRY: "https://mirror.example", PATH: "/bin" });
  });
});

describe("userEnv PATH", () => {
  it("should drop the node_modules/.bin folders pnpm adds, and keep the rest", () => {
    const path = [
      "/repo/tools/blueprint-sync/node_modules/.bin",
      "/repo/node_modules/.bin",
      "/usr/local/lib/node_modules/pnpm/dist/node-gyp-bin",
      "/usr/local/bin",
      "/usr/bin",
    ].join(delimiter);

    expect(userEnv({ PATH: path }).PATH).toBe(["/usr/local/bin", "/usr/bin"].join(delimiter));
  });
});

describe("withoutBlueprintEnv", () => {
  it("should remove the token and region so a blueprint has to read its .env", () => {
    expect(
      withoutBlueprintEnv({
        STORYBLOK_DELIVERY_API_TOKEN: "secret",
        STORYBLOK_REGION: "eu",
        STORYBLOK_API_BASE_URL: "https://api.storyblok.com",
        PATH: "/bin",
      }),
    ).toEqual({ STORYBLOK_API_BASE_URL: "https://api.storyblok.com", PATH: "/bin" });
  });
});
