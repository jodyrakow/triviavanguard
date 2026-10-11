# Next-generation scoring specification — draft 1

Status: **Design proposal, not implementation**. Confirmed requirements are separated from recommendations and unresolved questions. Source: scoring conversations through 2026-10-10. Do not treat examples as new user decisions.

## Confirmed requirements

- Preserve the real scoring grid's visual structure, team and question navigation, scrolling, keyboard shortcuts, and Team Scoring Mode unless explicitly changed.
- One **visible cell per independently reviewable/scorable unit**. The host-facing content for each answer/bonus cell is the **actual correct Answer text**, never an artificial part label (A/B/C, 'Answer 1', 'Bonus A', etc.). Stable unit IDs are internal only. A Question may produce one or multiple cells. A multi-Answer all-or-nothing Question produces one cell; threshold, independent partial credit, and base-plus-bonus Questions may produce several.
- Navigation progresses through visible cells in display order using existing forward Tab / Down Arrow behavior; no separate key to navigate Answer parts. Backward navigation does not mark a cell reviewed.
- Review state is **per team, per visible cell**, independent of correctness. Advancing forward marks the cell being left reviewed; clicking to score marks it reviewed; changing a scored cell back to incorrect retains review state. Unreviewed circles are white; reviewed-but-not-correct circles fill to match the cell's light orange/blue (or other actual tile) background with a visible outline. Correct cells retain their established styling.
- Review state persists and synchronizes between hosts; keyboard focus is local to each host.
- A Question is fully reviewed only when **every required visible cell for every participating team** has been reviewed. This is derived, not an independently editable completion flag.
- A **social** is a fully reviewed Question where no participating team earned any points. A **solo** is a fully reviewed Question where exactly one participating team earned points; award it to that team. Incomplete Questions are neither.
- Results become available only when all required reviews are complete. Publishing to Airtable happens from the results workflow, not from partially reviewed scoring.
- Airtable owns reusable Questions and their possible Answers. The Rundown/show builder defines the scoring configuration for a particular use of a Question. Scoring scopes are **independent** of Segments, Category Blocks, Answers Blocks, Results Blocks, and legacy Airtable Round IDs. A scoring scope may span multiple blocks; an Answers Block may reference multiple earlier Category Blocks without duplicating Questions.
- Supabase stores live detailed per-team scoring and review states. Airtable publishing needs only one Question-level correct/incorrect result per team; desired rule is **earned points > 0 => correct; otherwise incorrect**, after results are ready. Existing publishing implementation must still be verified.
- Existing `bonusCount` and `partialCount` formats can be retired after useful behavior is audited.
- **Current supported configurations keep partial-answer scoring and bonus-answer scoring mutually exclusive.** Do not accidentally introduce mixed configurations into v1. The underlying design should not make future combinations impossible.
- Running team totals in the grid are useful; grid and Results should consume the same scoring calculation, not independently calculate totals.
- No changes to production `rebuild` branch or its data. Next-generation uses branch `next-generation` and planned Supabase schema `next_generation` within the existing project.

## Scoring configurations — proposed formalization

| Mode | Visible cells per Question/team | Scoring calculation | Review completion |
|---|---|---|---|
| All-or-nothing | One base cell | Full base points if marked correct; otherwise zero. Underlying multiple Answers are evaluated by host as one decision. | Base cell reviewed |
| Threshold | One cell per required Answer | If number of correct Answers >= threshold N, award full Question points; otherwise zero. Pooled scoring must count threshold-qualified teams as winners of the full Question pool. | Every required Answer cell reviewed |
| Independent partial credit | One cell per required Answer | Award proportionate credit for correct Answers using explicit integer rounding policy. | Every required Answer cell reviewed |
| Base + bonus | One base cell plus separately reviewable bonus cell(s) | Base points plus bonus points according to the show's configured bonus rule. | Base and all required bonus cells reviewed |

The table specifies conceptual behavior, **not** a final points formula. Existing pub/pooled/pooled-adaptive and percentage/flat bonus rules require explicit evaluation before adoption. Threshold and independent partial credit must not be conflated. Bonus-only positive points and whether they count for solos require explicit confirmation.

## Proposed architecture

1. `Question` (Airtable): reusable Question ID, text, possible Answer IDs and content. Does not dictate the scoring model of every use.
2. `QuestionOccurrence` (Rundown): unique stable ID for this placement/use of the Question; references the Airtable Question; owns an immutable-or-versioned **scoring configuration snapshot** and stable ordered scoring-unit IDs. Avoid using bare Question ID if the same Question can appear twice in one show.
3. `ScoringScope` (Rundown): explicitly references relevant QuestionOccurrence IDs, potentially across blocks; not implied by Answers/Results Blocks.
4. `TeamParticipation`: show-specific participation record linked optionally to a persistent Team identity. Team lifecycle and Airtable/Supabase ownership **not yet decided**.
5. `TeamQuestionScore` (Supabase): proposed single row per TeamParticipation + QuestionOccurrence, with JSONB `units` keyed by stable scoring-unit IDs. One row may render as multiple grid cells. This is a **candidate**, not a settled table design.
6. Pure scoring engine: takes occurrence scoring config, team scoring units, scope membership, and scoring mode; returns unit/question/team points, completion, totals, solos, socials, placements. Grid and Results share the same engine.
7. Persistence/realtime: save review and scoring changes safely. A single JSONB row must not be blindly overwritten with stale state; prefer atomic unit updates or optimistic concurrency (revision) with conflict resolution. Hard focus locks are **not** a requirement.

### Invariants

- Every rendered cell maps to one stable scoring-unit ID and one TeamQuestionScore record (in the candidate JSONB design). Its host-visible content comes from the actual correct Answer text, not a generated label; bonus cells likewise display their actual Answer text.
- The scoring configuration and its ordered units are show-specific and must not be inferred from legacy `partialCount`, `bonusCount`, or Airtable Round IDs.
- Preserve the existing `isCorrect` field name for unit correctness (do not rename it). Review and correctness are separate. `reviewed: true, correct: false` is valid; `reviewed: false` must not be silently interpreted as incorrect for results readiness.
- Readiness derives from required unit reviews across all participating teams and all occurrences in the scoring scope.
- A scoring record can exist before any scoring decision, but record existence alone is **not** proof of completed review.
- Points and question-level binary export are **derived**, not independently maintained writable truth.
- Realtime data from another host updates scores, not local keyboard focus.

## Interaction and visual acceptance tests

1. Forward Tab / Down Arrow reviews only the cell being left, including multi-cell Questions; backward Shift+Tab / Up Arrow never changes review state.
2. A click scores and reviews that cell; clicking back to incorrect retains reviewed.
3. Unreviewed circle white; reviewed-no-credit circle matches actual tile background with visible outline; correct cells retain existing correct/partial/bonus styling.
4. Sequence Q10, Q11, Q12's first Answer text, Q12's second Answer text, Q13 works with the **same** keys and scrolls predictably. No artificial part labels appear.
5. Refresh restores each unit's reviewed/correct state; two hosts see updates; each host keeps its own focus.
6. A team with partial positive points counts as earning points for solos/socials; no statistics until **all teams and required cells** of that Question reviewed.
7. Results unavailable while any required cell unreviewed; totals may remain visible in grid as provisional.
8. Grid and Results calculate identical points from identical inputs.
9. One show's Question configuration changes do not alter another use of the same Airtable Question.
10. No read/write path on `next-generation` unintentionally targets production `public` scoring data.

## Existing-code findings to audit

- `src/ScoringMode.js`: derives Questions from selected legacy round, currently keyed by `showQuestionId`; handles grid UI, navigation, teams, tiebreakers, realtime and persistence together.
- `src/scoring/compute.js`: uses Question-level `isCorrect`, `partialCount`, `bonusCount`; social logic infers progress from existence of cells / later scored Questions. Must be replaced with derived review completion.
- `netlify/functions/supaSaveScoringCell.js` and `supaLoadScoringCells.js`: read/write `public.scoring_cells` via default schema; save upserts entire cell and can overwrite unrelated fields.
- `netlify/functions/supaSaveShowTeam.js`, `supaLoadShowTeams.js`, `supaRemoveShowTeam.js`: operate on `public.show_teams`.
- `netlify/functions/createShowTeam.js`: interacts with Airtable. Team lifecycle, first-load import, and publish-back functions require fuller audit.
- Current reviewed-circle code uses inherited foreground color, not actual tile background; correction outstanding.
- Migration adding `public.scoring_cells.is_reviewed` was already applied by user; no next-generation schema created by this document.

## Unresolved decisions — do not silently assume

- Is QuestionOccurrence always necessary, and can a Question be reused more than once per show?
- Which bonus rules, bonus-only scoring semantics, and integer rounding policies are required?
- Whether an optional/non-applicable unit can be omitted from readiness, and how to represent it.
- Whether published binary Question correctness includes bonus-only positive points; provisional rule says yes.
- How show/team identity, Airtable team discovery, late additions, historical team identities, and score publishing should work.
- Whether one JSONB scoring row per Team + QuestionOccurrence is preferable to per-unit rows after concurrency, analytics, and realtime tests.
- What determines when a scoring scope is active and which teams participate in it.
- How multiple tiebreakers and special scoring cases should be represented.

## Next steps

1. Review proposed JSON examples in `docs/next-generation-scoring-json-examples.md`.
2. Audit actual Question/Answer loading, team lifecycle, Supabase schema and Airtable publishing.
3. Decide stable identifiers and concurrency semantics, then design `next_generation` SQL.
4. Implement scoring engine and adapt real ScoringMode component on `next-generation`; test with isolated data. Do not deploy or change production without explicit authorization.
