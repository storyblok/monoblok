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

Every step writes to the QA space. Confirm it is free first: **one space is shared across packages,
and seeding wipes it**, so a run for one package destroys another package's seeded content. Say in
your report which package's content the space now holds.

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
      to the pre-edit version. **Assert the reload, not the text.** Live preview has already morphed
      the new text into the page before you click Save, so `expect(preview).toContainText(saved)`
      passes even with a completely dead reload path. Count preview-frame navigations
      (`page.on("framenavigated")`) and assert the count rose, then confirm the space itself over
      MAPI/CAPI (`story.published`, the draft's field value). Two traps sit in here: clicking Save
      the instant after `fill()` persists the _previous_ value, because the app's own model lags the
      input; and publishing a story whose relations point at unpublished stories opens an
      "Unpublished linked story" modal, so nothing publishes until you dismiss it, and a bare
      `count()` on that button races its render.

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
[`examples/visual-editor-run.mjs`](./examples/visual-editor-run.mjs) and make it your own: copy it
to `.claude/tmp/`, point the constants at the story and app you are testing, then rewrite the body
to assert what your feature actually does. It is a starting point, not a suite to run as it stands.
What it saves you is the plumbing: the launch args, the saved session, the story-id lookup, the
block-selection retry, and the standard `{ outcome, … }` JSON.

Four things about the editor's DOM that are not guessable, and that the example encodes:

- **Address blocks by the `_uid` the scenario seeded, not by a test attribute.** `storyblokEditable`
  emits `data-blok-uid="<storyId>-<uid>"` on every editable block, so
  `[data-blok-uid$="-teaser-home-1"]` works in any framework and needs nothing added to the app's
  components. Fall back to `[data-test]` only where the app already has it.
- **Opening a second story in the same tab does not reload the preview.** The editor URL differs
  only in its hash, so the app swaps the form while the iframe keeps the previous story. Every later
  assertion times out against the wrong page and reads as a dead bridge. Force a `page.reload()`.
- **Address fields by their technical name, not their label.** Labels are translated and re-worded.
  The input id is `<storyId>__<fieldName>-<blokUid>`, so `input[id*="headline"]` is stable.
- **A click must be proven to have switched forms.** The story-level form carries fields with the
  same technical names as its blocks, so a swallowed click silently edits the story field instead.
  Assert the input's id changed; that is the only evidence the editor moved to the block's own form.

Check the dev server too, before you read anything into a blank preview:

- A dev server that **daemonizes** (Astro 7's `astro dev` does whenever stdout is not a TTY) exits
  immediately after printing a banner, so `nohup … &` and Playwright's `webServer` both see an early
  exit, and killing a pid you captured leaves the real server running. Use the tool's own
  `status`/`logs`/`stop` commands.
- A **`--port` request is not a guarantee**: a taken port silently becomes the next free one, and
  the space then previews a port nothing serves. Read the port back from the banner and set the
  preview domain from that, never from what you asked for.
- A **stale server from an earlier run serves stale code**, which makes a fixed bug look unfixed.

Where a package already keeps a harness, reuse it rather than the example. The page object, the
preflight checks, and the Playwright config are shared across packages in `tools/visual-editor-qa/`;
a package supplies only its `test/visual-editor/qa.config.ts` and its specs. Its `test/GUIDE.md`
says whether it has a harness at all.
