# Visual Editor checks

**Gate:** you are testing a feature that renders Storyblok content a person can change while the
page is open, or that registers the Storyblok Bridge. One yes and this checklist is part of your
test plan. Skip for data-fetching-only changes, type-only changes, codegen output, and anything that
never runs in a browser.

**The failure mode is silence.** A broken bridge does not throw. The page renders the story it
fetched and then never changes again. Looking for exceptions will not find this, so every box below
asserts a change you observed, never the absence of an error.

## 1. Prerequisites

None of these are about content, and every one of them blocks the whole test if missed.

- [ ] **The space's preview domain points at your local app.** Read it before you change it, and
      change it only in a space you have confirmed nobody else is using.
- [ ] **The local app is served over https.** The editor runs on `https://app.storyblok.com`;
      browsers block an http iframe as mixed content and you get a blank preview with no error in
      the app.
- [ ] **The certificate is accepted.** A self-signed cert fails inside an iframe with no visible
      prompt. Playwright's `ignoreHTTPSErrors: true` covers it; a browser you drive yourself needs
      the cert trusted, e.g. with `mkcert`.
- [ ] **The browser will actually load a local app inside the editor's iframe.** Chrome blocks a
      public origin from embedding a private one (`net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`)
      and renders a `chrome-error` page in the frame, which looks identical to a dead bridge. Check
      the preview frame's URL, not just its emptiness. Automated runs need the checks disabled via
      launch args.
- [ ] **The app session already exists.** Log in once by hand in a headed browser and save the
      session state; do not automate a login form, and never put a password in the harness.

## 2. Per-run setup

Every step writes to the QA space. Confirm it is free first.

```bash
set -a && source ./.env.qa-engineer-manual && set +a

# Once per machine: log in by hand, the session saves itself.
node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs

# Read and RECORD the `current:` domain this prints; you restore it in step 5.
bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh

# Point the preview at the local app (read-only without --confirm).
bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh \
  --domain https://localhost:<port>/ --confirm

# Seed the content tree the app expects. This wipes the space first.
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario <scenario> --scenario-dir packages/<package>/test/scenarios
```

The package's `test/GUIDE.md` names its port, its scenario, and anything else the seed needs.

## 3. The chain, one link at a time

When the last box fails and the earlier ones pass, you have found a product defect. When an earlier
one fails, you have found a setup problem. Fix it before reading anything into the later boxes.

- [ ] **The story exists and renders standalone.** Open the app's URL directly, outside the editor.
      If this fails, the seed or the token is wrong, not the bridge.
- [ ] **The preview frame is not blank.** In the editor, the app renders inside the preview iframe.
- [ ] **The rendered content matches the story you opened.** A stale or wrong story here means story
      identification is broken, not live updates.

## 4. Live updates

- [ ] **Typing in a field changes the preview before any save.** This is the `input` event. Assert
      the new text is visible in the preview, not that no error appeared.
- [ ] **Clicking an editable block in the preview selects it in the editor.** This proves the
      `data-blok-c` / `data-blok-uid` attributes survived rendering.
- [ ] **A relation field stays resolved after an edit.** Bridge payloads resolve relations
      separately from the API call; a page can fetch resolved relations correctly and then lose them
      on the first keystroke.
- [ ] **An explicitly configured empty relation list stays empty.** An explicit value must win over
      any inherited fallback.
- [ ] **Saving and publishing re-renders with the saved content**, and the preview does not revert
      to the pre-edit version.

## 5. Teardown

- [ ] **The space's preview domain was restored to what it was before you started.** You recorded it
      in step 2; put it back with the same script. Nothing does this for you, and the next person to
      open the space in the editor gets a blank preview with no error if you skip it.

## 6. What to record

- [ ] Note every point where you had to read the source, hand-build something internal, or work
      around the API. Each one is a finding.
- [ ] Note which link in the chain each failure sat at. A bare timeout on a preview assertion is
      indistinguishable between six causes; naming the link is the finding.

## Driving it

Write a one-off script, run it, throw it away. Start from
[`examples/visual-editor-run.mjs`](./examples/visual-editor-run.mjs): copy it to `.claude/tmp/`,
edit the constants at the top, run it. It has the launch args, the saved session, the story-id
lookup, and the block-selection retry already wired up, and it prints the standard `{ outcome, … }`
JSON.

Two things about the editor's DOM that are not guessable, and that the example encodes:

- **Address fields by their technical name, not their label.** Labels are translated and re-worded.
  The input id is `<storyId>__<fieldName>-<blokUid>`, so `input[id*="headline"]` is stable.
- **A click must be proven to have switched forms.** The story-level form carries fields with the
  same technical names as its blocks, so a swallowed click silently edits the story field instead.
  Assert the input's id changed; that is the only evidence the editor moved to the block's own form.

Where a package already keeps a harness, reuse its page object rather than the example: it is the
maintained copy of these selectors. `@storyblok/nuxt` keeps one in
`packages/nuxt/test/visual-editor/editor.page.ts`.
