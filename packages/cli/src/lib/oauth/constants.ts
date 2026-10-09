export const OAUTH_CALLBACK_PORT = 4900;
export const OAUTH_CALLBACK_PATH = "/oauth/callback";
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;

// Credentials of the first-party "Storyblok CLI" integration app, baked into the CLI so that
// `login --oauth` needs no configuration. One app covers every region.
//
// `OAUTH_CLIENT_SECRET` IS NOT A SECRET. The CLI is a public OAuth client (RFC 8252): it is
// installed on end-user machines, so anything shipped in it is readable by anyone who has it.
// Treating this value as confidential would be security theater. What actually protects the
// authorization code exchange is PKCE (see pkce.ts) — the code_verifier is generated per login
// and never leaves the machine, so possessing this value alone mints nothing. The redirect URI
// is pinned to loopback, which keeps a code from being delivered anywhere else.
//
// Consequences worth knowing before touching these lines:
// - Do not move them to a build-time inject, a vault, or an env var to "protect" them. The same
//   value would still ship in the published bundle; the only result is a broken install.
// - Do rotate the app's credentials (and release a patched CLI) if the app itself is
//   compromised or misconfigured — rotation, not concealment, is the mitigation here.
// - The app must stay registered as a public client with PKCE required. If it is ever switched
//   to a confidential client, this comment stops being true and the flow needs rethinking.
export const OAUTH_CLIENT_ID = "2SiP2iS5Bef9iFNuIqnd3Q==";
export const OAUTH_CLIENT_SECRET =
  "ggtmjH1yp0/0F7Nrk7fGS7T86QjwDiXd9LES8ki4rOgOY51bnGVZdcVoLROcb3oma4TiXXWiQ1aOkk6zKFYsfQ==";

// Scopes requested at login. This mirrors the full catalog (storyrails token_scopeable.rb
// GROUPED_SCOPES plus OauthGrant::ADDITIONAL_SCOPES) so one consent covers every command,
// and it must stay a subset of the app's registered allowed_scopes or the authorization
// request is rejected as invalid_scope.
export const OAUTH_LOGIN_SCOPES = [
  "asset_folders:read",
  "asset_folders:write",
  "assets:read",
  "assets:write",
  "collaborators:read",
  "collaborators:write",
  "comments:read",
  "comments:write",
  "components:read",
  "components:write",
  "datasource_entries:read",
  "datasource_entries:write",
  "datasources:read",
  "datasources:write",
  "releases:read",
  "releases:write",
  "releases:publish",
  "spaces:read",
  "spaces:write",
  "statistics:read",
  "stories:read",
  "stories:write",
  "stories:publish",
  "tags:read",
  "tags:write",
  "taxonomies:read",
  "taxonomies:write",
  "users:read",
  "users:write",
  "webhooks:read",
  "webhooks:write",
  "workflows:read",
  "workflows:write",
  "offline_access",
];
