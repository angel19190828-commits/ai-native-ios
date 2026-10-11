# Angel Chat Handoff · High-Fidelity V2

Last updated: 2026-10-10

This document records the decisions made in Angel's current chat about `prototype/wireframes-high-fidelity-v2.html`. It intentionally uses a unique filename so it does not conflict with repository or other-chat handoffs.

## Source of truth

Primary prototype:

```text
prototype/wireframes-high-fidelity-v2.html
```

Do not use `prototype/wireframes.html` as the product reference. That is an old Version 1 prototype.

The modern Email scene already exists inside `wireframes-high-fidelity-v2.html`. It must be presented in the same state navigator as the other scenes, not replaced with the old Version 1 flow.

## Current scene order

### Scene 1 · Email coordination

This is the newer email-to-interview experience already implemented in the high-fidelity V2 file.

Navigator moments:

1. Current email
2. AI suggestion
3. Confirm details
4. Planning
5. Needs You
6. Ready to review
7. Applying plan
8. Interview scheduled
9. Interview day

Underlying states:

```text
mail → assistant → suggest → processing → action → plan → executing → task → today
```

Do not restore the Version 1 presentation, `Try another email`, or `Live AI analysis` UI.

### Scene 2 · Reply & follow-up

Maggie asks the group for the final launch decisions.

Contextual suggestions:

- Follow up with Maggie
- Summarize decisions
- Add a reminder

Island activity:

```text
Thinking… → Drafting the follow-up…
```

Real conflict:

- Proposed follow-up: Friday at 3 PM
- Existing launch deadline: Friday, 1–4 PM

Decision Pills:

- Move to 10 AM
- Move to 4:30 PM
- Draft only

Ready-state copy:

- English: `I drafted a follow-up. Take a look.`
- Chinese: `我起草了一条跟进消息，你可以先看看。`

The draft is inserted directly into the composer for editing and sending.

### Scene 3 · Synthesize & handoff

Maggie asks for a project summary and latest budget to be combined into one review document.

The user provides the files first. AI should not silently search for them.

Contextual suggestions:

- Combine the files for Maggie
- Send separately
- Review before combining

Island activity:

```text
Reading your files… → Organizing the document…
```

AI may compose visibly in a document workspace or the user's selected document app.

Real conflict:

- Project summary total: `$121,000`
- Budget file total: `$128,000`

Decision Pills:

- Use budget file · $128K
- Use summary · $121K
- Show both with a note

Return the usable document/message to the composer. PDF is an option, not the mandatory default.

### Scene 4 · Expense coordination

After a group dinner, participants share a receipt, a payment screenshot, and constraints from chat.

Example context:

- Sam already transferred Maggie `$42`.
- Nina did not drink wine.
- The `$36` truffle pasta was shared by three people.

Contextual suggestions:

- Work out everyone’s share
- Collect missing receipts
- Summarize expenses

Island activity:

```text
Reading the context… → Working out the split…
```

If the three people sharing the pasta are not identified, AI must ask before calculating final totals.

The final result defaults to editable text in the composer. PDF remains optional.

## Shared interaction model

### Dynamic Island

- Ambient English: `I can help`
- Ambient Chinese: `我可以帮忙`
- No suggestion count.
- Thinking, reading, organizing, drafting, and working are communicated only through the Island.
- Do not show internal step lists, percentages, progress bars, or counters.

### Suggestions

- Small Decision Pills appear beside the message or content that triggered them.
- Do not render a bottom `AI Advice` bar.
- Keep all Decision Pills visually consistent and compact.

### Composer

- The initial Ambient state has no composer.
- The composer appears after suggestions open or a task begins.
- Use the WhatsApp-inspired structure already implemented:
  - left attachment button;
  - white rounded input field;
  - sticker control inside the field;
  - camera button;
  - green microphone while empty;
  - send button after text is entered;
  - auto-growing textarea without a scrollbar.
- During processing, composer input becomes an additional AI requirement and restarts the current Thinking → Working sequence.
- Processing input is not posted to the group chat.
- At Ready to review, the generated result is inserted directly into the composer.

### ConversationPanel

Use it only when:

1. AI has a real ambiguity/conflict that requires a decision.
2. AI has a completed result ready for review.

Do not render:

- eyebrow rows;
- status dots;
- labels such as `Clarification`, `Confirmation`, or `Conflict`;
- intermediate progress panels.

Conflict panels may include evidence visualization and Decision Pills. The composer stays available for a custom response.

### Language separation

- English mode contains no Chinese UI copy.
- Chinese mode contains no English UI copy.
- Translate navigation, status text, placeholders, actions, results, and accessibility labels.
- User names and file extensions may remain unchanged.

## Implementation map

- `renderHero()` owns the canonical Reply, Files, and Expense rendering.
- `renderHeroLegacy()` remains in the file but is not called by the canonical flow.
- The modern email scene uses the existing email state machine and `data-s` navigation.
- Group-chat scenes use `data-hero-state` navigation.
- `renderHeroNav()` renders Email first, followed by Reply, Files, and Expense.
- Language switching rebuilds the complete four-scene navigator.
- The previous external Email prototype link was removed from the navigator.

## Verification already completed

- All five inline JavaScript blocks passed `node --check`.
- `git diff --check` passed for the V2 HTML file.
- Static checks confirmed:
  - Ambient group-chat states do not render the composer.
  - WhatsApp-style composer controls are present.
  - microphone/send switching is driven by input value.
  - the Email scene and bilingual Email navigation are present.
  - the state navigator contains all four scenes.

## Remaining validation

- Manually refresh the local `file://` page after edits.
- Visually inspect every navigator state.
- Check attachment layout in the WhatsApp-style composer.
- Check both languages for stray mixed-language UI.
- Exercise custom input during Thinking/Working and confirm the sequence restarts.
- Exercise every conflict Decision Pill and final send action.

Browser automation cannot reload the local `file://` page because of browser security policy, so visual verification must currently be manual.

## Repository safety

- The worktree contains unrelated modified and untracked files. Do not reset or clean it.
- Do not commit `file.png`; it contains a real private conversation.
- Do not overwrite `HANDOFF.md` or `prototype/HANDOFF-CHAT-HIGH-FIDELITY-V2.md` from other chats.
- Unless Angel expands the scope, continue prototype work only in `prototype/wireframes-high-fidelity-v2.html` and this uniquely named handoff.
