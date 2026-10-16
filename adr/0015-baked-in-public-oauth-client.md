# ADR-0015: Ship the CLI's OAuth Client Credentials in the Package

**Status:** Accepted **Date:** 2026-08-25

## Context

`storyblok login --oauth` runs the OAuth 2.0 authorization code flow against Storyblok. Every
authorization request needs a client id, and Storyblok's token endpoint takes a client secret
alongside it, so the CLI has to obtain both before it can open a consent page.

The first implementation made that the user's problem. A `storyblok oauth setup` command either
provisioned an integration app through `POST /v1/oauth_clients` with a Personal Access Token, which
requires an org manager role in an OAuth-enabled organization, or accepted a client id and secret
pasted by hand. Both paths defeated the point of the feature: a user who already has a PAT good
enough to provision an OAuth app can simply log in with that PAT, and the setup step stood between
every new user and their first login.

The blocker was never technical. It was the assumption that a value named "client secret" must be
kept out of a published npm package.

## Decision

**Bake the first-party "Storyblok CLI" app's client id and secret into
`packages/cli/src/lib/oauth/constants.ts`, treat the secret as public, and delete
`storyblok oauth setup`.**

1. **The client is a public OAuth client, so the secret is not a security boundary.** The CLI is
   installed on end-user machines. Anything shipped in it is readable by anyone who has it, whether
   it sits in a source constant, an obfuscated blob, or a value injected at build time. Declaring
   the secret public matches what is actually true rather than implying a confidentiality the
   distribution model cannot provide. `gh` and `gcloud` ship their client credentials the same way.
2. **PKCE is the actual protection.** Each login generates a `code_verifier` that never leaves the
   machine and sends only its challenge to the authorization server, so the baked-in credentials
   alone exchange nothing. The redirect URI is pinned to `http://localhost:4900/oauth/callback` and
   the callback server binds to loopback only, so an authorization code cannot be delivered off the
   machine.
3. **One app covers every region.** Regional endpoints accept the same client, so there is no
   per-region provisioning and no per-region entry for client credentials in the credential store.
   Logout clears a region's entry outright.
4. **`STORYBLOK_OAUTH_CLIENT_ID` and `STORYBLOK_OAUTH_CLIENT_SECRET` still override the baked-in
   client.** Both must be set together. This covers development against another app and self-hosted
   instances, and it is how manual QA points the CLI at a restricted app.
5. **Scopes are one hardcoded constant covering the full catalog.** A single consent then covers
   every command, which replaces the scope catalog the setup command used to fetch. The constant
   must stay a subset of the registered app's `allowed_scopes` or authorization fails with
   `invalid_scope`.

## Alternatives Considered

- **Keep `storyblok oauth setup`.** Rejected: it requires an org manager role and an OAuth-enabled
  org, so the users who can complete it are exactly the users who least need OAuth, and it gates
  first login behind a second command.
- **Inject the credentials at release time from a repository secret.** Rejected: the value still
  ships in the published bundle, so it buys no confidentiality. It costs a release-pipeline
  dependency and makes a local build unable to run the flow, which is a real loss for contributors
  and for manual testing.
- **Run the authorization code flow with no client secret at all.** This is the cleaner shape for a
  public client under RFC 8252, and it is where this should end up. It needs the token endpoint to
  accept a secretless exchange for this client, which is a backend change, so it is deliberately out
  of scope here.
- **Proxy the token exchange through a Storyblok-hosted service that holds the secret.** Rejected as
  disproportionate: it adds a service on the critical path of every login and every token refresh to
  protect a value that PKCE already makes non-load-bearing.

## Consequences

- **`storyblok login --oauth` needs no configuration.** No setup command, no PAT, no environment
  variables, no org role.
- **The published package contains a string labeled `client_secret`.** Anyone reading the bundle or
  a secret scanner pointed at it will find it. `constants.ts` and the login README both state
  explicitly that the value is public by design, so the next reader does not "fix" it by hiding it,
  which would break every install while protecting nothing.
- **The mitigation for compromise is rotation, not concealment.** If the app is compromised or
  misconfigured, rotate its credentials and release a patched CLI. Users on older versions then have
  to upgrade to log in, which is the cost this model accepts.
- **The app must stay registered as a public client with PKCE required.** Registering it as a
  confidential client would invalidate the reasoning above without any code changing, so that
  registration is part of the decision, not an implementation detail.
- **`storyblok oauth setup` is removed, a breaking change.** Anyone who provisioned a client through
  it logs in with `--oauth` directly instead, and the per-region `client` entry in
  `~/.storyblok/credentials.json` is no longer read.
- **A single consent grants the full scope catalog.** Users see a broad consent screen once rather
  than a narrow one per command. Adding a scope to the CLI means adding it to the registered app
  first.
