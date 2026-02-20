import { isCdnPath, isDraftRequest } from './request';

const toCv = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const extractCv = (result: unknown): number | undefined => {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const payload = result as {
    data?: unknown;
    error?: unknown;
  };

  if (payload.error !== undefined || !payload.data || typeof payload.data !== 'object') {
    return undefined;
  }

  return toCv((payload.data as Record<string, unknown>).cv);
};

export const applyCvToQuery = (
  path: string,
  query: Record<string, unknown>,
  cv: number | undefined,
) => {
  if (!isCdnPath(path) || isDraftRequest(query)) {
    return query;
  }

  if (cv === undefined || query.cv !== undefined) {
    return query;
  }

  return {
    ...query,
    cv,
  };
};
