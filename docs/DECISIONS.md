# Confirmed Decisions

## Project boundaries — DECIDED
- Build a new TriviaVanguard app around actual live-host workflows.
- `rebuild` remains untouched as the functional production reference.
- Do not salvage the experimental newer codebase as architecture; its Mission Control physical layout can inform the new design.
- Keep specifications version-controlled alongside the new project.

## Scoring — DECIDED
- Scoring is keyboard-first, fast, and primarily performed in Question order across teams.
- A Question can link to multiple **atomic** Answer records in Airtable. Never split Answer text on punctuation or conjunctions.
- Default all-or-nothing scoring uses **one scoring cell per Question**, even with multiple linked Answers.
- Threshold scoring (any N of M) uses **one cell per linked Answer**; full Question credit requires the configured number.
- Independent partial credit uses separately scored Answers and supports per-Answer cells.
- Base-plus-bonus scoring is supported; bonus and partial-credit modes are mutually exclusive.
- A wrong extra response ordinarily invalidates the entire Question. Hosts simply leave it uncredited and advance; no ordinary “invalid answer” toggle.
- Reviewed/unreviewed is separate from correct/incorrect. Sequential advancement over an unanswered Question marks it reviewed, without requiring an incorrect click.
- Scoring selections must persist individually and reliably; Supabase is authoritative and multiple hosts must converge on the same scores.
- Whole-number points only; avoid independent ad hoc rounding.
- Tiebreaker guesses are entered in a separate workflow, not in the main scoring grid.
- Correct Answer texts appear beside Questions in the host scoring grid.
- Audience statistics can show both per-Answer correctness and Question-level outcomes; never require the audience to infer Question credit from Answer counts.
- Audience statistics use counts, not percentages. For pooled scoring, show points earned per correct Answer/part prominently.

## Rundown — DECIDED
- Show → Rundown → Segments → Blocks → Items → presentation stages.
- Each Category has its own Category Block.
- An Answers Block can reference multiple earlier Category Blocks without duplicating Questions.
- Scoring scopes are independent of Segments, Category Blocks, Answers Blocks, and Results Blocks. A scope can aggregate multiple sets of blocks.

## Mission Control — DECIDED
- Laptop-first, compact layout; Now Showing is a scaled actual audience Display, and Up Next is the shared Standby.
- Ordinary left-click inspects content privately; right-click “Start from here” changes the normal Rundown position.
- REPEATS mode allows a temporary on-air Item without moving the normal Rundown anchor; turning it off returns to the exact normal stage.
- Host-local inspection never changes the venue screens.
- Distinguish normal ON AIR from REPEATS ON AIR and RESUME AT.

See the domain-specific documents for details, caveats, and unresolved rules.
