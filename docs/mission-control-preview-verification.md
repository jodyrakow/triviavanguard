# Mission Control preview verification

This branch is a visual React prototype for the approved Mission Control cockpit. It is intentionally separate from the production `rebuild` branch.

## Verification checklist

- Confirm the Netlify Deploy Preview for PR #3 builds and loads.
- Compare the cockpit to the approved standalone Safari HTML reference.
- Confirm BACK, GO, and timer are adjacent in the toolbar and Questrial is used for controls.
- Confirm Now Showing on the left, Host HUD and Up Next on the right, Rundown below.
- Confirm orange active states and click-again-to-close inspection.
- Confirm Up Next expanded preview, keyboard controls, and timer behavior.
- Do not treat mock data or disconnected Display/Builder controls as live functionality.

Do not merge until visual review and build validation are complete.
