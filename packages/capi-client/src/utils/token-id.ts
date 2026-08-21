/**
 * Derives a short, stable id from an access token, for namespacing cache keys.
 *
 * Cache keys end up in places the token itself does not belong: key listings, `MONITOR`
 * output, metrics labels, log lines from a shared external provider. The id is used for
 * scoping, never for authentication, so a fast non-cryptographic hash is enough. It only
 * has to be stable across processes and distinct for distinct tokens.
 *
 * cyrb53, which mixes 53 bits, so collisions between the handful of tokens one deployment
 * uses are not a practical concern.
 */
export const createTokenId = (accessToken: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < accessToken.length; i++) {
    const char = accessToken.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 2_654_435_761);
    h2 = Math.imul(h2 ^ char, 1_597_334_677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507) ^ Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507) ^ Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);

  return (4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0)).toString(36);
};
