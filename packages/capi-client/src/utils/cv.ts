import { isDraftRequest } from './request';

export const extractCv = (maybeData: unknown) => {
  return maybeData && typeof maybeData === 'object' && 'cv' in maybeData
    ? typeof maybeData.cv === 'number'
      ? maybeData.cv
      : undefined
    : undefined;
};

export const applyCvToQuery = (
  query: Record<string, unknown>,
  cv: number,
) => {
  if (isDraftRequest(query)) {
    return query;
  }

  if (query.cv !== undefined) {
    return query;
  }

  return {
    ...query,
    cv,
  };
};
