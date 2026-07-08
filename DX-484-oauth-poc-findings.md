# DX-484 OAuth POC Findings

**Environment:** production EU (`app.storyblok.com` / `mapi.storyblok.com`), sandbox org, space `monoblok-cli-qa` (290020686946333).
**Date:** 2026-07-07 (setup) / 2026-07-08 (full runbook).
**CLI branch:** `feat/DX-484-oauth-login-poc` (`storyblok oauth setup|login|call|refresh` POC commands).

## Must-answer questions

### 1. Does `offline_access` actually return a refresh token?

- **Answer: YES.** Requesting `offline_access` in the authorize scope returns a `refresh_token` from `POST /oauth/token`, both on the initial code exchange and on every refresh.
- **Evidence:** raw token response (redacted):

  ```json
  {
    "access_token": "sb_o…(masked)",
    "refresh_token": "sb_o…(masked)",
    "token_type": "bearer",
    "expires_in": 900,
    "scope": "asset_folders:read … workflows:write offline_access"
  }
  ```

  Notes: `expires_in` is 900 (15 min, matches `OauthGrant::ACCESS_TOKEN_LIFETIME`). Both token kinds use an `sb_o…` prefix (`sb_oat_` access / `sb_ort_` refresh). The response contains **no `space_ids` field**, although the grant is space-scoped by the consent selection; clients cannot learn the granted space(s) from the token response. Share this section with the MCP team.

### 2. Does refresh work as documented (new access token, refresh token unchanged)?

- **Answer: NO. The refresh token ROTATES on every refresh.** Each `grant_type=refresh_token` call returns a new access token AND a new refresh token; the old refresh token is revoked and single-use.
- **Evidence:**
  - `oauth refresh` (twice in a row): `access token changed: true`, `Refresh token rotated: true` both times; response keys `access_token, refresh_token, token_type, expires_in, scope`.
  - Reusing the pre-rotation refresh token: `400 Bad Request` `{"error": "invalid_grant", "error_description": "The provided access grant is invalid, expired, or revoked (…)"}`.
- **Matches the backend code** (`token_endpoint.rb#exchange_refresh_token` revokes the old grant and mints a new one; refresh expiry is a rolling 1-month window, `REFRESH_TOKEN_LIFETIME`).
- **Consequence for clients:** the stored refresh token MUST be atomically replaced after every refresh. A client that crashes between refresh and persist loses the session permanently (no recovery, re-login required). Concurrent refreshes from two processes sharing one credentials file will invalidate each other. The MAPI-client refresh interceptor needs a single-flight refresh + persist-before-use design.

### 3. Are expired-token vs missing-scope errors distinguishable (401 vs 403 shapes)?

- **Answer: YES, cleanly distinguishable by status code and body.**
- **Missing scope (grant narrowed to `stories:read offline_access`, calling `GET /v1/spaces/:id/components`):**
  - Status: `403 Forbidden`
  - WWW-Authenticate header: not set
  - Body: `{"error": "Insufficient scope: components:read is required"}`
  - In-scope control call (`GET /v1/spaces/:id/stories`) with the same token: `200 OK`.
- **Expired token (after 16 min, no refresh):**
  - Status: `401 Unauthorized`
  - WWW-Authenticate header: not set (general MAPI endpoints do not send it; only the dedicated `/oauth/*` info endpoints do)
  - Body: `{"error": "Unauthorized"}`
- **Refresh after expiry works:** with the expired access token, `oauth refresh` succeeded (rotated as usual) and the follow-up MAPI call returned `200 OK`, the exact refresh-on-401 interceptor scenario.
- **Verdict for the refresh-on-401 interceptor:** safe. 401 = token problem (refresh and retry), 403 = authorization problem (do NOT refresh; surface to the user). Discriminate on status code, not on the WWW-Authenticate header (absent on MAPI endpoints). The 403 body even names the missing scope, which is useful for error messages.

### 4. Does find-or-create behave sanely on re-runs?

- **Answer: YES.** Re-running `oauth setup --token <PAT>` finds the existing "Storyblok CLI" app by name, reads `oauth_identifier` + `oauth_secret` via `GET /v1/oauth_clients/:id` (`include_secret`), and stores them. `GET /v1/oauth_clients` afterwards shows exactly one app (no duplicates).
- **Gotchas found (create-time API contract):**
  - `POST /v1/oauth_clients` returns **422 without a `slug`**: the App model validates slug format with no `allow_blank` plus global slug uniqueness, so a create must send a unique slug (POC sends `storyblok-cli-<base36 timestamp>`). The productized setup command must handle slug collisions across orgs.
  - The scope catalog (`GET /v1/oauth_clients/metadata`) returns `available_scopes` as `[{"resource": "stories", "actions": ["read", "write", "publish"]}, …]` groups (15 resources) plus `additional_scopes: ["offline_access"]`; valid scope strings are `resource:action` (32 scopes total with `offline_access`).

### 5. Does `/oauth/authorize` accept `dev_oauth_redirect_uri` as well as `oauth_redirect_uri`?

- **Answer: YES.** With the app configured as `oauth_redirect_uri = http://localhost:4900/oauth/callback` and `dev_oauth_redirect_uri = http://localhost:4901/oauth/callback` (set via `PUT /v1/oauth_clients/:id`), a full authorize + code exchange against port 4901 succeeded. Both URIs are valid concurrently (matches `authorize_request.rb#redirect_urls_for`), so dev vs prod ports can coexist on one app.

### 6. Any surprises in consent UX with a CLI as the app?

- App name renders as "Storyblok CLI" with a placeholder icon (integration apps have no icon upload in this flow); acceptable for a CLI.
- Space selection is part of the consent screen; the resulting grant is scoped to the selected space(s). The token response does not echo the selected `space_ids` back (see Q1), so the CLI cannot confirm programmatically which space was authorized without trying a call or using grant introspection (`GET /oauth/grant` with the access token).
- Entry via `GET /oauth/init` on the MAPI host works as the documented client entry point (bounces through the app frontend to prime the session, then `/oauth/authorize`); no session problems observed when already logged in to the app in the browser.
- Narrowed scope requests work: requesting a subset (`stories:read offline_access`) of the app's 32 allowed scopes shows only the read permission on the consent screen and issues a grant with exactly that scope (confirmed visually by the operator).
- No other UX surprises: consent wording, space picker, and redirects all behaved as expected across both consent runs (operator confirmed).

## Additional observations

- **Env-var client credentials path works:** with `oauth.eu.client` removed from `credentials.json` and `STORYBLOK_OAUTH_CLIENT_ID` / `STORYBLOK_OAUTH_CLIENT_SECRET` set, `oauth login` completes normally, so the zero-setup CI/scripting path is viable.
- **Token endpoint is form-encoded:** `POST /oauth/token` expects `application/x-www-form-urlencoded` (Rack::OAuth2), not JSON.
- **PKCE:** S256 verified working end-to-end (43-128 char verifier, `[A-Za-z0-9-._~]`); mandatory for scoped grants per backend code.
- **Org prerequisites for `/v1/oauth_clients`:** requires `can_manage_org?` (else 403 "You can not access this endpoint with your role on Organization") and the org `allow_oauth_grants` flag (else 403 "Organization is not enabled for OAuth grants"). The sandbox org had both; the non-manager 403 was not exercised (no non-manager PAT available).
- **Auth header formats:** PAT calls use `Authorization: <token>`; OAuth grant tokens use `Authorization: Bearer <token>`.
- **`token_type` in the response is lowercase `"bearer"`.**

## Runbook log

- 2026-07-07 step 1 (`oauth setup --token <PAT>`): first attempt returned 422; root causes were a CLI-side scope flatten bug and the missing `slug` (see Q4). Fixed in `69f2347a4`; re-run created the app with all 32 scopes + `offline_access`.
- 2026-07-08 step 2 (re-run setup): find-or-create confirmed, one app, secret readable (Q4).
- 2026-07-08 step 3 (`oauth login`, full scopes): browser consent OK, tokens persisted, refresh token present (Q1).
- 2026-07-08 step 4 (`oauth call --space 290020686946333`): `200 OK` with `Bearer` access token.
- 2026-07-08 step 5 (`oauth refresh` ×2 + old-token reuse): rotation confirmed, old refresh token `invalid_grant` (Q2).
- 2026-07-08 step 6 (`PUT /v1/oauth_clients/:id` dev redirect + `oauth login --port 4901 --scope stories:read offline_access` with env-var client creds, stored client removed): success (Q5, env-var path, narrowed scope).
- 2026-07-08 step 7 (probes with narrowed grant): stories `200` vs components `403 Insufficient scope` (Q3).
- 2026-07-08 step 8 (16-min wait, `oauth call`): `401 {"error": "Unauthorized"}`, no WWW-Authenticate header (Q3); `oauth refresh` afterwards recovered the session (`200 OK`).
