export const OAUTH_CALLBACK_PORT = 4900;
export const OAUTH_CALLBACK_PATH = '/oauth/callback';
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;
export const OAUTH_APP_NAME = 'Storyblok CLI';
// Fallback when no scope list was stored at setup time (manual path).
export const DEFAULT_LOGIN_SCOPES = ['read_content', 'write_content', 'offline_access'];
