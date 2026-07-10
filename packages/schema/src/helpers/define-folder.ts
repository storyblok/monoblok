import type { Prettify } from '../utils/prettify';

/**
 * A block folder (Storyblok component group) content-shape definition. Identity
 * is the resolved name path — no UUID; the CLI matches/creates groups by path
 * at push time.
 */
export interface BlockFolder {
  name: string;
  parent?: BlockFolder;
  path: string;
}

type FolderPath<TName extends string, TParent extends BlockFolder | undefined>
  = TParent extends { path: infer P extends string } ? `${P}/${TName}` : TName;

type DefinedFolder<TName extends string, TParent extends BlockFolder | undefined> = Prettify<
  { name: TName; path: FolderPath<TName, TParent> }
  & (TParent extends BlockFolder ? { parent: TParent } : unknown)
>;

/**
 * Returns a {@link BlockFolder} definition. `path` is computed eagerly from the
 * `parent` chain (display names joined with `/`). Throws only on `/` in the
 * name (a programming error — it would corrupt path semantics).
 *
 * @example
 * const layout = defineFolder({ name: 'Layout' });
 * const heros = defineFolder({ name: 'Heros', parent: layout });
 * // heros.path === 'Layout/Heros'
 */
export function defineFolder<
  const TName extends string,
  const TParent extends BlockFolder | undefined = undefined,
>(input: { name: TName; parent?: TParent }): DefinedFolder<TName, TParent>;
export function defineFolder(input: { name: string; parent?: BlockFolder }): BlockFolder {
  if (input.name.trim() === '') {
    throw new Error(`defineFolder: folder name must not be empty`);
  }
  if (input.name.includes('/')) {
    throw new Error(`defineFolder: folder name "${input.name}" must not contain "/"`);
  }
  const path = input.parent ? `${input.parent.path}/${input.name}` : input.name;
  return input.parent
    ? { name: input.name, parent: input.parent, path }
    : { name: input.name, path };
}
