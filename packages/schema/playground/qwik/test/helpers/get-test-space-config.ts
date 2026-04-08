export function getTestSpaceConfig(index = 0) {
  const spaceIds = process.env.TEST_STORYBLOK_SPACE_ID?.split(',') ?? [];
  const previewTokens = process.env.TEST_STORYBLOK_PREVIEW_TOKEN?.split(',') ?? [];
  const mapiToken = process.env.STORYBLOK_TOKEN; // single value for MAPI

  if (!spaceIds[index] || !previewTokens[index] || !mapiToken) {
    throw new Error(`Missing test space config at index ${index}`);
  }

  return {
    spaceId: Number(spaceIds[index]),
    previewToken: previewTokens[index],
    mapiToken,
  };
}

export type TestSpaceConfig = ReturnType<typeof getTestSpaceConfig>;
