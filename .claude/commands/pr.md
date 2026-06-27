Open a pull request for the current branch with a simple summary of the changes.

1. Run `git diff main...HEAD --stat` and `git log main...HEAD --oneline` to understand what changed.
2. Draft a short PR title (under 60 chars) and a bullet-point body summarizing the changes — no fluff, just what changed and why.
3. Push the branch if it isn't already on the remote (`git push -u origin HEAD`).
4. Create the PR with `gh pr create` using the drafted title and body.
5. Return the PR URL.
