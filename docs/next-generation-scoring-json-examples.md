# Proposed scoring JSON examples — draft 1

These are **illustrations for review, not an approved database schema**. **Host-facing cells display the actual correct Answer words.** The `id` and `answerId` fields are internal identifiers only; do not render letter/number labels for parts or bonuses. They intentionally separate reusable Airtable Answers, show-specific scoring configuration, and per-team score state.

## Shared record pattern

```json
{
  "questionOccurrenceId": "occ-q12-show42",
  "airtableQuestionId": "recQUESTION12",
  "scoring": {
    "kind": "independent_partial",
    "units": [
      {"id": "answer-a", "answerId": "recANSWER_A", "required": true},
      {"id": "answer-b", "answerId": "recANSWER_B", "required": true}
    ]
  }
}
```

Show-specific config is stored with QuestionOccurrence, **not copied into every team's scoring row**. A scoring row for a particular team:

```json
{
  "teamParticipationId": "participation-team7-show42",
  "questionOccurrenceId": "occ-q12-show42",
  "revision": 4,
  "units": {
    "answer-a": {"reviewed": true, "credited": true},
    "answer-b": {"reviewed": true, "credited": false}
  }
}
```

`credited` means host awarded credit for that unit. Derived points are calculated from configuration; not manually stored as authoritative data. `revision` is a concurrency design candidate.

## A. All-or-nothing, multiple possible Answers

Config:
```json
{
  "kind": "all_or_nothing",
  "answerIds": ["recA", "recB", "recC"],
  "units": [{"id": "base", "required": true}]
}
```

Team units:
```json
{"base": {"reviewed": true, "credited": true}}
```

**UI:** one cell displaying the correct Answer text (or the appropriate combined Answer content), not an artificial part label. Host judges whether all required Answers are correct. **Points:** full or zero.

## B. Threshold: any 3 of 4 Answers

Config:
```json
{
  "kind": "threshold",
  "threshold": 3,
  "units": [
    {"id": "a", "answerId": "recA", "required": true},
    {"id": "b", "answerId": "recB", "required": true},
    {"id": "c", "answerId": "recC", "required": true},
    {"id": "d", "answerId": "recD", "required": true}
  ]
}
```

Team units:
```json
{
  "a": {"reviewed": true, "credited": true},
  "b": {"reviewed": true, "credited": false},
  "c": {"reviewed": true, "credited": true},
  "d": {"reviewed": true, "credited": true}
}
```

**UI:** four cells in sequence, each displaying its actual correct Answer text, not A/B/C/D labels. **Points:** full Question points only after 3+ credited; otherwise zero. Completion still requires all four cells reviewed unless explicit optional-unit rules are adopted.

## C. Independent partial credit: two Answers

Config:
```json
{
  "kind": "independent_partial",
  "units": [
    {"id": "a", "answerId": "recA", "required": true},
    {"id": "b", "answerId": "recB", "required": true}
  ]
}
```

Team units:
```json
{
  "a": {"reviewed": true, "credited": true},
  "b": {"reviewed": true, "credited": false}
}
```

**UI:** two cells displaying the two correct Answer texts, not letter labels. **Points:** one of two shares, using the show's scoring mode and a yet-to-be-confirmed integer rounding rule. Unlike threshold, credit is not all-or-nothing.

## D. Base + bonus (no independent partial answers)

Config:
```json
{
  "kind": "base_plus_bonus",
  "bonusRule": {"type": "flat", "pointsPerCreditedBonus": 1},
  "units": [
    {"id": "base", "required": true},
    {"id": "bonus-a", "answerId": "recBONUS_A", "required": true}
  ]
}
```

Team units:
```json
{
  "base": {"reviewed": true, "credited": true},
  "bonus-a": {"reviewed": true, "credited": false}
}
```

**UI:** base Answer text then bonus Answer text in separate cells, same navigation keys; no artificial bonus labels. **Points:** show-specific base scoring plus configured bonus. This flat bonus rule is **only an example**, not a confirmed replacement for existing percentage/flat behavior.

## Explicitly out of v1 scope

Do **not** create a `kind` that mixes `independent_partial` and `base_plus_bonus` for initial implementation. Their combination is not currently required, although the underlying `units` format intentionally does not forbid a future extension.

## Readiness and reporting pseudocode

```js
const isTeamQuestionReviewed = (configuration, teamScore) =>
  configuration.units
    .filter(unit => unit.required)
    .every(unit => teamScore.units?.[unit.id]?.reviewed === true);

const isQuestionReviewedForAllTeams = (configuration, teamScores) =>
  teamScores.every(score => isTeamQuestionReviewed(configuration, score));

// The scoring engine determines points according to configuration + scoring scope.
const publishCorrect = questionPointsEarned > 0;
```

`teamScores` must contain **every participating team**, including teams with no existing scoring row; a missing record counts as unreviewed. Results readiness is checked once at the scoring-scope level and publishing relies on that readiness.

## Persistence comparison to test before SQL

**One row per Team + QuestionOccurrence, JSONB units:** compact reads and natural grouping; requires atomic nested updates / optimistic revision to avoid lost updates.

**One row per Team + QuestionOccurrence + Unit:** easier per-unit writes and realtime events; requires grouping when reading Question-level outcomes.

Neither is automatically the winner. Choose after evaluating actual Supabase functions, realtime behavior, and the need to inspect or query individual Answer outcomes.
