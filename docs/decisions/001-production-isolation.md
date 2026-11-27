# ADR-001 — Production isolation

Status: agreed by user. Date: 2026-11-27.

Rebuild must remain usable throughout Next Generation development. Develop on next-generation with independent Netlify and Supabase environments. Existing Airtable is initially read-only for development. No modifications to existing production infrastructure, no compatibility adapter into Rebuild, no destructive migration, no automatic cutover.

Rationale: preserve ongoing live events and prevent development regressions from affecting production. Existing implementations inform functional requirements, not technical inheritance.

Consequences: separate infrastructure and credentials, explicit environment verification, non-destructive data copying, independent testing, explicit approval before transition.
