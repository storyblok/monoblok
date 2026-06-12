/**
 * Internal codegen tool. Drives `@hey-api/openapi-ts` against the spec cache,
 * applies aliases + slicing + envelope-strips via an AST post-processor, then
 * stamps wrapper-type templates (`Block<T>`, `Story<T>`, `BlockContent<T>`)
 * into each consumer's `src/generated/`.
 *
 * Public API: `generate({ outDir, include, sdk, verbose })`. Upstream type
 * names never appear in committed output; each consumer commits only the
 * aliased `types.gen.ts` plus the wrapper templates it needs.
 */

import { createClient } from '@hey-api/openapi-ts';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'pathe';
import { ALIAS_BY_EMIT_NAME, ALIASES, type SpecSource } from './aliases.ts';
import type { KnownType } from './known-types.ts';
import { SPEC_PATHS, TEMPLATES_DIR } from './paths.ts';
import { templateFor, TEMPLATES, type WrapperFile } from './templates.ts';
import { type KeepEntry, transformGeneratedFile } from './transform.ts';

export interface GenerateConfig {
  /** Where to write the consumer's `src/generated/` tree (absolute). */
  outDir: string;
  /** Public type names the consumer wants. The tool resolves transitive deps. */
  include: readonly KnownType[];
  /** Emit the full SDK on this surface in addition to types. */
  sdk?: 'mapi' | 'capi' | false;
  /** Log emitted files and type names. */
  verbose?: boolean;
}

export async function generate(config: GenerateConfig): Promise<void> {
  const cacheMissing = !existsSync(SPEC_PATHS.capi) || !existsSync(SPEC_PATHS.mapi);
  if (cacheMissing) {
    throw new Error(
      `OpenAPI cache missing. Run \`pnpm --filter @storyblok/openapi-codegen pull\` first.`,
    );
  }
  const { wrappers, publicPerSpec, leafPerSpec, leafLocation } = resolveInclude(config.include);
  const renameMaps = buildRenameMaps();

  // Wipe existing output so removed types don't linger.
  rmSync(config.outDir, { recursive: true, force: true });
  mkdirSync(config.outDir, { recursive: true });

  if (config.sdk) {
    await emitFullSdk(config.sdk, config.outDir, config.verbose === true);
  }

  for (const spec of ['capi', 'mapi', 'overlay'] as const) {
    const publicKeep = publicPerSpec[spec];
    const leafKeep = leafPerSpec[spec];
    if (publicKeep.length === 0 && leafKeep.length === 0) {
      continue;
    }

    const tempDir = mkdtempSync(resolve(tmpdir(), 'openapi-codegen-'));
    try {
      await createClient({
        input: SPEC_PATHS[spec],
        output: tempDir,
        plugins: ['@hey-api/typescript'],
        logs: { level: 'silent' },
      });
      const intermediate = readFileSync(resolve(tempDir, 'types.gen.ts'), 'utf8');
      const specDir = resolve(config.outDir, spec);
      mkdirSync(specDir, { recursive: true });

      if (publicKeep.length > 0) {
        // When the full SDK is emitted on this spec, the aliased/narrowed types
        // go to `types-aliased.gen.ts` so they don't clobber the SDK's full
        // `types.gen.ts`. Otherwise, types-only emit owns `types.gen.ts`.
        const typesFileName = config.sdk === spec ? 'types-aliased.gen.ts' : 'types.gen.ts';
        const { output, emitted } = transformGeneratedFile(intermediate, publicKeep, renameMaps[spec]);
        writeFileSync(resolve(specDir, typesFileName), output, 'utf8');
        logVerbose(
          config,
          `[${spec}] emitted ${emitted.length} public type(s) to ${typesFileName}: ${emitted.join(', ')}`,
        );
      }
      if (leafKeep.length > 0) {
        // Wrapper-template private leaves. Reachable only through `_sources.ts`,
        // which is itself only imported by the wrapper templates. Consumer code
        // must not import from this file; the leading underscore + `.gen` suffix
        // signal "tool-managed, internal".
        const { output, emitted } = transformGeneratedFile(intermediate, leafKeep, renameMaps[spec]);
        writeFileSync(resolve(specDir, '_internal.gen.ts'), output, 'utf8');
        logVerbose(
          config,
          `[${spec}] emitted ${emitted.length} internal leaf(s) to _internal.gen.ts: ${emitted.join(', ')}`,
        );
      }
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  copyWrapperTemplates(config.outDir, wrappers, publicPerSpec, leafPerSpec, leafLocation, config.sdk);
}

/**
 * Run `@hey-api/openapi-ts` with the full SDK plugins against the consolidated
 * spec for the requested surface. Output is flat: `<outDir>/<spec>/` contains
 * `sdk.gen.ts`, `types.gen.ts`, `client.gen.ts`, plus `client/` and `core/`
 * runtime helpers. Names follow upstream OpenAPI conventions; the alias map
 * does not apply here (clients consume raw schema/operation names directly).
 */
async function emitFullSdk(spec: 'capi' | 'mapi', outDir: string, verbose: boolean): Promise<void> {
  const sdkDir = resolve(outDir, spec);
  await createClient({
    input: SPEC_PATHS[spec],
    output: sdkDir,
    plugins: [
      '@hey-api/typescript',
      '@hey-api/client-ky',
      { name: '@hey-api/sdk' },
    ],
    logs: { level: 'silent' },
  });
  if (verbose) {
    console.warn(`[${spec}] emitted full SDK to ${sdkDir}`);
  }
}

interface ResolvedInclude {
  wrappers: ReadonlySet<WrapperFile>;
  /** Explicit `include` entries that resolve to a direct alias (consumer-facing). */
  publicPerSpec: Record<SpecSource, KeepEntry[]>;
  /** Wrapper template `sourceLeaves` (template-private; never consumer-imported). */
  leafPerSpec: Record<SpecSource, KeepEntry[]>;
  /** Per-emit-name, which file the leaf lives in (used to build `_sources.ts`). */
  leafLocation: Map<string, 'public' | 'internal'>;
}

function resolveInclude(include: readonly KnownType[]): ResolvedInclude {
  const wrappers = new Set<WrapperFile>();
  const publicAliases = new Set<string>();
  const leafAliases = new Set<string>();

  function expandWrapper(file: WrapperFile): void {
    if (wrappers.has(file)) {
      return;
    }
    wrappers.add(file);
    const meta = TEMPLATES[file];
    for (const dep of meta.templateDeps) {
      expandWrapper(dep);
    }
    for (const leaf of meta.sourceLeaves) {
      leafAliases.add(leaf);
    }
  }

  for (const name of include) {
    const wrapper = templateFor(name);
    if (wrapper) {
      expandWrapper(wrapper);
    }
    else {
      // Direct alias (no wrapper template provides this name).
      publicAliases.add(name);
    }
  }

  // A name that's both an explicit include and a wrapper leaf goes to public:
  // the consumer asked for it on the public surface, so it should be reachable
  // there, and `_sources.ts` will re-export from the public file instead of
  // duplicating into `_internal.gen.ts`.
  const leafLocation = new Map<string, 'public' | 'internal'>();
  for (const leaf of leafAliases) {
    leafLocation.set(leaf, publicAliases.has(leaf) ? 'public' : 'internal');
  }
  for (const leaf of publicAliases) {
    leafAliases.delete(leaf);
  }

  const publicPerSpec: Record<SpecSource, KeepEntry[]> = { capi: [], mapi: [], overlay: [] };
  const leafPerSpec: Record<SpecSource, KeepEntry[]> = { capi: [], mapi: [], overlay: [] };
  const push = (target: Record<SpecSource, KeepEntry[]>, emitAs: string): void => {
    const alias = ALIAS_BY_EMIT_NAME.get(emitAs);
    if (!alias) {
      throw new Error(`No alias defined for "${emitAs}". Add it to tools/openapi-codegen/src/aliases.ts.`);
    }
    target[alias.spec].push({ source: alias.source, emitAs: alias.emitAs, unwrap: alias.unwrap });
  };
  for (const emitAs of publicAliases) {
    push(publicPerSpec, emitAs);
  }
  for (const emitAs of leafAliases) {
    push(leafPerSpec, emitAs);
  }

  return { wrappers, publicPerSpec, leafPerSpec, leafLocation };
}

function logVerbose(config: GenerateConfig, message: string): void {
  if (config.verbose === true) {
    console.warn(message);
  }
}

function buildRenameMaps(): Record<SpecSource, ReadonlyMap<string, string>> {
  // Per spec so e.g. CAPI `Story` → CapiStory while MAPI `Story` → MapiStory.
  // First-wins inside a spec so a duplicated source (InternalTagRequest used by
  // both InternalTagCreate and InternalTagUpdate) renames body refs to the
  // primary emit; secondaries are emitted as `type Sec = Primary;`.
  const maps: Record<SpecSource, Map<string, string>> = {
    capi: new Map(),
    mapi: new Map(),
    overlay: new Map(),
  };
  for (const alias of ALIASES) {
    const map = maps[alias.spec];
    if (!map.has(alias.source)) {
      map.set(alias.source, alias.emitAs);
    }
  }
  return maps;
}

function copyWrapperTemplates(
  outDir: string,
  wrappers: ReadonlySet<WrapperFile>,
  publicPerSpec: Record<SpecSource, KeepEntry[]>,
  leafPerSpec: Record<SpecSource, KeepEntry[]>,
  leafLocation: ReadonlyMap<string, 'public' | 'internal'>,
  sdk: 'mapi' | 'capi' | false | undefined,
): void {
  const typesDir = resolve(outDir, 'types');
  mkdirSync(typesDir, { recursive: true });

  for (const file of wrappers) {
    const src = resolve(TEMPLATES_DIR, `${file}.ts`);
    const body = readFileSync(src, 'utf8');
    writeFileSync(
      resolve(typesDir, `${file}.ts`),
      `// Generated by @storyblok/openapi-codegen. Do not edit by hand.\n`
      + `// Source template lives in tools/openapi-codegen/templates/.\n\n${
        body}`,
      'utf8',
    );
  }

  // Shared type-level helpers imported by the wrapper templates (and by consumer
  // code that builds on the generated types), so `Prettify` lives in one place
  // instead of being redefined per template.
  if (wrappers.size > 0) {
    writeFileSync(resolve(typesDir, '_utils.ts'), buildUtilsFile(), 'utf8');
  }

  writeFileSync(resolve(typesDir, '_sources.ts'), buildSourcesFile(publicPerSpec, leafPerSpec, leafLocation, sdk), 'utf8');
}

function buildUtilsFile(): string {
  return '// Generated by @storyblok/openapi-codegen. Do not edit by hand.\n\n'
    + 'export type Prettify<T> = { [K in keyof T]: T[K] } & {};\n\n'
    + '/** Replaces the keys of `T` that also appear in `U` with the definitions from `U`. */\n'
    + 'export type Override<T, U> = Prettify<Omit<T, keyof U> & U>;\n';
}

function buildSourcesFile(
  publicPerSpec: Record<SpecSource, KeepEntry[]>,
  leafPerSpec: Record<SpecSource, KeepEntry[]>,
  leafLocation: ReadonlyMap<string, 'public' | 'internal'>,
  sdk: 'mapi' | 'capi' | false | undefined,
): string {
  const header = '// Generated by @storyblok/openapi-codegen. Do not edit by hand.\n\n';
  const lines: string[] = [];
  for (const spec of ['capi', 'mapi', 'overlay'] as const) {
    const publicFileName = sdk === spec ? 'types-aliased.gen' : 'types.gen';
    // For each spec, group leaves by which file they ended up in: a leaf that
    // was ALSO an explicit `include` lives in the public types file; everything
    // else lives in `_internal.gen.ts`.
    const fromInternal: string[] = [];
    const fromPublic: string[] = [];
    for (const entry of leafPerSpec[spec]) {
      fromInternal.push(entry.emitAs);
    }
    for (const entry of publicPerSpec[spec]) {
      if (leafLocation.get(entry.emitAs) === 'public') {
        fromPublic.push(entry.emitAs);
      }
    }
    if (fromInternal.length > 0) {
      lines.push(`export type { ${fromInternal.sort().join(', ')} } from '../${spec}/_internal.gen';`);
    }
    if (fromPublic.length > 0) {
      lines.push(`export type { ${fromPublic.sort().join(', ')} } from '../${spec}/${publicFileName}';`);
    }
  }
  return `${header + lines.join('\n')}\n`;
}

export type { KnownType };
