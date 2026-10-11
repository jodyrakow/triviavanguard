# Existing scoring implementation — dependency audit

**Audit date:** 2026-10-10. **Branch examined:** `next-generation`. This is a code audit, not a migration or implementation. The existing `rebuild` behavior is not modified.

## Verified dependency map

| Concern | Current location | Current behavior | Required migration impact |
|---|---|---|---|
| In-memory grid | `src/ScoringMode.js` around line 249 | `grid[showTeamId][showQuestionId]` stores top-level `isCorrect`, `isReviewed`, `bonusCount`, `partialCount`, tiebreaker values | Each rendered scoring unit must resolve its internal unit ID and access `units[unitId].isCorrect/isReviewed`; maintain Question-level grouping |
| Initial load | `ScoringMode.js` around 360; `netlify/functions/supaLoadScoringCells.js` | Loads `public.scoring_cells` by show ID, maps snake_case columns to top-level cell fields | Adapt loader and isolated next-generation schema together; missing team/unit score means unreviewed |
| Realtime | `ScoringMode.js` around 379–435 | Subscribes to `public.scoring_cells` postgres changes; replaces entire Question cell on each event | Subscribe to new schema/table and reconcile per-unit updates without losing other unit states; focus remains local |
| Click scoring | `ScoringMode.js` around 665–741 | `toggleCell` cycles `isCorrect`, `bonusCount`, `partialCount`; saves whole cell | Toggle one visible unit, mark it reviewed, preserve mutual exclusivity of initial partial vs bonus modes |
| Keyboard/review | `ScoringMode.js` around 743 onward | `markCellReviewed` sets top-level `isReviewed` for one Team+Question; navigation indices are Question-based | Navigation indices must become visible-scoring-unit-based; forward reviews departed unit; backward does not |
| Save | `netlify/functions/supaSaveScoringCell.js` | Upserts full row with `is_correct`, `is_reviewed`, `bonus_count`, `partial_count`, tiebreaker columns; defaults missing fields | Atomic per-unit patch or revision-checked update needed; current full-row upsert is unsafe for independently edited units |
| Correct team count | `src/scoring/compute.js:33–45` | `buildCorrectCountMap` counts teams where `grid[teamId][questionId].isCorrect` truthy | Count teams whose **derived Question outcome** qualifies under scoring rules, not correct Answer parts |
| Pooled scoring | `compute.js:67–85` | `computeAutoEarned` uses correct-team count to divide static/adaptive pool | Preserve scoring mode rules while deriving eligibility from units |
| Partial/bonus points | `compute.js:87–145` | `computeCellPoints` uses top-level `isCorrect`, partialCount, bonusCount; partial prorated and rounded; bonus pub additive / pooled percentage | Calculate from independent Answer-unit decisions, preserve intended mode formulas and rounding after confirming edge cases |
| Team totals | `compute.js:147–169`; `ScoringMode.js` around 1015–1044 | `buildTeamTotals` sums Question cell points + show bonus; `ScoringMode` separately adapts grid for it | Shared derived scoring engine used by grid and Results; no duplicate formulas |
| Per-cell display points | `ScoringMode.js` around 950–1004 | `earnedFor` adapts top-level cell and calls `computeCellPoints` | Use same engine as team totals |
| Cell appearance | `ScoringMode.js` around 1260–1280, 1810–1935 | Reads top-level `isCorrect/isReviewed/partialCount/bonusCount` to choose tile state, tooltip, aria-pressed, circle | Render per-unit state; show actual correct Answer words rather than artificial part labels; reviewed-no-credit circle matches actual background |
| Solo | `compute.js:47–65,253–287` | Uses Question-level `isCorrect` via `buildSoloMap` | **Already decided:** only after all teams' required units reviewed; exactly one team with Question points >0 |
| Social | `compute.js:296+` | Counts top-level correct and infers 'passed' from existence of cells / later questions | **Already decided:** only after all teams' required units reviewed; zero teams with Question points >0; eliminate progress inference |
| Tiebreaker | `ScoringMode.js` around 1125–1207 | Stores raw/numeric guess in Question cell and saves via same upsert | Keep tiebreaker data intact; determine isolated next-gen representation rather than accidentally treating guess as Answer correctness |
| Team lifecycle | `ScoringMode.js` around 245–470; `supaSaveShowTeam.js`, `supaLoadShowTeams.js`, `createShowTeam.js` | Supabase show-team rows, realtime, plus Airtable team creation | Separate team-authority and late-import audit required; do not assume initial import is sufficient |
| Airtable publishing | **Not yet traced to exact function** | Prior discussion suggests Question-level correct/incorrect; code not verified in this audit | Trace publishing entry point and actual mapping before editing; readiness gate already belongs to Results |

## Important findings

1. **Current grid rendering, navigation and state are Question-indexed.** A multi-unit Question changes the number of navigable cells, not just their storage lookup. The row/column arrangement and keyboard behavior need a coordinated adaptation.
2. **Current full-row saves can overwrite unrelated fields.** For JSONB units, implement atomic nested-unit updates or revision-checked writes. Do not preserve blind upsert semantics.
3. **`buildCorrectCountMap` feeds pooled scoring**, not just statistics. Migrating it incorrectly would change team points.
4. **The existing partial/bonus click cycle is Question-level**, and partial credit is currently stored as a count rather than per-Answer decisions. It must be replaced as part of the scoring migration, not merely wrapped.
5. **Realtime replaces whole Question cells.** The new save/realtime design must address races and prevent a stale event from undoing another unit update.
6. **Tiebreaker fields share current storage**, so a storage migration must explicitly retain their functionality.
7. **The draft JSON examples are not an implementation.** No `next_generation` schema or new scoring engine has been created.

## Locked requirements — do not reopen

- Use existing `isCorrect` and `isReviewed` property names on independently scored units.
- Key single-Answer ordinary Question units and other individually scored units by their Airtable Answer IDs; use a stable group-unit ID only for a multi-Answer all-or-nothing scoring decision.
- Host sees actual correct Answer text, not synthetic Answer/bonus labels.
- Preserve grid navigation and appearance except explicitly requested enhancements.
- Forward navigation reviews only the departed unit; backward navigation does not review.
- Solos/socials are determined by completed reviews for **every team and required unit**, then by teams with **positive derived Question points**; no 'passed' heuristic.
- Results are unavailable until required reviews complete; publishing follows Results readiness, with no redundant independent review rule.
- Publishing Question outcome: positive derived points => correct, otherwise incorrect; verify code implementation.
- Initial scoring modes keep independent partial and bonus scoring mutually exclusive.
- Scoring scopes are independent of Segments, Category Blocks, Answers Blocks, Results Blocks and legacy Round IDs.

## Remaining audit targets before implementation

1. Trace actual Answer IDs/text from Airtable into showBundle and existing Question rendering, including grouped and bonus Answers.
2. Trace exact Airtable publish function and Results readiness logic.
3. Inventory next-generation vs public Supabase dependencies, permissions, and realtime support; do not mutate production.
4. Identify tests and setup needed to exercise keyboard navigation, two-host updates, point calculations and review completion in the real app.

**This audit records existing dependencies. It does not propose new user-facing scoring behavior.**


## Additional traced dependencies — verified against current code

### Airtable Answer provenance: currently missing from bundle

`netlify/functions/fetchShowBundle.js:228–325` fetches `ShowQuestions`, gets linked `Question` record ID and sets `showQuestionId`, `questionId`, `answer` (display text from the `Answer` field or host edit), bonus/partial configuration. **It does not fetch the Airtable `Answers` table or expose Answer record IDs.** Therefore the new grid cannot correctly use Answer IDs from today's show bundle. First extend the content-fetch path to retrieve the linked Answer records and preserve their IDs and actual text, including multiple Answers. Do not manufacture Answer IDs from question order or text. Check Airtable linkage in the real base before coding a field name.

### Results: multiple consumers, not only ResultsMode

- `src/ResultsMode.js:393–436`: adapts Question cells to `isCorrect/bonusCount/partialCount`, uses `buildCorrectCountMap` and `buildTeamTotals` for standings.
- `src/ResultsMode.js:310–367`: faction accuracy currently increments `correctAnswers` from `cell.isCorrect`; must use derived Question success and consistent review/readiness semantics, without losing faction feature.
- `src/App.js:1672+`: **duplicates Results standings calculations** for the Mission Control/navigation results display; must migrate to same scoring engine, not leave old top-level reads.
- `src/App.js:130+`: independently subscribes to `public.scoring_cells` to update `scoringCache`; migrating only the `ScoringMode.js` realtime listener is insufficient.
- `src/ResultsMode.js:1168–1188`: publish button disabled only while publishing, **not by review completion**. Current code has no reviewed-all gate there. New Results readiness must gate Results availability upstream, and publish should remain dependent on that single readiness condition.

### Actual publishing behavior — confirmed

- `src/ResultsMode.js:823–975` builds an Airtable payload, computing `pointsEarned` from `computeCellPoints` and **exporting `isCorrect: !!cell.isCorrect` directly**. This is not yet the agreed Question-points-positive mapping. The adapted cell in this publish path includes `bonusCount` but **omits `partialCount`**, so partial credit points are not reliably exported.
- `netlify/functions/writeShowResults.js:140–154, 216–290` writes Airtable `Scores` records linked to Show, Team, ShowTeam, Question and ShowQuestion; fields `Is correct` and `Points earned`. It deletes previous Scores for the show and recreates them. This endpoint **does not derive correctness**; the client must send the agreed derived Question outcome. It skips tiebreakers and rows with missing/invalid linked IDs.
- `netlify/functions/supaMarkPublished.js` only updates `public.archived_shows.published_to_airtable` and `published_at`; not a correctness or readiness calculation.
- Publishing also exports a JSON backup and writes host question edits. Preserve both.

### Scope and isolation

The legacy live consumers reference `public.scoring_cells` explicitly in two separate React realtime subscriptions, while Netlify load/save uses default `public`. New-generation database calls and realtime must explicitly target `next_generation`, and the new schema must be exposed to the relevant Supabase API/realtime mechanisms as appropriate. No Supabase migration has been executed here.

## Concrete implementation sequence (not yet executed)

1. **Content contract:** inspect the actual Airtable Answer linkage; extend the show-bundle fetch/normalization to include real Answer IDs, texts and grouping. Preserve existing `answer` text for legacy display until new views are migrated. Verify an ordinary Question has exactly its real Answer ID.
2. **Pure scoring core and tests:** build a single unit-to-Question points calculation with all-or-nothing, threshold, independent partial and base-plus-bonus cases; derive correct-team count for pooled modes, Question positive-points outcome, team totals, review completion, solo/social and Results readiness. Keep Question occurrence IDs distinct from reusable Question IDs. Test edge cases and legacy formulas before wiring React.
3. **Schema and atomic persistence:** create isolated `next_generation` tables/policies/functions (only after schema design review). Store per-unit `isCorrect` and `isReviewed` keyed by actual Answer ID/group-unit ID. Support atomic unit-level writes and realtime without blind whole-row overwrites. Preserve team/tiebreaker/bonus features.
4. **Grid integration:** migrate `ScoringMode.js` rendering, actual Answer words, per-unit focus/navigation, click/review, cell appearance, totals and keyboard shortcuts together; preserve existing layout and behavior. Fix reviewed-circle fill to tile background.
5. **Other realtime and Results consumers:** migrate `App.js` cache listener and duplicate standings, `ResultsMode.js` standings, faction accuracy, tiebreaker and Results readiness to the shared core. Keep focus local across hosts.
6. **Publishing:** derive each Airtable Question-level `Is correct` as **Question points > 0** and `Points earned` from the shared core; preserve JSON backup, existing linked record IDs, host edits and republish behavior.
7. **Validation:** unit tests across all scoring modes and Answer configurations; manual end-to-end tests in real app for keyboard/visual state, two-host concurrent edits, review completion, Results and Airtable export. Verify production `rebuild` untouched.

### Explicitly unresolved external dependency

The repo shows only a display-text `Answer` field in `ShowQuestions`. The exact Airtable **Answers** table linked-field name and records are **not established by the repository code**. This must be inspected in Airtable before implementing Answer-ID keys; guessing would violate the agreed design.
