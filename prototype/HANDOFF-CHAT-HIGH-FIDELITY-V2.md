# AI-native high-fidelity prototype handoff

Last updated: 2026-10-10

## Current goal

Converge the existing HTML prototypes into a portfolio-ready interaction story, then use the approved flows as the source for an Apple-style high-fidelity Figma pass.

This is prototype work only. Do not add backend APIs, OAuth, real sending, new capabilities, or new task topologies.

## Canonical files

### `wireframes-high-fidelity-v2.html`

Main prototype for three scenarios:

1. Reply & Follow-up
2. Synthesize & Handoff
3. Expense Coordination

Its visible navigator should contain only these three scenes, plus a link to the standalone email prototype.

### `wireframes-approval.html`

Standalone Email → Interview Planning prototype. It owns the complete email-to-interview flow and should not be duplicated as a visible scene in the main prototype.

### Reference-only files

`wireframes-high-fidelity.html`, `wireframes.html`, backup files, and review files are historical references. Do not edit or promote them unless explicitly requested.

## Canonical interaction rules

### One composer

Only one composer may be visible at a time:

- **Host:** sends to the current group chat or email.
- **AI:** temporarily replaces the host composer and is clearly labeled as input to AI.
- **Working:** composer is collapsed; no fake keyboard or second input area.
- **Review:** AI output returns to the original app composer for the user to edit and send.

Never stack an AI composer above a chat composer. AI never sends the final message for the user.

### ConversationPanel

- Appears at the top, as in the earlier prototype direction.
- Used only for genuine clarification, conflict, or important confirmation.
- No redundant subtitle under the main prompt.
- Does not contain the composer or Decision Pills.

### Decision Pills

- Use one compact component style across suggestions and conflict choices.
- Sit directly above the composer, outside the ConversationPanel.
- Use explicit action copy such as `Move to 4:30 PM`; avoid vague labels such as `After the deadline`.

### Dynamic Island

- Shows ambient AI activity and collapsed task progress.
- Copy must stay on one line; shorten the message instead of wrapping.
- Thinking is calm/pulsing, Working is directional/progressive, Waiting is settled, Needs You stops motion and shifts attention to the panel, Done resolves quietly.

### Handoff and result

- Put the useful result back into the originating app.
- Text drafts go into the host composer.
- Editable documents remain editable unless the user requests PDF.
- Avoid an extra success panel when the returned artifact already communicates completion.

### Language

- English mode contains no Chinese UI text.
- Chinese mode contains no English UI text.
- Navigation, labels, placeholders, actions, statuses, accessibility text, and result copy all switch together.
- Proper names and file extensions may remain unchanged.

### Product language

Use user-facing language. Do not expose capability, executor, revision, trigger, receipt schema, or other system vocabulary.

## Audited scenario flows

### 1. Reply & Follow-up

Group chat → AI suggestion → AI composer for an added requirement → Thinking/Working → schedule conflict → user chooses a Decision Pill → Working resumes → draft is inserted into the group-chat composer → user sends.

Key rule: draft completion does not open a separate Result Panel.

### 2. Synthesize & Handoff

Group-chat request → AI suggestion → user provides files → AI reads them → document app shows the document being organized live → conflicting budget versions require a choice → AI continues writing → editable document returns to the group-chat attachment area → user sends.

Key rules: AI does not search private files without the user providing them; PDF is an export option, not the default.

### 3. Expense Coordination

Receipt image, transfer screenshot, and chat constraints → AI suggestion → Thinking/Working → AI asks only about information it cannot infer → user answers → amounts are recalculated → text summary is inserted into the group-chat composer → user sends.

Key rules: confirmed amounts and unresolved items must be visibly distinct; do not produce a final bill while a material split is unknown.

### 4. Email → Interview Planning

Interview invitation email → Plan this interview → extracted date, place, and requirements → user adds personal constraints → Thinking/Working → calendar conflict → user chooses a resolution → final plan review → explicit confirmation → simulated calendar, route, and reminder updates → return to the email context with the outcome.

This flow lives in `wireframes-approval.html`.

## Current separation status

- The main prototype exposes the three group-chat scenarios.
- The old `Try another email / Live AI analyze` control is hidden.
- The main navigator links to `wireframes-approval.html` for Email → Interview.
- The standalone email prototype is labeled high fidelity and links back to the other scenarios.
- Legacy email/interview code still exists inside `wireframes-high-fidelity-v2.html` for compatibility, but it is not part of the visible main flow.
- `wireframes-approval.html` still includes its internal screen-review gallery below the interactive prototype.

## Known issues to audit before Figma

1. Walk every state in all four scenarios and confirm there is never a duplicate composer or keyboard.
2. Confirm every Dynamic Island message remains a single line at the phone viewport width.
3. Check English and Chinese separately for mixed-language leaks.
4. Check return, cancel, modify, and re-enter behavior at each user decision.
5. Check phone-sized layouts for internal scrollbars, clipped panels, and overlapping controls.
6. Confirm every result returns to its source context and leaves the final send action to the user.

Do not broadly refactor the large legacy HTML unless one of these checks is blocked. The file contains duplicate historical rendering code, and the later active renderer currently wins.

## Next milestone

1. Complete the four-flow visual interaction audit.
2. Fix only interaction blockers and obvious comprehension failures.
3. Freeze the HTML flows.
4. Rebuild the frozen states in Figma using Apple typography, materials, native controls, keyboard behavior, Dynamic Island behavior, and motion.

## Safety and repository notes

- Both canonical HTML files have uncommitted user work. Do not reset or clean the worktree.
- Treat all execution in these prototypes as simulated; do not imply real mail, calendar, file, or payment integration.
- Do not recreate the scrapped React/Vite/Tailwind portfolio implementation unless the user explicitly requests it again.
