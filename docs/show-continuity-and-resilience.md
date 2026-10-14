# Show continuity and outage resilience — design requirements

Status: Agreed product direction (2026-10-14); design only, not yet implemented.

## Guiding principles
- Any authorized host can take over content navigation/control at any time **while shared coordination is available**.
- Supabase is the normal shared coordination and authoritative state layer across hosts and devices.
- Audience display delivery and scoring synchronization have independent health checks and independent degradation paths; a failure in one must not falsely imply failure in the other.
- Show continuity is paramount. The host must be clearly informed of degraded behavior and must retain control over intentional fallback and recovery decisions.
- Never silently overwrite current content or scoring changes during reconnection.

## Display fallback
- Use Supabase-first shared coordination; support same-origin, same-device browser communication (e.g. BroadcastChannel) as a local delivery/fallback path.
- Detect actual delivery failure using display acknowledgments/timeouts, not solely socket connection status or Presence; avoid alarming on transient interruptions.
- Show an unmistakable, actionable Mission Control alert explaining the display failure, which systems still work, and whether local control is available.
- Allow a host to explicitly switch to local display control, designating the machine connected to the audience display as temporary controller.
- While local, continue lightweight Supabase health checks periodically and around host actions, without relying on clicks alone.
- When Supabase appears recovered, verify healthy delivery and reconcile display state, then notify hosts. **Do not automatically switch back.** Require host confirmation to return to shared control, with an option to stay local.
- Preserve the current display state (question, answer, message, timer, media, sequence) across refresh/reopen and transitions.
- Acknowledge limitation: BroadcastChannel cannot synchronize hosts on separate computers; multi-device offline coordination would require a distinct local-network solution.
- Provide a one-click diagnostic showing delivery acknowledgments and active path.

## Scoring resilience (separate from display)
- Independently detect and prominently report scoring synchronization failures, including local vs confirmed-shared save status.
- Preserve each scoring edit as a durable, uniquely identified operation with local persistence and server acknowledgment; retry safely/idempotently on recovery.
- Continue local scoring only with clear warnings about cross-host visibility and ownership; never imply another host received an unsynced change.
- Define explicit conflict rules for concurrent host edits while disconnected; never silently overwrite or duplicate score operations.
- Reconcile queued changes on recovery, requiring host review for genuine conflicts before resuming normal shared scoring.
- Keep scoring scopes independent of Segments, Category Blocks, Answers Blocks, and Results Blocks; resilience must preserve this architecture.

## Operational and testing requirements
- Mission Control shows distinct, evidence-based statuses for audience display, scoring, and show data.
- Exercise simulated outages: Broadcast/Presence failure, database synchronization failure, full Supabase outage, reconnect with stale cloud state, duplicate sends, browser refresh, and two-host conflicts.
- Review and repair missing legacy display-state Netlify functions as appropriate to next-generation design; do not assume the October 2026 emergency PR is production-ready.
- Defer backend implementation until the next-generation architecture phase; preserve the existing Mission Control shell and avoid changing the live `rebuild` branch.

## Incident motivation
On 2026-10-13, display Broadcast/Presence appeared disrupted during a Supabase Realtime incident while scoring continued functioning. On 2026-10-14, production functionality returned without a production code change. This strongly implicates Supabase but does not establish a complete root-cause proof.
