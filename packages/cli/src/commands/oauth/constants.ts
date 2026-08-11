export const OAUTH_CALLBACK_PORT = 4900;
export const OAUTH_CALLBACK_PATH = "/oauth/callback";
export const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;

// First-party OAuth client baked into the CLI, the same model `gh` and `gcloud` use: the user
// supplies nothing. This is a public client, so the secret is not a security boundary; PKCE
// protects the code exchange. One integration app covers every region.
// TODO(DX-490): replace both placeholders with the registered "Storyblok CLI" app credentials.
export const OAUTH_CLIENT_ID = "REPLACE_WITH_STORYBLOK_CLI_OAUTH_CLIENT_ID";
export const OAUTH_CLIENT_SECRET = "REPLACE_WITH_STORYBLOK_CLI_OAUTH_CLIENT_SECRET";
// Marks the values above as not-yet-provisioned, so a build without real credentials fails
// with an explanation instead of sending the user to a broken authorization page.
export const OAUTH_CLIENT_PLACEHOLDER_PREFIX = "REPLACE_WITH_";

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
