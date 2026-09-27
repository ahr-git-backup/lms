# Instructions for AI coding assistants working in this repo

## Do not create extra/temporary files
Only touch the files actually needed for the requested change. In
particular, never create a second/duplicate lockfile (e.g. running
`npm install` in a way that regenerates `package-lock.json` unnecessarily,
or adding a `yarn.lock`/`pnpm-lock.yaml` alongside it). Multiple/duplicate
lockfiles have previously broken the Cloudflare Pages deploy for this repo.

Before committing, run `git status` and confirm only the intended files
are staged — no stray build artifacts, no regenerated lockfiles, no
scratch files.

## Push discipline
Complete each logical step fully (code + build check) and push it before
moving to the next step, so work isn't lost and deploys stay small and
easy to bisect if one fails.
