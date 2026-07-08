# DX-484 OAuth POC — Findings

**Environment:** production EU (`app.storyblok.com` / `mapi.storyblok.com`), sandbox org.
**Date:** <!-- fill in when the runbook runs -->
**CLI branch:** `feat/DX-484-oauth-login-poc`

## Must-answer questions

### 1. Does `offline_access` actually return a refresh token?
- **Answer:**
- **Evidence:** (raw `/oauth/token` response with secrets redacted)
- Share with the MCP team — they are blocked on this question.

### 2. Does refresh work as documented (new access token, refresh token unchanged)?
- **Answer:**
- **Note:** storyrails `token_endpoint.rb` revokes the old grant and issues a NEW refresh token on every
  refresh (rotation) — the "refresh token unchanged" expectation appears wrong at the code level.
  Record what actually happens.
- **Evidence:** (`oauth refresh` output)

### 3. Are expired-token vs missing-scope errors distinguishable (401 vs 403 shapes)?
- **Expired token (after 15 min):**
  - Status:
  - WWW-Authenticate header:
  - Body:
- **Missing scope (narrowed-scope grant):**
  - Status:
  - Body: (expected per code: `{"error": "Insufficient scope: <scope> is required"}`)
- **Verdict for the refresh-on-401 interceptor:**

### 4. Does find-or-create behave sanely on re-runs?
- **Answer:** (no duplicate apps? secret readable via show?)
- **Evidence:**

### 5. Does `/oauth/authorize` accept `dev_oauth_redirect_uri` as well as `oauth_redirect_uri`?
- **Answer:** (code says yes — `authorize_request.rb#redirect_urls_for`)
- **Evidence:**

### 6. Any surprises in consent UX with a CLI as the app?
- App name/icon rendering:
- Space selection step:
- `/oauth/init` vs direct `/oauth/authorize` entry:
- Other notes:

## Additional observations

- Scope catalog (`GET /v1/oauth_clients/metadata`) raw shape: **captured 2026-07-07.** `available_scopes` is an array of `{"resource": "...", "actions": ["read", "write", ...]}` groups (15 resources: asset_folders, assets, collaborators, comments, components, datasource_entries, datasources, releases, spaces, statistics, stories, tags, users, webhooks, workflows; releases and stories additionally have `publish`), plus `additional_scopes: ["offline_access"]`. Scope strings are built as `resource:action` (matches storyrails `token_scopeable.rb` VALID_SCOPES).
- `POST /v1/oauth_clients` returned **422 when created without a `slug`**: the App model validates slug format with no `allow_blank` plus global slug uniqueness (storyrails `app.rb`), so API consumers must send a unique slug even though the issue's sketch only mentions name/redirect/scopes. The CLI now sends `storyblok-cli-<base36 timestamp>`. (First run also sent `allowed_scopes: ["offline_access"]` only, due to a CLI-side flatten bug, but the scope-content validator only runs on update, so the slug is the confirmed 422 trigger; exact 422 body to be captured on re-run if it recurs.)
- Non-manager 403 shape from `/v1/oauth_clients`:
- Org not enabled for OAuth grants (if hit):
- Env-var client credentials path (`STORYBLOK_OAUTH_CLIENT_ID/SECRET`):
- Anything else:

## Runbook log

- 2026-07-07 step 1 (`oauth setup --token <PAT>`): PAT path reached the metadata + create endpoints (org manager role and `allow_oauth_grants` confirmed working). Create failed with 422; root causes: CLI flattened the grouped scope catalog to just `offline_access`, and no `slug` was sent. Both fixed in the CLI (scope mapping to `resource:action`, unique slug, 422 bodies now printed as evidence). Re-run pending.
