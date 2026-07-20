import { CommandError } from '../../utils';

// A grant with an empty/absent space list is not space-restricted (storyrails token_scopeable.rb).
export const assertSpaceAllowed = (
  space: string | number | undefined,
  grantedSpaces: { id: number }[] | undefined,
): void => {
  if (space === undefined || space === null || space === '') {
    return;
  }
  if (!grantedSpaces || grantedSpaces.length === 0) {
    return;
  }
  const target = Number(space);
  if (!grantedSpaces.some(granted => granted.id === target)) {
    const allowed = grantedSpaces.map(granted => granted.id).join(', ');
    throw new CommandError(
      `Space ${space} is not covered by your OAuth login (authorized spaces: ${allowed}).\n`
      + `Re-run \`storyblok login\` and select this space at the consent screen.`,
    );
  }
};

export const defaultGrantSpace = (grantedSpaces: { id: number }[] | undefined): number | undefined => {
  return grantedSpaces && grantedSpaces.length === 1 ? grantedSpaces[0].id : undefined;
};
