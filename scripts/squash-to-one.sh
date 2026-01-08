#!/bin/sh
set -e
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not in a git repo" >&2
  exit 1
fi
remote_branch="origin/main"
if ! git rev-parse --verify "$remote_branch" >/dev/null 2>&1; then
  echo "Missing $remote_branch; run 'git fetch' first" >&2
  exit 1
fi
if ! git diff --quiet; then
  echo "Working tree has unstaged changes; commit or stash first" >&2
  exit 1
fi
if ! git diff --cached --quiet; then
  echo "Index has staged changes; commit or unstage first" >&2
  exit 1
fi
commits=$(git rev-list --count "$remote_branch"..HEAD)
if [ "$commits" -le 1 ]; then
  echo "Nothing to squash; $commits commit(s) ahead of $remote_branch" >&2
  exit 1
fi
echo "Squashing $commits commits into one..."
git reset --soft "$remote_branch"
echo "Now run: git commit -m \"<message>\"" 
