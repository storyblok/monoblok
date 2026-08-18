/**
 * Module loader hooks that put a timing wrapper around a few of the CLI's
 * dependencies without touching the CLI itself.
 *
 * `resolve` redirects those package specifiers to a synthetic module, and
 * `load` supplies that module's source: it re-exports the real package and
 * overrides the single symbol worth timing. An explicit export shadows a star
 * export of the same name, so everything else the CLI imports passes through.
 */
const MARKER = "probe-shim";
const RECORDER = new URL("./probe-recorder.mjs", import.meta.url).href;

/**
 * Package specifier → the wrapper to apply. `symbol: "default"` is the CDN
 * client, which the package exports as its default rather than by name.
 */
const TARGETS = {
  "@storyblok/management-api-client": {
    symbol: "createManagementApiClient",
    wrapper: "wrapClientFactory",
  },
  "storyblok-js-client": { symbol: "default", wrapper: "wrapCapiClientClass" },
  "json-p3": { symbol: "compile", wrapper: "wrapCompile" },
};

export async function resolve(specifier, context, nextResolve) {
  const target = TARGETS[specifier];
  // The shim imports the real package itself; letting that import through is
  // what stops the redirect from looping.
  if (!target || (context.parentURL ?? "").includes(MARKER)) {
    return nextResolve(specifier, context);
  }

  const resolved = await nextResolve(specifier, context);
  const shim = new URL(`./${MARKER}.mjs`, import.meta.url);
  shim.searchParams.set("specifier", specifier);
  shim.searchParams.set("real", resolved.url);

  return { url: shim.href, shortCircuit: true, format: "module" };
}

export async function load(url, context, nextLoad) {
  if (!url.includes(MARKER)) {
    return nextLoad(url, context);
  }

  const { specifier, real } = Object.fromEntries(new URL(url).searchParams);
  const { symbol, wrapper } = TARGETS[specifier];
  // `export *` never carries a default, so the default export is the one case
  // where re-exporting everything and overriding one name is not enough.
  const override =
    symbol === "default"
      ? [`import __real from ${JSON.stringify(real)};`, `export default ${wrapper}(__real);`]
      : [
          `import { ${symbol} as __real } from ${JSON.stringify(real)};`,
          `export const ${symbol} = ${wrapper}(__real);`,
        ];
  const source = [
    `export * from ${JSON.stringify(real)};`,
    `import { ${wrapper} } from ${JSON.stringify(RECORDER)};`,
    ...override,
  ].join("\n");

  return { format: "module", shortCircuit: true, source };
}
