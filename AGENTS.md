# Next Generation development rules

Rebuild is protected production. All work must target next-generation or explicitly approved branches derived from it. Verify repository, branch and environment identity before every write. Never modify rebuild, main, other production branches, existing Netlify sites/settings/functions/storage/credentials, existing Supabase projects/tables/policies/functions/storage, or existing Airtable records/schema/scripts/automations. Unknown ownership blocks writes. Use independent Netlify and Supabase projects and scoped credentials. Historical migration is copy-and-verify, never destructive. No production transition without explicit user authorization.

Design from requirements, not legacy implementation. Preserve creative Airtable authoring, historical content versions, independent media availability and eventual offline resilience. Scoring scopes are independent of rundown organization. Discuss consequential architectural decisions before implementation. Distinguish proposals, approved requirements, implemented behavior and tested behavior.

Read PROJECT_STATUS.md and relevant docs before work. Establish automated regression tests early. Record decisions and rationale, tests, blockers and next steps. Update status at session end. GitHub is authoritative. Local workspace: ~/Developer/TriviaVanguard-NextGeneration.
