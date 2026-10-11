# Mission Control — Design Decisions
Status: working decisions, 2026-10-11. This document records agreed product requirements, not claims of implemented functionality.

## Display — one real audience experience
- The Display is the actual audience-facing 1920 × 1080 experience.
- **Now Showing** in Mission Control must be a *live view of that exact Display*, not an approximation, separate rendering, or fake preview. The same audience page/rendering component and authoritative live presentation state must be used across every viewing location.
- **Open Display** opens that audience page in a browser window, normally on the host computer's extended display connected to venue TVs.
- **Link to Display** provides a shareable URL to the *same* audience page for a venue-operated computer. It is not a different display system or a connection-management interface.
- A possible future stable per-venue display address/identity is worth preserving architecturally, but is **not yet specified or approved for implementation**.
- The Display is audience-facing; accessing its link does not imply host production controls. Authorized hosts manage production state.
- Up Next is a separate host-side preview of the next advance result. HUD and private inspection are host-side context, not audience displays.

## Mission Control layout and interaction
- Use the recovered laptop cockpit layout as the visual baseline: Now Showing left; HUD and Up Next right; Rundown navigation and production controls below.
- The Rundown Builder specifies **every grid label**; Mission Control must display authored labels verbatim, not infer labels from item type, numbering, or position.
- No yellow highlight for the Up Next grid item; the dedicated Up Next preview communicates this.
- Raise the default Mission Control typography for readability while keeping the laptop layout practical; current prototype's larger type is an iteration, not a final locked size.
- No modal dialogs. Use inline controls or integrated/docked panels. Immediate tooltips on hover/focus; center button text and icons.
- Use a consistent icon family (Lucide proposed), with a **mix of icon-only and icon-plus-label buttons**.

## Top toolbar — agreed
1. **Open Display**: monitor/display icon **and visible text label**.
2. **Link to Display**: link icon **and visible text label**; supplies shareable URL.
3. **Print Answer Key**: clipboard/clipboard-list icon only, with immediate “Print Answer Key” tooltip. Keep in Mission Control toolbar **and** make available in Show/Rundown Builder. Both use the same printing implementation; printing must not interrupt live audience display.
4. **Show Settings**: gear icon only, with immediate “Show Settings” tooltip. Opens an integrated panel, not a modal, for last-minute show-specific edits, including host names, prize information, default timer setting. These edits update the same show configuration as the Builder, not a second settings store. Changing default timer must not unexpectedly restart or alter an active countdown.
- Remove undefined **Show Notes** and **Host Tools** buttons.
- Remove routine **Refresh** button; live Builder edits should propagate automatically.
- Remove undefined **More Tools** catch-all unless a specific need emerges.
- The toolbar above is a product decision; prototype code may still lag these decisions.

## Builder as source of truth; live state boundaries
- The Show/Rundown Builder is authoritative for content, grid labels, notes, media, structure/order, and show-specific settings.
- Builder edits during a show should automatically propagate to active hosts and relevant display output without manual refresh.
- Distinguish (1) show definition, (2) authoritative live production state (on air, queued next, progression), and (3) host-local inspection state.
- Editing show content or reordering the Rundown must not silently advance, reset, or relocate the live on-air position.
- Behavior of **Up Next** after live Rundown reordering still needs explicit design.
- Scoring scopes remain independent of segments, Category Blocks, Answers Blocks, and Results Blocks. Answers Blocks may refer to multiple earlier Category Blocks without duplicating questions.
- Normal grid selection is private inspection; REPEATS can temporarily show selected content live while preserving the production position. Keep Program, Up Next, and host-local Preview distinct.

## Production controls — not yet reviewed in this icon pass
- Back, GO, Timer, Audio, Image: icons/labels and detailed interactions still to be decided.

## Implementation integrity
- A standalone HTML visual shell or iframe is **not** proof of an implemented live Display, realtime synchronization, permissions, or final React architecture.
- Review/approve design before significant speculative implementation; keep the `rebuild` branch untouched unless explicitly authorized.
