export const OAUTH_CALLBACK_PORT = 4900;
export const OAUTH_CALLBACK_PATH = '/oauth/callback';
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;
export const OAUTH_APP_NAME = 'Storyblok CLI';
// Fallback scopes when no allowed-scope list was stored at setup time (BYO/manual path).
// Grant scopes use the `resource:action` format (storyrails token_scopeable.rb).
export const DEFAULT_LOGIN_SCOPES = ['stories:read', 'stories:write', 'offline_access'];
