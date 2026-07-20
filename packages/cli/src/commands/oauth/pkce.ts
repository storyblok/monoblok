import { createHash, randomBytes } from 'node:crypto';

export const generatePkce = (): { verifier: string; challenge: string } => {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

export const generateState = (): string => randomBytes(16).toString('base64url');
