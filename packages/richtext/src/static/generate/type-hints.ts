/**
 * Fallback type hints for extensions without Valibot schemas.
 * Currently only used for the `blok` extension attributes.
 */
export const hints: Record<string, string> = {
  id: 'string | null',
  body: 'SbBlokData[] | null',
};
