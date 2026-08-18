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
      Chromium blocks an http iframe as mixed content and you get a blank preview with no error in
      the app.
- [ ] **The certificate is locally trusted.** A self-signed cert fails inside an iframe with no
      visible prompt. Use `mkcert`, whose root CA is installed in the system trust store.
- [ ] **The browser will actually load a local app inside the editor's iframe.** Chrome blocks a
      public origin from embedding a private one (`net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`)
      and renders a `chrome-error` page in the frame, which looks identical to a dead bridge. Check
      the preview frame's URL, not just its emptiness. Automated runs need the checks disabled via
      launch args.
- [ ] **The app session already exists.** Log in once by hand in a headed browser and save the
      session state; do not automate a login form, and never put a password in the harness.

## 2. The chain, one link at a time

When the last box fails and the earlier ones pass, you have found a product defect. When an earlier
one fails, you have found a setup problem — fix it before reading anything into the later boxes.

- [ ] **The story exists and renders standalone.** Open the app's URL directly, outside the editor.
      If this fails, the seed or the token is wrong, not the bridge.
- [ ] **The preview frame is not blank.** In the editor, the app renders inside the preview iframe.
- [ ] **The rendered content matches the story you opened.** A stale or wrong story here means story
      identification is broken, not live updates.

## 3. Live updates

- [ ] **Typing in a field changes the preview before any save.** This is the `input` event. Assert
      the new text is visible in the preview, not that no error appeared.
- [ ] **Clicking an editable block in the preview selects it in the editor.** This proves the
      `v-editable` markers survived rendering.
- [ ] **A relation field stays resolved after an edit.** Bridge payloads resolve relations
      separately from the API call; a page can fetch resolved relations correctly and then lose them
      on the first keystroke.
- [ ] **An explicitly configured empty relation list stays empty.** An explicit value must win over
      any inherited fallback.
- [ ] **Saving and publishing re-renders with the saved content**, and the preview does not revert
      to the pre-edit version.

## 4. What to record

- [ ] Note every point where you had to read the source, hand-build something internal, or work
      around the API. Each one is a finding.
- [ ] Note which link in the chain each failure sat at. A bare timeout on a preview assertion is
      indistinguishable between six causes; naming the link is the finding.

## 5. Teardown

- [ ] **The space's preview domain was restored to what it was before you started.** You wrote it
      down in step 1; put it back. Nothing does this for you, and the next person to open the space
      in the editor gets a blank preview with no error if you skip it.

## Package harness contract

A package is covered when it provides all four:

1. A seed scenario mirroring the content tree its own demo/playground app expects.
2. An https dev target on a port that does not collide with existing ones.
3. An auth setup that fails fast with the command to regenerate the session.
4. One spec per rendered page, each asserting an observed change in the preview.
