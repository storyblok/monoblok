// Refresh proactively when the access token has expired or will within the skew window.
export const isExpiringSoon = (expiresAt: string | undefined, skewMs = 120_000, nowMs: number = Date.now()): boolean => {
  if (!expiresAt) {
    return true;
  }
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) {
    return true;
  }
  return expiry - nowMs <= skewMs;
};
