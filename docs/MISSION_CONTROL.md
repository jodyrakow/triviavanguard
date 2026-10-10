# Mission Control Specification

## DECIDED: layout and preview
- Laptop-first, no-scroll target at common host laptop sizes (1366×768, 1440×900, 1512×982).
- Dark navy approximately `#29384B` / `#2B394A`, orange `#DC6A24`, teal `#1B998B` for REPEATS.
- **Now Showing** renders the real audience Display, scaled to 16:9.
- **Up Next** renders shared Standby, scaled to 16:9.
- Private host inspection is separate and never changes the audience display.

## DECIDED: navigation
- Normal left-click on a ContentGrid Item opens host-local inspection, not on-air presentation.
- Right-click “Start from here” relocates the normal Rundown anchor.
- REPEATS toggle temporarily makes a single left-click present the selected Item on air.
- REPEATS stage navigation stays within the temporary Item; switching REPEATS off resumes the exact previous normal stage.
- Normal: one orange ON AIR indicator.
- REPEATS: teal ON AIR for the temporary Item and orange RESUME AT for the normal anchor.
- Private host inspection: orange ON AIR and subdued HOST STEP indicator.
- Do not add a gold Up Next ring.

## REFERENCE / OPEN
- The experimental newer app's Mission Control *physical layout* is a visual reference only; do not adopt its underlying architecture.
- Precise sizing, keyboard focus behavior, and final control placement require prototype testing.
- Other hosting needs (timers, music/OBS, image preloading, host messaging, announcements, results) remain to be specified.
