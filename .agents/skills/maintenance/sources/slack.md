# Source: Slack

Channel, DX user group, DX team channel, topics and workspace come from the local config (see Config
in `SKILL.md`). Read-only tools only; load them with ToolSearch. Private channels and DMs
(`slack_search_public_and_private`) need the user's consent.

## Verdicts

Every post from the last 90 days gets one verdict. A verdict describes the thread, never its age, so
a cached one stays valid as days pass; age is applied when listing.

Judge from the end of the thread and take the first verdict that fits:

1. `answered`: the thread has a done marker.
2. `promise`: DX made a promise or offer (a fix, an answer, a docs change) that is not done yet,
   even if thanks or follow-ups came after it. It can be concrete ("I'll open a PR") or vague
   ("we'll look into it soon").
3. `open`: the last ask to DX has no DX reply after it. A follow-up such as "that didn't work" or
   "any update?" is a new ask. A "+1" or "same here" from someone else is not an answer.
4. `not-dx`: nothing for DX to do: not addressed to DX, an announcement or cc, a topic the DX team
   does not own (including every topic in `notDxTopics`), or a wait on another team's change.
5. `answered`: everything else, e.g. DX or someone else answered the ask in substance, or the thread
   ends in thanks for an answer.

A DX member is a member of the `dxTeamChannelId` channel. List them once per run with
`slack_list_channel_members` (`response_format: "ids_only"`; listing this configured channel needs
no further consent) and match the user ID that each message shows in parentheses. Only their replies
count as DX answers or DX promises.

**Done marker**: a check-style reaction (`white_check_mark` ✅, `heavy_check_mark`,
`ballot_box_with_check`, `done`, `resolved`) on the parent post or on any reply (the thread read
shows reactions per message). A marker on the parent closes the thread. After a marker on a reply,
later replies reopen the thread only when they ask DX something new. Other reactions (`eyes`,
thumbs) mean nothing.

**Note**: every verdict is stored with a note that starts with the parent post's date. A `promise`
note has the form `<parent date>; promise <YYYY-MM-DD> vague|concrete: <what was promised>`, so the
30-day rule can be applied to cache hits without reading the thread.

## Steps

1. **Read the channel.** `slack_read_channel` with `limit: 25` and `oldest` set to now minus 90 days
   (Unix seconds), in the default detailed format (concise has no timestamps, which the permalinks
   need). Skip join messages. Always follow the returned cursor to the end, since pages are not
   guaranteed newest first.
2. **Fingerprint each post.** Build it from the channel read, using the strings as shown:
   `replies=13;last=2026-10-30 11:10:18 CET`, or `replies=0` without replies. When the post has a
   Reactions line, append `;reactions=<its value, without the label>`, e.g. `...;reactions=eyes (1)`
   or `...;reactions=eyes (1), white_check_mark (1)`, so that a new reaction invalidates the cache.
   Quote the fingerprint as one shell argument.
3. **Look up the cache.**
   `bash .agents/skills/maintenance/scripts/slack-cache.sh get <ts> <fingerprint>`. A hit means the
   thread is unchanged: reuse its verdict and skip to step 5.
4. **Judge the rest.** A done marker on the parent makes the post `answered` without a thread read.
   Posts without replies need no thread read either: judge them from the channel read. Read the
   others with `slack_read_thread` in the default format (concise has no reply timestamps). For 10
   or more threads, hand them to one subagent that reads this file's Verdicts section and returns
   `ts`, verdict and note per thread. The main session records every verdict with
   `slack-cache.sh put <ts> <fingerprint> <answered|not-dx|open|promise> <note>`. The first run
   reads everything; later runs read only new or changed threads.
5. **Re-check what would be listed.** For an `open` or `promise` thread served from the cache,
   reactions on replies are not in the fingerprint, so read the thread once for a done marker. For
   every `promise`, cached or not, check whether it is done: a merged PR counts as done (search with
   `gh pr list --state merged --search` for each promise); check other promises, such as archiving a
   repo, with `gh` too. If `gh` cannot confirm it, keep `promise`; do not guess. When either check
   finds it done, `put` the thread as `answered` with the same fingerprint.
6. **Mentions.** Always run this; it never uses the cache. Call `slack_search_public` with `query`
   set to the bare user group ID (`S0123456789`, not `<!subteam^S0123456789>`, which matches
   unrelated messages) and `after` set to
   `bash .agents/skills/maintenance/scripts/window.sh --epoch`. Results show the mention as
   `<@S0123456789>`. Mentions are rare, so an empty result is normal. Keep only messages that ask DX
   for something and have no DX reply yet (read the thread when the result does not show it); skip
   cc's and announcements, and skip mentions in a thread already listed as New.

## Sections

Do not list `answered` or `not-dx` threads. Use the parent post's `ts` for the date and permalink,
not a reply's. Compare `ts` with `window.sh --epoch`.

- **New:** `open` threads whose parent was posted within the window.
- **Mentions:** the messages kept in step 6, linked with the permalink the search result returns
  (they can be in any channel).
- **Stale:** threads whose parent is older than the window, and either `open`, or `promise` with a
  concrete promise, or `promise` with a vague promise whose promise date is 30 or more days ago.
  Threads 80 or more days old drop out of the channel read soon: append "(leaves the digest on
  <parent date + 90 days>)".

The "Slack (N new)" count is the number of New and Mentions bullets.

Channel permalink:
`<slackWorkspaceUrl>/archives/<slackChannelId>/p<ts without dot>?thread_ts=<ts>&cid=<slackChannelId>`.

```markdown
### Slack (N new)

- New: <summary> ([#<slackChannelName>](permalink))
- Mention: <summary> ([#<channel>](permalink))

### Stale Slack threads (N)

- <topic> (<parent date>)[, <GitHub issue or Linear link if the thread names one>]: <what is
  unresolved> ([thread](permalink))
```
