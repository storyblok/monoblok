import { describe, expect, it } from 'vitest';
import { waitForCallback } from './server';

const PATH = '/oauth/callback';
const callback = (port: number, query: string) => fetch(`http://127.0.0.1:${port}${PATH}${query}`);

describe('waitForCallback', () => {
  it('should resolve with code and state and serve a 200 success page', async () => {
    const pending = waitForCallback(4917, PATH);
    const response = await callback(4917, '?code=auth-code&state=state-abc');

    expect(response.status).toBe(200);
    await expect(pending).resolves.toEqual({ code: 'auth-code', state: 'state-abc' });
  });

  it('should serve a non-200 page and reject when the callback carries an error', async () => {
    // Attach the rejection assertion before triggering the callback so the
    // rejection is handled the moment it settles.
    const rejected = expect(waitForCallback(4918, PATH)).rejects.toThrow(/access_denied/);
    const response = await callback(4918, '?error=access_denied&error_description=denied');

    expect(response.status).toBe(400);
    await rejected;
  });

  it('should serve a non-200 page and reject when code or state is missing', async () => {
    const rejected = expect(waitForCallback(4919, PATH)).rejects.toThrow(/code and state/);
    const response = await callback(4919, '?code=only-code');

    expect(response.status).toBe(400);
    await rejected;
  });
});
