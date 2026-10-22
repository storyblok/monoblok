import { describe, expect, it } from "vitest";

import { resolveWorkspaceDependencies, type WorkspacePackage } from "./resolve.ts";

const workspace: WorkspacePackage[] = [
  { name: "@storyblok/react", version: "7.3.1", private: false },
  { name: "@storyblok/lint-config", version: "0.0.0", private: true },
];

const manifest = (dependencies: Record<string, string>): string =>
  `${JSON.stringify({ name: "blueprint", dependencies }, null, "\t")}\n`;

describe("resolveWorkspaceDependencies", () => {
  it("should rewrite workspace:^ to a caret range of the workspace version", () => {
    const resolved = resolveWorkspaceDependencies(
      manifest({ "@storyblok/react": "workspace:^", react: "^19.3.0" }),
      workspace,
    );
    expect(JSON.parse(resolved).dependencies).toEqual({
      "@storyblok/react": "^7.3.1",
      react: "^19.3.0",
    });
  });

  it("should use the latest version from npm instead of the workspace version when given", () => {
    const resolved = resolveWorkspaceDependencies(
      manifest({ "@storyblok/react": "workspace:^" }),
      workspace,
      (name) => (name === "@storyblok/react" ? "7.2.0" : "0.0.0"),
    );
    expect(JSON.parse(resolved).dependencies).toEqual({ "@storyblok/react": "^7.2.0" });
  });

  it("should keep the blueprint's indentation and trailing newline", () => {
    const resolved = resolveWorkspaceDependencies(
      manifest({ "@storyblok/react": "workspace:^" }),
      workspace,
    );
    expect(resolved).toBe(manifest({ "@storyblok/react": "^7.3.1" }));
  });

  it("should reject workspace:* because it would pin users to an exact version", () => {
    expect(() =>
      resolveWorkspaceDependencies(manifest({ "@storyblok/react": "workspace:*" }), workspace),
    ).toThrow(/use "workspace:\^"/);
  });

  it("should reject packages that are not published", () => {
    expect(() =>
      resolveWorkspaceDependencies(
        manifest({ "@storyblok/lint-config": "workspace:^", "@storyblok/nope": "workspace:^" }),
        workspace,
      ),
    ).toThrow(/lint-config is private[\s\S]*nope is not a package in this workspace/);
  });
});
