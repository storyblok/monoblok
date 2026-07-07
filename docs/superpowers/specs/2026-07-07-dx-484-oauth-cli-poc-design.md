# DX-484 — POC: OAuth Authorization Code Grant login in the CLI

**Status:** Approved design (POC — throwaway code, the deliverable is verified answers)
**Issue:** [DX-484](https://linear.app/storyblok/issue/DX-484)
**Branch/worktree:** `feat/DX-484-oauth-login-poc` → `.worktrees/feat-DX-484-oauth-login-poc`
**Environment:** Production EU (`app.storyblok.com` / `mapi.storyblok.com`) with the sandbox org. The two spaces with PATs in `.env.qa-engineer-manual` are available for manual tests.

## Goal

Prove the full OAuth Authorization Code Grant flow end-to-end against the real backend, covering both client-provisioning paths, and produce verified answers to the issue's "must answer" list in a findings doc.

## Backend facts (from storyrails code — POC verifies empirically)

Source: `../storyrails` (`app/controllers/v1/oauth_controller.rb`, `app/controllers/v1/oauth_clients_controller.rb`, `app/services/authn/token_auth/token_endpoint.rb`, `app/services/authn/token_auth/authorize_request.rb`, `app/models/oauth_grant.rb`, `app/controllers/concerns/scope_enforceable.rb`).

- Endpoints live on the region API host (EU: `mapi.storyblok.com`):
  - `GET /oauth/init` — documented client entry point; bounces to `app.storyblok.com/#/oauth/init` to prime the session, then to `/oauth/authorize`.
  - `GET /oauth/authorize` / `POST /oauth/authorize` (consent approval).
  - `POST /oauth/token` — grant types: `authorization_code`, `refresh_token`, `client_credentials`. Requires `client_id` + `client_secret` (confidential client), exact `redirect_uri` match with the authorize request.
  - `GET/POST /v1/oauth_clients`, `GET /v1/oauth_clients/:id` (returns `oauth_secret` via `include_secret`), `GET /v1/oauth_clients/metadata` (scope catalog: `available_scopes` grouped + `additional_scopes` incl. `offline_access`).
- PKCE S256 is **mandatory** for scoped grants. Verifier: 43–128 chars of `[A-Za-z0-9-._~]`.
- `offline_access` scope → refresh token issued. Access token lifetime **15 minutes**, refresh token lifetime **1 month**.
- On `refresh_token` grant the old grant is **revoked and a new refresh token is issued** (rotation) — this contradicts the "refresh token unchanged" wording in the issue; capture the observed behavior as a headline finding.
- Missing scope → `403 {"error": "Insufficient scope: <scope> is required"}`. Expired/invalid token → 401. Shapes look distinguishable; capture raw bodies of both.
- `dev_oauth_redirect_uri` is accepted at authorize alongside `oauth_redirect_uri` (`authorize_request.rb#redirect_urls_for`).
- `/v1/oauth_clients` requires `can_manage_org?` (else `403 {"error": "You can not access this endpoint with your role on Organization"}`) **and** the org's `allow_oauth_grants` flag (else `403 {"error": "Organization is not enabled for OAuth grants"}`). Sandbox-org precondition to verify first.
- Consent includes **space selection**; grants are space-scoped (`space_ids`). MAPI probes must target a space selected at consent.

## Command surface

All new code under `packages/cli/src/commands/oauth/` following the CLI command patterns (`index.ts` command definitions, `actions.ts` for API/filesystem work, `getUI()`/`getLogger()`, typed `APIError`/`CommandError`). The existing `login` command is untouched.

Fixed callback: `http://localhost:4900/oauth/callback` (port is an arbitrary one-line constant).

### `storyblok oauth setup`

One-time client provisioning per org/region. Interactive by default (select path); non-interactive via flags.

- **PAT path** (`--token <PAT>` or interactive prompt): find-or-create an Integration app named "Storyblok CLI" via `GET /v1/oauth_clients` → match by name → `GET /v1/oauth_clients/:id` for the secret, else `POST /v1/oauth_clients` with `name`, `oauth_redirect_uri: http://localhost:4900/oauth/callback`, `allowed_scopes`: full catalog from `metadata` + `offline_access`. Read `oauth_identifier`/`oauth_secret`, store, discard the PAT (never persisted).
  - 403 (non-manager) → clear error pointing at the manual path ("ask your org admin for a client id/secret").
  - 403 (org not enabled for OAuth grants) → surfaced verbatim.
- **Manual path** (`--client-id <id> --client-secret <secret>` or interactive prompts): validate non-empty, store.
- `--region <region>` supported; defaults to `eu`.

### `storyblok oauth login`

1. Resolve client credentials: `STORYBLOK_OAUTH_CLIENT_ID`/`STORYBLOK_OAUTH_CLIENT_SECRET` env vars → `credentials.json` → error pointing at `oauth setup`.
2. Start `node:http` callback server on port 4900; generate PKCE verifier/challenge (S256) + random `state`.
3. Open browser (existing `open` dependency) to `https://mapi.storyblok.com/oauth/init?client_id=…&redirect_uri=…&response_type=code&scope=…&state=…&code_challenge=…&code_challenge_method=S256`.
4. On callback: validate `state`, exchange `code` + `code_verifier` + client secret at `POST /oauth/token`, respond with a minimal "you can close this tab" page, shut the server down.
5. Persist tokens (see storage). Print granted scopes + space ids.

POC-only flags: `--scope <scopes>` overrides the requested scope list (defaults to the full allowed catalog + `offline_access`; used to force the insufficient-scope 403), and `--port <port>` overrides the callback port/redirect URI (used for the `dev_oauth_redirect_uri` experiment — the app's dev redirect is set beforehand via `PUT /v1/oauth_clients/:id` or the UI).

### `storyblok oauth call [path] [--space <id>]` (probe, throwaway)

Calls a MAPI endpoint (default `GET /v1/spaces/:space_id`) with the stored access token; prints HTTP status and raw body. Evidence collector for the 401-vs-403 question and for post-login/post-refresh verification.

### `storyblok oauth refresh` (probe, throwaway)

Forces a `refresh_token` grant at `POST /oauth/token`, persists the new tokens, and prints whether the refresh token changed (rotation check).

## Credentials storage

Same `~/.storyblok/credentials.json` (mode 0600, existing `saveToFile` util). New `oauth` section next to the existing PAT entries, keyed per region:

```json
{
  "api.storyblok.com": { "login": "…", "password": "…", "region": "eu" },
  "oauth": {
    "eu": {
      "client": { "client_id": "…", "client_secret": "…" },
      "tokens": {
        "auth_type": "oauth",
        "access_token": "…",
        "refresh_token": "…",
        "expires_at": "2026-07-07T12:34:56.000Z"
      }
    }
  }
}
```

Env vars `STORYBLOK_OAUTH_CLIENT_ID`/`STORYBLOK_OAUTH_CLIENT_SECRET` override the stored `client` block everywhere (the CI/scripting path — works with zero setup).

## Deliverable

`DX-484-oauth-poc-findings.md` at the worktree root:

- Each "must answer" question → observed behavior + raw request/response evidence (redacted secrets).
- Headline: refresh-token rotation observed vs. the "refresh token unchanged" expectation.
- Consent UX notes (app name/icon rendering, space-selection step) with the CLI as the app.
- Shared verbatim with the MCP team (they're blocked on the `offline_access` question).

### Manual runbook (user drives browser/consent)

1. `oauth setup --token <PAT>` against the sandbox org → app created; note response.
2. Re-run `oauth setup` → find-or-create: no duplicate app; secret readable via show.
3. `oauth setup` with a non-manager PAT (if available) → capture the 403 and the manual-path hint.
4. `oauth login` → full browser flow; note consent UX; tokens persisted.
5. `oauth call` → 200 with fresh token.
6. Narrowed-scope authorize (`oauth login --scope read_content offline_access`) → `oauth call` against an endpoint outside the granted scopes → capture the 403 shape.
7. Wait ≥15 min → `oauth call` → capture the 401 shape.
8. `oauth refresh` → new access token works; record whether the refresh token rotated.
9. Set `dev_oauth_redirect_uri` on the app (different port, via `PUT /v1/oauth_clients/:id`) → `oauth login --port <devport>` → does authorize accept it?
10. `STORYBLOK_OAUTH_CLIENT_ID`/`SECRET` env-var path → `oauth login` with no stored client creds.

## Testing / verification

Throwaway POC: no unit tests. `pnpm nx lint:fix storyblok` and typecheck must pass. Verification is the manual runbook + findings doc.

## Out of scope (per issue)

Logout/revocation, MAPI-client refresh interceptor, multi-region credentials handling, packaging/UX polish, default-scope policy for the auto-created app.
