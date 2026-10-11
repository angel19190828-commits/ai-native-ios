# Windows and Codex handoff

This file is the starting point when continuing the project on another Windows computer.

## Repository boundary

- Public repository: `https://github.com/angel19190828-commits/ai-native-ios`
- Default and current branch: `main`
- Local project used for this check: the repository root in the Angel checkout
- Verified committed baseline on 2026-10-10: `b51210455028660e76a4ab508f492db7a53b30e6`
- At that check, local `HEAD`, local `origin/main`, and the live GitHub `main` ref matched.

The committed baseline does not include the current working-tree work. Do not assume a fresh clone contains the latest local implementation until the reviewed changes have been committed and pushed.

## Current local work

The Angel checkout currently contains substantial pre-existing work: tracked modifications plus untracked source, tests, Windows test documentation, and two images. Preserve it exactly; do not reset or clean the repository.

The work falls into these synchronization categories:

1. API orchestration and capability changes under `api/`.
2. Mobile task, execution, storage, presentation, personalization, and browser-adapter changes under `apps/mobile/`.
3. Matching tests and the browser fixture under `apps/mobile/src/`.
4. Architecture, privacy, changelog, README, and Windows browser-test documentation.
5. Prototype HTML and a candidate prototype image.
6. Dependency manifests and lockfiles at the root and in `apps/mobile/`.

Review and stage these categories explicitly. Never use `git add .`.

## Keep both product entry points

This repository has two separate continuation paths. A future Codex session must inspect both instead of continuing only the Expo app.

### Static high-fidelity prototype

- `prototype/wireframes-high-fidelity.html` is the original interactive-demo entry. It is tracked and had no local modification at the 2026-10-10 handoff check, so it is already present in the committed baseline.
- `prototype/wireframes-high-fidelity-v2.html` contains pre-existing, uncommitted high-fidelity scenario work.
- `prototype/wireframes-approval.html` also contains pre-existing, uncommitted high-fidelity approval-flow work and links to the v2 scenarios.

The two modified HTML files are part of the local development state and must be reviewed and preserved together when preparing the public Git synchronization. Do not replace them with the clean original file. Open the static HTML entry directly in a browser; see `README.md` for the published demo and optional local AI proxy.

Verified local dependencies for these entries exist and are tracked:

- the original and v2 pages use `prototype/assets/figma-iphone/`;
- v2 also loads `prototype/task-conversation.css` and `prototype/task-conversation.js`;
- the approval page embeds itself for screen review and links to `prototype/wireframes-high-fidelity-v2.html`.

### Expo mobile and browser app

The Expo implementation lives under `apps/mobile/`. Use `npm run mobile:start` for the Expo development server, `npm run mobile:web` for its web target, or `npm run dev:browser` for the combined local API and browser workflow described in `docs/WINDOWS_BROWSER_TEST.md`.

The Expo browser target and the standalone prototype HTML are different entry points. Changes or validation in one do not automatically cover the other.

### Transfer coverage checklist

- Static prototype: the three HTML entries above and their tracked relative assets, CSS, JavaScript, and linked settings page.
- Expo: `apps/mobile/App.tsx`, entry/config files, `apps/mobile/src/`, native integration folders, tests, and the mobile package manifest and lockfile.
- API: the tracked `api/` endpoints and tests, including the current orchestration and capability changes.
- Dependencies and configuration: root `package.json`/`package-lock.json`, mobile equivalents, `apps/mobile/eas.json`, and both tracked `.env.example` templates.
- Handoff: `README.md`, `AGENTS.md`, `HANDOFF.md`, `apps/mobile/AGENTS.md`, and `docs/WINDOWS_BROWSER_TEST.md`.

Tracked baseline files transfer with a clone. Modified or untracked files transfer only after explicit review, commit, and push; notably, `AGENTS.md`, `HANDOFF.md`, and `docs/WINDOWS_BROWSER_TEST.md` are not yet committed.

### High-fidelity v2 handoffs and current state

Two untracked prototype-specific handoffs now exist:

- Primary high-fidelity handoff: `prototype/HANDOFF-ANGEL-CHAT-2026-10-10-HIGH-FIDELITY-V2.md`. The user explicitly designated this as the most important source. It keeps Email in the same v2 navigator before Reply, Files, and Expense.
- Conflicting secondary material: `prototype/HANDOFF-CHAT-HIGH-FIDELITY-V2.md`. Its current direction separates Email into `wireframes-approval.html` and keeps only the three group-chat scenes in v2.

The documents overlap heavily but disagree on scene ownership. Their contents do not establish whether they are revisions from one chat or decisions from separate workflows. Do not describe the secondary document as a historical version without further evidence, and do not let it override the user-designated primary handoff.

Verified against the current HTML on 2026-10-11:

- `wireframes-high-fidelity-v2.html` has pre-existing uncommitted changes and currently renders Email first, followed by Reply, Files, and Expense through `renderHeroNav()`;
- v2 does not currently link to `wireframes-approval.html`; the standalone approval page links back to v2;
- the old `Try another email / Live AI analysis` wording remains in legacy translation data, but it is not evidence of a visible current navigator control;
- the canonical `renderHero()`, legacy `renderHeroLegacy()`, combined `renderHeroNav()`, bilingual navigation data, and tracked relative dependencies are present;
- the HTML has five script tags: two inline scripts and three external references. Both inline script bodies pass `node --check`, and `git diff --check` passes.

The integrated four-scene navigator is both the verified implementation and the user-selected direction. Preserve Email, Reply, Files, and Expense together in v2. Treat the separated Email workflow only as conflicting secondary material; it must not drive a restructure or overwrite the primary handoff.

Both handoffs leave the same practical validation work: manually inspect every state, composer/attachment layout, Dynamic Island copy, decision paths, final send behavior, and English/Chinese separation. Those visual checks have not been independently completed here.

The user confirmed on 2026-10-11 that the high-fidelity workstream has stopped writing and explicitly approved publishing the current reviewed project snapshot. Other chats were not independently enumerated through the unavailable task-list service; this handoff and the exact Git diff define the synchronization snapshot.

Public-review note: neither prototype-specific handoff has detected credentials or email addresses. The primary handoff's source path was normalized to a repository-relative path before public synchronization. It mentions the excluded private screenshot only by filename and does not include its contents.

## Public-repository exclusions

Never commit or upload:

- `.env`, `.env.*`, API keys, tokens, credentials, signing files, or local service linkage;
- raw participant recordings, photos, transcripts, or other identifying research evidence;
- `file.png`, which contains a real private conversation;
- ignored build output, caches, `node_modules`, `.expo`, `dist`, or `.vercel` state.
- ignored `*.bak.html` local prototype backups.

`prototype/expense-scene-check.png` appears to be a synthetic product mockup, but it is excluded from the transfer until its source and publication rights are confirmed. Neither this file nor `file.png` will appear on the second computer through Git.

The checked-in `.env.example` files contain variable names and placeholders only. Real values must be configured separately through an approved secure channel and must not be copied through Git or this handoff document.

## First setup on another Windows computer

Only do this after the current Angel work has been reviewed, committed, and pushed:

This procedure has not yet been run on the second computer. Clone, dependency installation, static prototype rendering, Expo startup, and tests there remain unverified until that machine is separately authorized and checked.

```powershell
git clone https://github.com/angel19190828-commits/ai-native-ios.git
cd ai-native-ios
git status --short --branch
node --version
npm --version
npm ci
npm ci --prefix apps/mobile
npm run test:api
npm run mobile:test
npm run mobile:typecheck
npm run release:check:static
```

The Angel machine was verified with Node `v24.11.1` and npm `11.6.2`. The project does not yet declare a supported Node range, so treat those as the verified local versions, not a compatibility guarantee or a mandatory pin.

For browser development:

```powershell
npm run dev:browser
```

Then open `http://localhost:8081` if Expo does not open it automatically and follow `docs/WINDOWS_BROWSER_TEST.md`.

Native iOS validation still requires macOS/Xcode or EAS Build; Windows browser checks do not cover App Intents, Sharesheet, signing, TestFlight, or real iPhone adapters.

## Normal two-computer routine

Before leaving a computer:

1. Run `git status --short`.
2. Review tests and the exact diff.
3. Stage only intended public files, then commit and push.

Before continuing on the other computer:

1. Confirm its worktree is clean with `git status --short`.
2. Run `git pull --ff-only`.
3. Read this file and the latest changelog before editing.
