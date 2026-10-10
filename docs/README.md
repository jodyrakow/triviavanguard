# TriviaVanguard Next Generation — Design Source of Truth

This directory contains the design specifications for a ground-up redesign of TriviaVanguard. The `rebuild` branch is the protected live production reference. The `next-generation` branch is for new design and development only.

## Status and authority
- **DECIDED**: user-confirmed behavior that implementation must preserve.
- **PROPOSED**: a promising approach, not yet a requirement.
- **OPEN**: requires a decision or validation before implementation.
- **REFERENCE**: describes existing behavior or an observed problem, not necessarily desired behavior.

Read `DECISIONS.md`, `SCORING.md`, `RUNDOWN.md`, `MISSION_CONTROL.md`, and `OPEN_QUESTIONS.md` before making architectural changes.

The initial branch was created from `rebuild` for a safe branch point; inherited code is **not** the foundation or approved architecture for the new application. Do not alter `rebuild`, merge `next-generation` into `rebuild`, or change production deployment settings without explicit approval.

## Workflow
Discuss and confirm design decisions first; update these documents in the same branch; implement against them afterward. Record any unresolved behavior as OPEN rather than guessing. Preserve source materials (notes, screenshots, recordings, legacy code) as references.
