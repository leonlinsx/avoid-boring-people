# Long-lived Meta token refresh (Threads + Instagram)

## Why this exists

Both production publishers use **long-lived user tokens** that normally expire
after about 60 days. The existing daily `Token health` workflow checks whether
those tokens can still authenticate but cannot renew or save them. This separate,
opt-in workflow refreshes valid tokens and writes the resulting replacements
directly to the existing GitHub Actions repository secrets.

This uses the current Instagram **Instagram Login** token on
`graph.instagram.com`, not a Facebook Page token, and a separate Threads user
token on `graph.threads.net`. The two credentials must never be swapped.

## What it does

- Weekly on Monday 06:17 UTC, the `Meta token refresh` Action refreshes both
  valid user tokens, extending their expected lifetime toward 60 days.
- A refreshed token is checked against the **same account ID** before it is
  saved. The Instagram ID must also equal `INSTAGRAM_USER_ID`.
- A repository secret last updated fewer than **36 hours** earlier is only
  checked, not refreshed, because Meta requires a token at least 24 hours old.
- It writes the result to existing `THREADS_ACCESS_TOKEN` or
  `INSTAGRAM_ACCESS_TOKEN` using `gh secret set` and a scoped GitHub App token.
  The replacement never enters a CLI argument, commit, artifact, or log.
- If one platform fails, the other is checked/refreshed independently. A failed
  run still alerts through GitHub Actions and **never** replaces that platform's
  old secret with an unvalidated value.
- The normal daily `Token health` workflow remains enabled, independent and
  read-only. A successful refresh job is not a substitute for a healthy
  authentication check or proof that an actual social post published.
- GitHub scheduled workflows can be delayed or skipped. Weekly attempts leave
  substantial margin, but no system can guarantee permanent access if Meta
  revokes permissions or the account is disconnected.

## One-time operator setup (do not paste credentials into chat)

1. **First fix any expired token manually.** The November 15 health check
   confirmed Threads had expired. Generate a fresh **long-lived** Threads user
   access token in Meta Developers, save it as `THREADS_ACCESS_TOKEN`, and run
   **Actions → Token health → Run workflow**. Confirm both Threads and
   Instagram authenticate. Already expired tokens cannot be refreshed.
2. In GitHub **Settings → Developer settings → GitHub Apps**, register a
   dedicated private app for token maintenance. Under **Repository
   permissions**, grant **Secrets: Read and write** (Metadata: Read is implicit).
   Do not grant Contents write, Actions write, or other permissions. Install
   it for **only** `leonlinsx/avoid-boring-people`, and create a private key.
   The existing `SOCIAL_STATE_APP` need not be changed.
3. In the ABP repository **Settings → Secrets and variables → Actions → Secrets**,
   add:
   - `META_REFRESH_APP_CLIENT_ID`: the new GitHub App's client ID;
   - `META_REFRESH_APP_PRIVATE_KEY`: its complete PEM private key.
   These are GitHub App credentials, **not Meta/Threads/Instagram credentials**.
4. **Actions → Meta token refresh → Run workflow**: select `both` and leave
   **refresh unchecked**. This validates current accounts without writing
   secrets or contacting the refresh endpoint. Fix any authentication issue.
5. Once the newly renewed Threads token is at least 36 hours old, run the same
   workflow with **refresh checked**. Verify it succeeds and rerun
   **Actions → Token health**. Confirm both accounts again. A token updated
   within 36 hours will be safely deferred.
6. Only after the write test succeeds, in repository
   **Settings → Secrets and variables → Actions → Variables**, set
   `META_TOKEN_AUTO_REFRESH_ENABLED` to exactly `true`. This enables the
   weekly scheduled job. Leave the variable unset or set it to `false` to
   disable scheduling; manual read-only checks remain available.

## Recovery and limitations

- Manual dispatch **defaults to check-only**. Select `refresh=true` to
  authorize a real rotation; scheduled runs rotate only when the enable variable
  is set. Manual `platform` can select `both`, `threads`, or `instagram`.
- The script uses the refresh endpoints:
  `GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token`
  and
  `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`,
  authenticated by the current respective access token.
- A token that has **already expired** or been revoked cannot be recovered by
  this workflow. Reauthorize that specific account in Meta Developers, save its
  new token once, and rerun the read-only check. The next scheduled rotation
  can proceed after the minimum token age.
- Meta may require new consent after account changes, app permission revocation,
  or other policy changes; automatic refresh is not a truly non-expiring token.
- GitHub's default `GITHUB_TOKEN` does not have repository Secrets:write.
  The dedicated GitHub App installation is a necessary setup cost in permissions,
  **not a monetary cost**. A GitHub App with Secrets:write can potentially
  overwrite **any** repository secret, so keep its installation restricted to
  this repository, protect its private key, and review changes to the workflow.
- Refreshed tokens are verified and written **one platform at a time**; one
  success and one failure is possible. The next Action will pick up the new
  secret; secrets already injected into an in-progress workflow do not change.
- Do **not** rerun an unrelated Social Evergreen publish workflow merely to
  validate credentials or token refresh.

## References

- Meta Threads API authorization: https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- GitHub Actions Secrets API: https://docs.github.com/en/rest/actions/secrets
- GitHub App action: https://github.com/actions/create-github-app-token
- GitHub CLI secret set: https://cli.github.com/manual/gh_secret_set
