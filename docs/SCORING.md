# Scoring Specification

## 1. Source data and configuration — DECIDED
- Airtable `Questions` records link to one or more `Answers` records. Each linked Answer is an atomic record; punctuation inside text does not create parts.
- Airtable remains the Question/Answer authoring source. Show-specific scoring configuration belongs to the app's Builder.
- Multiple acceptable Answers, base/bonus roles, and required thresholds must be configured explicitly when necessary.

## 2. Scoring configurations — DECIDED

| Configuration | Award rule | Main scoring grid |
| --- | --- | --- |
| All-or-nothing (default) | All required Answers correct for full credit | **One cell per Question**, regardless of linked Answer count |
| Threshold | Any configured N of M linked Answers earns full Question credit | **One cell per Answer** |
| Independent partial credit | Award independently for each credited Answer | **One cell per scorable Answer** |
| Base + bonus | Award base credit and eligible additional bonus credit | Separate controls for base and bonus as needed |

Partial credit and bonus scoring are mutually exclusive across scoring formats.

### Threshold examples
- “Name any 2 of 3”: mark individual correct Answers; full credit when at least two accepted Answers are selected.
- “Name any 3 of 5”: same principle with threshold three.
- Pooled threshold: **all qualifying teams share the Question's entire pool equally**. It is not an independent pool per selected Answer.

### Partial credit examples
- Pub: 20-point Question with four equally weighted parts gives 5 points per credited Answer.
- Proposed pooled rule discussed: 60-point Question with three Answers creates a 20-point pool per Answer, divided among teams credited with that Answer. **Exact rounding and allocation remain OPEN.**

### Incorrect extra Answers — DECIDED
Ordinarily, if a team's written response contains any invalid extra Answer, the Question earns zero. The host simply does not credit any Answer and advances; no invalid-response button is needed. Some explicitly configured partial-credit/guessing Questions permit individually crediting correct parts. Statistics reflect **recorded credited Answers**, not all Answers physically written by teams.

## 3. Host scoring workflow — DECIDED
- Score physical answer sheets in Question order; prioritize rapid keyboard interaction.
- Existing shortcut behavior is a useful REFERENCE to preserve or improve: `1` / Space toggles correctness; Tab/Shift+Tab navigate Questions; left/right arrows switch teams; up/down arrows move Questions. Final mapping and multirow navigation require prototype validation.
- Correct Answer text must appear immediately beside its Question/Answer scoring control.
- Sequential progression marks a Question reviewed even when no Answer was credited. Backtracking/corrections must not inadvertently mark unrelated Questions reviewed.
- Tiebreakers belong in a separate entry view, including when later corrections create a tie.

## 4. Storage and correctness — DECIDED
- Persist selections at team + Question + Answer granularity when Answer-level scoring applies; Question-level correctness for ordinary all-or-nothing.
- Keep review state separate from scoring selections.
- Supabase is authoritative. Multiple hosts must converge after updates, refresh, and re-login; show pending/saved/error states and handle reconnects.
- Calculate Question totals, team totals, and audience statistics from the same authoritative data and centralized scoring rules.
- Include sufficient change metadata/audit history to diagnose discrepancies.
- REFERENCE: The legacy app sometimes displayed different scoring cells to two hosts even after both refreshed and signed back in. Root cause not confirmed.

## 5. Audience Answer + Stats — DECIDED
- Show actual Answer text, never generic “Part A/B/C” labels.
- Use counts (“2 of 10 teams”), not percentages.
- **Threshold:** per-Answer counts **and** a separate count of teams that earned Question credit.
- **Pub independent partial:** per-Answer counts **and** distribution of total Question points (e.g., teams earning 0, 5, 10, 15, 20).
- **Pooled independent partial:** prominently show points awarded per correct Answer/part, with per-Answer team counts available; show Question-level team point-total distribution when useful.
- Do not infer teams earning Question credit by summing per-Answer counts; compute from team-level records.
- Default stage layouts and which optional statistics appear remain OPEN.

## 6. Unresolved scoring policy — OPEN
- Integer rounding and conservation of pooled points, including remainders and zero-correct cases.
- Pooled bonus semantics and eligibility rules.
- Whether and how to present pooled total-point distributions by default.
- Exact keyboard focus/navigation through threshold and partial-credit subrows.
- How alternative valid phrasings or Answer records that represent alternatives are distinguished from separately required Answers.
