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
- Distinguish (1) show definition, (2) authoritative live production state (current production step, including its audience-visible content and HUD context; queued next; progression), and (3) host-local inspection state.
- Editing show content or reordering the Rundown must not silently advance, reset, or relocate the live on-air position.
- Behavior of **Up Next** after live Rundown reordering still needs explicit design.
- Scoring scopes remain independent of segments, Category Blocks, Answers Blocks, and Results Blocks. Answers Blocks may refer to multiple earlier Category Blocks without duplicating questions.
- Normal grid selection is private inspection; REPEATS can temporarily show selected content live while preserving the production position. Keep Program, Up Next, and host-local Preview distinct.


## BACK / GO — confirmed behavior
- **GO** activates the next authored production step; **BACK** activates the previous authored production step again, executing whatever that step specifies. BACK is not private selection and is not generic undo.
- **Audience-visible content is a component/property of the current production step**, not an independently navigated position. Each step can specify audience presentation, host-only HUD content, and other step-specific behavior.
- Two consecutive steps may have identical audience visuals but different HUD content. BACK/GO still navigate those steps, updating all step-specific aspects as defined.
- Timer starts, playback of an associated question audio file, and similar actions will **generally not be separate production steps**. They are discrete host-operated actions available *while a production step is active*; operating them does not inherently advance the Rundown.
- Do not assume BACK means merely restoring visuals/HUD or that it suppresses all step behavior. Whether a given action is step-defined or host-triggered matters.
- Detailed semantics for host-controlled Timer, Audio, and Image controls remain to be designed.

## Production controls — not yet reviewed in this icon pass
- Back, GO, Timer, Audio, Image: icons/labels and detailed interactions still to be decided.

## Implementation integrity
- A standalone HTML visual shell or iframe is **not** proof of an implemented live Display, realtime synchronization, permissions, or final React architecture.
- Review/approve design before significant speculative implementation; keep the `rebuild` branch untouched unless explicitly authorized.

## Timer and keyboard-driven hosting — observed workflow (2026-10-11)
- The host routinely uses **Right Arrow** to advance to the next question/production step, reads the question aloud twice with a pause, and presses **Up Arrow** near the end of the second reading to start the countdown.
- Timer start is **host-triggered**, not automatic on GO/question activation. Timer expiration cues the host to advance; do not assume automatic advancement.
- Keyboard shortcuts are a primary live-hosting workflow and must be first-class, predictable, and usable without reaching for the mouse.
- Existing timer UI has Reset, countdown, and a visually awkward **Pause** control hanging off the end; redesign as one coherent timer control group with readable time and intentionally integrated actions.
- Preserve/clarify shortcut semantics for timer start, pause/resume, reset, and step navigation before implementing; avoid hijacking shortcuts while editing text.

## Timer shortcut and production-control placement — 2026-10-11 refinement
- **Up Arrow**: start timer when idle, pause when running, resume when paused. Timer stays paused until explicitly resumed. Timer does not automatically start on GO or automatically advance the Rundown on expiry.
- Existing host app places BACK/forward navigation and timer together in a compact horizontal strip immediately **above the main audience/display/question area**, with the Rundown grid alongside. The host likes this location and relationship; use it as the design baseline instead of the recovered shell's far bottom-right production panel.
- Avoid wide unused gaps in the timer controls. Keep Reset, countdown, and Start/Pause/Resume cohesive, aligned, and sized to fit; the Pause button must not dangle off the end.
- This is a design direction; exact sizes/arrangement have not yet been approved.

## Confirmed Mission Control spatial layout — 2026-10-11
- A **single top toolbar strip above Now Showing** contains a compact production cluster (**BACK, GO, Timer**) alongside a distinct utility cluster (**Open Display, Link to Display, Print Answer Key, Show Settings**). The precise order, spacing, and responsive behavior remain to be refined.
- **Now Showing** remains the large live audience Display view on the **upper left**.
- **Host HUD**, including **Up Next**, remains to the **right** of Now Showing.
- **Rundown content grid** remains **below Now Showing**, as in the recovered mockup, **not** beside the Display as in the old app.
- Preserve the *toolbar/control placement* familiarity of the old app, not its overall pane arrangement. The prior prototype's far bottom-right production-control area should not remain the primary location for BACK/GO/Timer.

## Active colors and HUD information — 2026-10-11
- **Orange is the active-state color** throughout Mission Control, including the RUN lifecycle state. Do not use green to signal the running timer; its Start/Pause/Resume label indicates its state.
- **Do not duplicate Up Next details in the Host HUD.** The separate Up Next panel already provides that information. Reserve the HUD for useful current-step host context such as notes, script, and pronunciation.
