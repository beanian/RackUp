Commit all staged and unstaged changes, then push to GitHub.

Steps:
1. Run `git status` to see what changed
2. Run `git diff` to understand the changes
3. Run `git log --oneline -3` to match the commit message style
4. Stage all modified and new files (but not files in .gitignore)
5. Write a concise commit message summarizing the changes
6. Commit with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
7. Push to the remote
8. Report the commit hash and confirm success
