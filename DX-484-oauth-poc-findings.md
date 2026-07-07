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

- Scope catalog (`GET /v1/oauth_clients/metadata`) raw shape:
- Non-manager 403 shape from `/v1/oauth_clients`:
- Org not enabled for OAuth grants (if hit):
- Env-var client credentials path (`STORYBLOK_OAUTH_CLIENT_ID/SECRET`):
- Anything else:

## Runbook log

(Chronological notes per runbook step from the design doc, section "Manual runbook".)
