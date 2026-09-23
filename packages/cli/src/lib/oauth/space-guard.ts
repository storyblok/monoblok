import { CommandError, formatSpaceNotAllowedMessage } from "../../utils";

// A grant with an empty/absent space list is not space-restricted (storyrails token_scopeable.rb).
export const assertSpaceAllowed = (
  space: string | number | undefined,
  grantedSpaces: { id: number }[] | undefined,
): void => {
  if (space === undefined || space === null || space === "") {
    return;
  }
  if (!grantedSpaces || grantedSpaces.length === 0) {
    return;
  }
  const target = Number(space);
  if (!grantedSpaces.some((granted) => granted.id === target)) {
    throw new CommandError(
      formatSpaceNotAllowedMessage(
        space,
        grantedSpaces.map((granted) => granted.id),
      ),
    );
  }
};
