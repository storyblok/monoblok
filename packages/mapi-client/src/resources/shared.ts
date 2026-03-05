export interface SpaceIdPathOverride {
  path?: {
    space_id?: number;
  };
}

export function resolveSpaceId(spaceId: number | undefined, path?: SpaceIdPathOverride['path']): number {
  const resolvedSpaceId = path?.space_id ?? spaceId;

  if (resolvedSpaceId === undefined) {
    throw new Error('Missing space_id. Provide `spaceId` when creating the client or pass `path.space_id` to the request method.');
  }

  return resolvedSpaceId;
}
