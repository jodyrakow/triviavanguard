# Rundown and Scoring Scope

## DECIDED: content and presentation
The structural hierarchy is:

`Show → Rundown → Segments → Blocks → Items → presentation stages`

- A Category owns its own Category Block.
- An Answers Block can reference **one or multiple** previously presented Category Blocks and their original Questions, without duplicating the Questions.
- Results Blocks present results but do not automatically delimit scoring.
- Segments, Category Blocks, Answers Blocks, and Results Blocks do **not** inherently define a scoring period.

## DECIDED: independent scoring scopes
A scoring scope may aggregate one or multiple sets of Category/Question Blocks and Answers Blocks, depending on the format of the show. A single show can contain multiple games or rounds, and scoring/placing must be defined independently of visual or presentation grouping.

## OPEN
- Detailed Builder controls for defining and editing scoring scopes.
- Scope transitions, results presentation, teams leaving between games, and league scoring.
- Source refresh/versioning from Airtable into the show snapshot.
