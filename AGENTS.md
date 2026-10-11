# Repository instructions

This is a public repository. Before changing anything, read `HANDOFF.md`, `README.md`, and the nearest nested `AGENTS.md`.

- Preserve existing tracked and untracked work. Never reset, clean, overwrite, or bulk-stage it.
- Do not use `git add .`; stage reviewed paths or hunks explicitly.
- Never commit `.env` files other than `.env.example`, credentials, signing material, participant evidence, recordings, or personal screenshots.
- Raw usability evidence stays outside Git under the ignored `research/user-tests/*-evidence/` and `research/user*-analysis/` paths. Only verified redacted evidence belongs in `prototype/assets/research-evidence/`.
- Treat `file.png` as private: it contains a real conversation and is intentionally ignored.
- Before mobile work, also read `apps/mobile/AGENTS.md` and use the exact Expo 57 documentation it references.
- Keep server secrets out of `EXPO_PUBLIC_*`; those values are embedded in client bundles.
- Run the smallest relevant existing checks. For a full synchronization candidate, use:

```powershell
npm run test:api
npm run mobile:test
npm run mobile:typecheck
npm run release:check:static
```
