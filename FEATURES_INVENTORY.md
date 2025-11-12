# Trivia App Features Inventory
**Branch:** `main` (stable, running tonight's show)
**Date:** November 7, 2025
**Total Code:** 11,393 lines across 9 JS files

---

## 📊 File Overview

| File | Lines | Purpose |
|------|-------|---------|
| **App.js** | 2,035 | Main application, state management, real-time sync |
| **ShowMode.js** | 2,873 | Host view of questions/categories, display controls |
| **ScoringMode.js** | 2,271 | Scoring grid for entering team scores |
| **ResultsMode.js** | 2,559 | Final standings, tiebreaker resolution, prize display |
| **AnswersMode.js** | 1,260 | Answer key display with stats |
| **DisplayMode.js** | 360 | External projector/display view |

---

## ✅ AWESOME FEATURES (Keep These!)

### 1. **Display Mode** 🎥
**Status:** ✅ Working
**Files:** `DisplayMode.js` (360 lines), `ShowMode.js`, `App.js`

**What it does:**
- Full-screen external display for projector/second screen
- Open in separate window via "Open Display" button
- Push questions, images, standings to audience display
- Preview panel for host to see what's on display
- Multi-image navigation with left/right arrow buttons
- Auto-cycling images (15 seconds per image)
- "Clear Display" button for standby screen
- Logo in top-right corner
- Hides category names for Visual question types

**Key features:**
- URL-based routing (`?display` opens Display Mode)
- Custom events for real-time updates (`tv:displayUpdate`)
- `sendToDisplay` helper function in App.js
- BroadcastChannel API for cross-window communication

**Commits that added this:**
- `268f730`: Display Mode infrastructure
- `371d3b1`: Push to Display buttons
- `697c58c`: Image controls and Visual improvements
- `5839489`: Cross-window communication fix

---

### 2. **Answer Key System** 📋
**Status:** ✅ Working
**Files:** `ShowMode.js` (+165 lines)

**What it does:**
- "Show Answer Key" button in Show Mode controls
- Collapsible panel that displays formatted answer key
- Toggle to include/exclude labels (A., 1., etc.)
- **Copy to clipboard** button
- **Download as .txt file** button
- Preview pane showing formatted answer key
- Automatically excludes tiebreaker questions
- Works for both single-round and multi-round shows

**Helper functions:**
- `sortQuestionsForKey()`: Sorts questions correctly
- `detectTB()`: Identifies tiebreaker questions
- `buildRoundAnswerKeyText()`: Builds round-specific answer key
- `buildShowAnswerKeyText()`: Builds complete show answer key

**Commit:** `7e31834` - Add answer key functionality to Show Mode

---

### 3. **Refresh Show Data** 🔄
**Status:** ✅ Working
**Files:** `App.js`, `ShowMode.js` (+39 lines)

**What it does:**
- Fixes expired Airtable URLs (audio/images stop working after ~2 hours)
- "🔄 Refresh Show Data" button in Show Mode
- Re-fetches show bundle from Airtable without losing scoring data
- Shows confirmation alert when refresh succeeds
- Preserves all scoring state, only updates question/image/audio URLs

**Use case:** Audio stops playing or images fail to load mid-show → click button to get fresh URLs

**Commit:** `70ab7d6` - Add "Refresh Show Data" button

---

### 4. **Team Sync Warnings** ⚠️
**Status:** ✅ Working
**Files:** `App.js` (+110 lines), `ScoringMode.js` (+16 lines)

**What it does:**
- Detects conflicts when multiple hosts are scoring simultaneously
- **Activity indicators** showing when other hosts make changes
- Visual badges in header: score updates, team changes, team deletions
- Tracks timestamps to detect unsaved work during conflicts
- Enhanced warning message before deleting teams during concurrent scoring:
  - Warns about data loss if other hosts are scoring
  - Suggests coordination between hosts
  - Shows different message if team has scores vs. empty team

**Technical features:**
- `lastSupabaseTimestamp` ref to track data freshness
- `lastLocalChangeTime` ref to detect unsaved work
- `flashActivity()` helper to show real-time activity
- Detailed conflict info logged to console

**Commit:** `02ecbfd` - Add team sync conflict detection and warnings

---

### 5. **Display Controls Toggle** 👁️
**Status:** ✅ Working
**Files:** `ShowMode.js`

**What it does:**
- "Hide/Show Display Controls" button
- Toggles visibility of display control buttons
- Cleaner interface when not using projector
- Controls persist across page refreshes

**Commits:** `2624c29` and related UI tweaks

---

## 🔧 CRITICAL FIXES (Keep These!)

### 1. **Immediate Team Saves (No Debounce)**
**Problem:** Debounced saves were getting cancelled when switching rounds
**Fix:** Remove debouncing from team/shared state saves
**Commit:** `7884ee0` - CRITICAL FIX: Remove debounce

**Why it matters:** Prevents Round 1 scores from being lost when switching to Round 2

---

### 2. **Cache Format Conversion**
**Problem:** ScoringMode sends nested format, App expected unified format
**Fix:** Added conversion in `onChangeState` handler
**Commit:** `1fc824d` - Fix scoring persistence

**Format details:**
- **Nested (from ScoringMode):** `{ [teamId]: { [questionId]: {...} } }`
- **Unified (in App cache):** `{ "teamId-questionId": {...} }`

---

### 3. **Load All Rounds on Show Open**
**Problem:** Only active round loaded, switching rounds showed empty data
**Fix:** Load ALL rounds in parallel when show opens
**Commit:** `e281340` - CRITICAL: Load ALL rounds from Supabase

---

### 4. **Adaptive Pooled Scoring (Per-Round)**
**Problem:** Adaptive mode counted all teams, not just active ones in current round
**Fix:** Count teams with at least one answer in THIS round
**Commit:** `85cab00` - Calculate adaptive pooled scoring per-round

**How it works:**
- Counts only teams that have answered at least one question
- Falls back to total team count if no answers yet
- More fair for multi-round shows where teams join mid-game

---

## ⚠️ KNOWN ISSUES (Causing Problems)

### 1. **Collapsible Rounds in ScoringMode**
**Status:** 🔴 **PROBLEMATIC - Causes scoring grid to disappear**
**Files:** `ScoringMode.js` (lines 39-1825)

**What it does:**
- Renders rounds with collapsible sections
- Click round header to expand/collapse
- Only one round can be expanded at a time
- Collapsed by default

**The problem:**
- Grid sometimes doesn't render when switching rounds
- Scores can disappear
- Complex React rendering logic
- Conditional rendering: `{(isExpanded || totalRounds === 1) && rNum === activeRoundId && ...}`

**Commits that added this:**
- `4417c27`: Allow collapsing all rounds in Scoring Mode
- `1017e90`: Add collapsible round selector to Scoring Mode
- `69c84ce`: Restructure ShowMode to display all rounds with collapsible sections

**Action needed:** Remove or replace with simpler round navigation (pills)

---

### 2. **Multi-Round Data Sync Issues**
**Status:** 🟡 Partially fixed, but fragile

**Historical issues:**
- Scores disappearing between rounds
- Round 1 data lost when switching to Round 2
- Scores not syncing between hosts

**Fixes applied:**
- Removed debouncing (commit `7884ee0`)
- Load all rounds on open (commit `e281340`)
- Format conversion (commit `1fc824d`)

**Still concerning:**
- Complex cache structure: `scoringCache[showId][roundId]` + `_shared`
- Data stored in multiple places (localStorage + Supabase + state)
- No clear single source of truth

---

## 🎨 UI/UX Features

### Round Selectors (Show Mode & Scoring Mode)
- Pills to select which round to view
- Orange accent color for active round
- Smooth styling, hover effects
- **Commits:** `ac70d53`, `31226bc`, `ad053ba`

### Answer Stats Display
- Shows answer statistics in Show Mode
- Matches Answers Mode pill styling
- **Commit:** `13622b3` - Add answer/stats display to Show Mode

### League Checkbox
- Checkbox in scoring grid to mark league teams
- Persists via Supabase real-time sync
- **Visible in:** `ScoringMode.js` (lines 1439-1469)

### Team Scoring Mode
- Focus on one team at a time
- Arrow buttons to navigate between teams
- Dropdown to select specific team
- **Feature:** Makes scoring faster when teams take turns

### Keyboard Navigation (Scoring Grid)
- `1` or `Space`: Toggle correct/incorrect
- `Tab` / `Shift+Tab`: Next/prev question
- `←` / `→`: Switch team column
- `↑` / `↓`: Switch question row
- Arrow down from last question → focus tiebreaker input

---

## 🗄️ Architecture Notes

### State Management
**Location:** `App.js`

**Cache structure:**
```javascript
scoringCache = {
  [showId]: {
    [roundId]: {
      teams: [...],
      grid: { "teamId-questionId": {...} },  // Unified format
      entryOrder: [...]
    },
    _shared: {
      teams: [...],
      prizes: "",
      scoringMode: "pub",
      pubPoints: 10,
      poolPerQuestion: 500,
      poolContribution: 10,
      hostInfo: {...},
      tiebreakers: {},
      questionEdits: {}
    }
  }
}
```

### Real-time Sync (Supabase)
**Channel:** `tv-sanity`

**Events:**
- `mark`: Score toggled (correct/incorrect)
- `cellEdit`: Bonus/override points changed
- `tbEdit`: Tiebreaker guess entered
- `teamAdd`: Team added to show
- `teamRemove`: Team deleted
- `teamRename`: Team renamed
- `teamBonus`: Team bonus points changed
- `leagueToggle`: League checkbox toggled

**Offline queue:** Messages buffered when offline, sent when reconnected

### Password Protection
**Password:** `tv2025`
**Storage:** sessionStorage
**Lines:** `App.js:49-62`

---

## 📦 Dependencies

**Key packages:**
- `react` 19.1.0
- `@supabase/supabase-js` 2.57.4
- `airtable` 0.12.2
- `marked` 16.1.1 (Markdown parsing)
- `react-draggable` 4.5.0 (Timer)
- `react-h5-audio-player` 3.10.0 (Audio)
- `@netlify/blobs` 10.0.10

---

## 🚀 Netlify Functions

**Functions in `/netlify/functions/`:**

### Airtable-related:
- `fetchShows.js`: Get list of upcoming shows
- `fetchShowBundle.js`: Get show details (rounds, questions, teams)
- `fetchOlderShows.js`: Get archived shows

### Scoring:
- `supaSaveScoring.js`: Save scores to Supabase
- `supaLoadScoring.js`: Load scores from Supabase

### Archive:
- `supaArchiveShow.js`: Archive completed shows
- `supaUnarchiveShow.js`: Restore archived shows
- `supaGetArchiveStatus.js`: Check if show is archived

### Publishing:
- `writeShowResults.js`: Write final results to Airtable
- `updateShowQuestionEdits.js`: Save question edits back to Airtable
- `supaMarkPublished.js`: Mark show as published

### Tiebreaker:
- `getNextTiebreaker.js`: Get available tiebreaker question
- `markTiebreakerUsed.js`: Mark tiebreaker as used

### Misc:
- `searchTeams.js`: Search for teams by name
- `ping.js`: Health check

---

## 📋 What to Preserve in Rebuild

### ✅ Definitely Keep:
1. Display Mode (complete feature)
2. Answer Key system
3. Refresh Show Data button
4. Team Sync Warnings
5. Immediate team saves (no debounce)
6. Cache format conversion
7. Load all rounds on show open
8. Adaptive pooled scoring (per-round calculation)
9. League checkbox
10. Team Scoring Mode
11. Keyboard navigation

### 🔄 Redesign/Refactor:
1. **Collapsible rounds** → Replace with safe round pills (scroll-to or simple tabs)
2. **Cache structure** → Simplify to single source of truth
3. **State management** → Extract into custom hooks
4. **Real-time sync** → Centralize event handling
5. **Monolithic files** → Break into smaller components

### ❌ Remove (Causing Issues):
1. Collapsible round logic in ScoringMode
2. Complex conditional rendering based on expand state
3. Nested cache access patterns

---

## 🎯 Priority Issues for Rebuild

### High Priority (Data Integrity):
1. ✅ **Fixed:** Debounce cancellation bug
2. ✅ **Fixed:** Cache format mismatch
3. ✅ **Fixed:** Not loading all rounds
4. 🔴 **TODO:** Remove collapsible rounds (causes grid disappearance)
5. 🔴 **TODO:** Simplify cache structure
6. 🔴 **TODO:** Add TypeScript for type safety

### Medium Priority (Architecture):
1. Extract state management into hooks
2. Break up App.js (2,035 lines)
3. Break up ShowMode.js (2,873 lines)
4. Break up ResultsMode.js (2,559 lines)
5. Create component library for modals/buttons
6. Add constants file (magic strings everywhere)

### Low Priority (Polish):
1. Add tests for scoring calculations
2. Improve accessibility
3. Mobile responsiveness
4. Documentation

---

## 📝 Notes for Tonight's Show

**Current stable commit:** `ba58c55` on `main` branch

**What's working:**
- ✅ Display Mode
- ✅ Answer Key
- ✅ Refresh Show Data
- ✅ Team Sync Warnings
- ✅ All critical fixes applied

**What to watch out for:**
- 🟡 Collapsible rounds might cause scoring grid to disappear
- 🟡 If grid disappears, try refreshing the page
- 🟡 Coordinate with other hosts before deleting teams
- 🟡 If images/audio fail, use Refresh Show Data button

**Emergency recovery:**
- All data persists to Supabase automatically
- localStorage backup exists
- Can refresh page without losing scores
- Multiple hosts provide redundancy

---

**End of Inventory**
*Generated by Claude Code - November 7, 2025*
