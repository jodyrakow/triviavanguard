# Open Questions and Deferred Work

Do not silently convert the following into requirements.

## Scoring
1. How should pooled points be rounded/allocated while retaining whole-number awards? What happens to remainders and pools with no correct teams?
2. How should pooled bonus points work? Are bonuses conditional on base correctness, and how is their value/pool established?
3. What are the exact keyboard interactions and focus rules for threshold, partial-credit, and bonus subrows?
4. Which Answer + Stats elements should be on by default for each scoring type, and which are configurable in the Builder?
5. How do we represent accepted alternatives versus distinct scorable Answer records?
6. What is the precise per-cell persistence, synchronization, conflict-resolution, and audit implementation?
7. How are team totals, placings, league points, and multiple game scopes presented?

## Builder / Rundown
8. How are scoring scopes defined across multiple Category and Answers Blocks?
9. What is the explicit Airtable content-refresh/versioning workflow after importing a show?
10. How are presentation stages configured for images/audio, multi-Answer reveal, and statistics?

## Mission Control / hosting
11. Validate no-scroll layout, keyboard navigation, and preview behavior in interactive prototypes.
12. Specify timers, sound/music/OBS controls, host-to-host cues, images, announcements, printouts, and offline contingency.

## Deployment safety
13. Verify Netlify production deployment settings before any deployment or branch configuration change.
14. Decide whether to remove inherited files from `next-generation` or establish a clean orphan/root history. No inherited application code is approved as the new foundation.

## Reference materials
- User's original Notes app pain-point list.
- Scoring screen recording and mockups.
- Working production `rebuild` branch for behavioral comparison only.
