---
model: claude-haiku-4-5-20251001
allowed-tools: Bash
---

Open a pull request for the current branch with a simple summary of the changes.

1. Run `git log main...HEAD --oneline` for the commit list, `git diff main...HEAD --stat` for the file summary, and `git diff main...HEAD` for the full diff — read all of it to understand what actually changed before writing anything.
2. Draft a short PR title (under 60 chars) and a bullet-point body summarizing the changes — no fluff, just what changed and why.
3. Push the branch if it isn't already on the remote (`git push -u origin HEAD`).
4. Create the PR with `gh pr create` using the drafted title and body.
5. Return the PR URL.
