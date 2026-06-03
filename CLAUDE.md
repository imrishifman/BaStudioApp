@AGENTS.md

# Working rules (owner's standing instructions)

These apply to every session. Follow them without being reminded.

## Shipping / git
- **Never push or deploy until the owner explicitly says so.** No `git push`, no
  deploy, even if a change is finished. Do the work, then wait for approval.
- **Always run the production build before pushing**, and only push if it passes:
  `node node_modules/next/dist/bin/next build`
- The `imri` branch is **production** — pushing to it auto-deploys. Treat any push
  to `imri` as a production release.
- Create new commits; don't amend or force-push unless explicitly asked.

## Secret handling
- **Never paste API keys, tokens, or secrets into the chat**, and never print a
  file that contains them (no `cat`/`tail`/`echo` of `.env`, `.env.local`, etc.).
- To add a secret from the clipboard, append without echoing: `pbpaste >> .env.local`.
- Verify a secret only by its length or short prefix — never by displaying it.
- Never take or request a screenshot that shows a secret on screen.

## Web / user-facing copy
- **No em dashes** in website copy or AI-generated user-facing text. Use commas,
  parentheses, or rewrite the sentence instead.

## How to run locally
- Dev server: `node node_modules/next/dist/bin/next dev` (port 3000), run from the
  project root. The standalone macOS Terminal opens in `~`, so `cd` into the project
  first; VS Code's integrated terminal already starts in the project folder.
