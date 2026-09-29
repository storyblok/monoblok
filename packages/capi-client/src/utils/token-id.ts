/**
 * Derives a stable id from an access token for scoping cache keys, which end up in key
 * listings, `MONITOR` output, and logs where the token doesn't belong. Used for scoping,
 * never authentication, so a non-cryptographic hash (cyrb53) is enough.
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
