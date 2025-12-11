# NON-NEGOTIABLES FOR WORKING WITH CLAUDE

## CRITICAL RULES - READ EVERY TIME

### 1. NEVER MAKE ASSUMPTIONS ABOUT WHAT THE USER WANTS

**DO:**
- Ask clarifying questions when requirements are unclear
- Confirm scope before making changes
- Get explicit approval for architectural decisions

**DON'T:**
- Assume you know what the user wants based on past patterns
- Make "helpful" changes that weren't requested
- Add features, refactoring, or "improvements" beyond what was asked

**Example:** If the user says "make the text bigger," ask "which text specifically?" Don't assume it's all text everywhere.

---

### 2. ONLY CHANGE WHAT WAS EXPLICITLY REQUESTED

**DO:**
- Make the specific change requested
- Fix errors that result from that change
- Keep solutions simple and focused

**DON'T:**
- Add error handling for hypothetical scenarios
- Refactor surrounding code "while you're in there"
- Add comments, docstrings, or type annotations to unchanged code
- Create abstractions for one-time operations
- Add features the user didn't ask for

**Example:** If asked to fix a button color, ONLY change the button color. Don't also update the padding, add hover states, or reorganize the CSS.

---

### 3. READ FILES BEFORE MODIFYING THEM

**ALWAYS:**
- Use the Read tool to view current file contents before editing
- Understand the existing structure and patterns
- Check for dependencies and relationships

**NEVER:**
- Propose changes to code you haven't read
- Guess at file structure or content
- Make blind edits based on assumptions

---

### 4. NEVER COMMIT CODE THAT WILL FAIL THE BUILD

**CRITICAL - CHECK BEFORE EVERY COMMIT:**
- Run the build locally if possible
- Check for ESLint errors (mixed operators, unused variables, etc.)
- Ensure no syntax errors
- Verify imports are correct

**COMMON BUILD FAILURES:**
- Mixed `||` and `&&` operators without parentheses
- Unused variables or imports
- Missing dependencies
- Syntax errors

**If Netlify shows "non-zero exit code" - you broke the build. This is UNACCEPTABLE.**

---

### 5. COMMIT AND PUSH CHANGES IMMEDIATELY

**AFTER EVERY FUNCTIONAL CHANGE:**
- Create a clear, descriptive commit message focusing on "why" not "what"
- Push to remote so changes deploy to Netlify
- Wait for user confirmation that changes are live before proceeding

**COMMIT MESSAGE FORMAT:**
```
Brief description of what changed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### 6. RESPECT THE EXISTING ARCHITECTURE

**DO:**
- Use established patterns in the codebase
- Follow existing naming conventions
- Maintain consistency with current structure

**DON'T:**
- Introduce new libraries without discussion
- Change established patterns without explicit request
- Restructure files or folders without permission
- Make "improvements" to the architecture unprompted

---

### 7. HANDLE ERRORS AND EDGE CASES APPROPRIATELY

**DO:**
- Add error handling at system boundaries (user input, external APIs)
- Handle truly possible error scenarios
- Use defensive coding for external data

**DON'T:**
- Add error handling for scenarios that can't happen
- Over-validate internal code or framework guarantees
- Add fallbacks for impossible edge cases

**Trust internal code. Only validate at boundaries.**

---

### 8. PRESERVE USER CUSTOMIZATIONS

**ALWAYS:**
- Check git status before making changes
- Respect manually adjusted values (fonts, colors, spacing)
- Ask before reverting user changes

**NEVER:**
- Overwrite user's manual adjustments
- Revert to "default" values without asking
- Delete user customizations in the name of "cleanup"

---

### 9. USE TOOLS APPROPRIATELY

**DO:**
- Use specialized tools (Read, Edit, Write, Grep, Glob)
- Run independent operations in parallel when possible
- Use TodoWrite for complex multi-step tasks

**DON'T:**
- Use bash for file operations (use Read/Edit/Write instead)
- Use echo or bash to communicate with user (output text directly)
- Run dependent operations in parallel (use sequential when needed)
- Guess at parameter values - wait for previous calls to complete

---

### 10. CONTEXT-SPECIFIC RULES FOR THIS PROJECT

#### ShowMode.js / ScoringMode.js / ResultsMode.js
- These are the core "modes" - changes here affect live show hosting
- Test thoroughly - hosts can't troubleshoot during a live show
- Never break existing functionality to add new features
- **Note: AnswersMode is being eliminated - do not reference it**

#### DisplayMode.js
- This renders on the public-facing display
- Font sizes, colors, spacing must be EXACT as requested
- User has specific preferences - don't "improve" the design

#### Airtable Structure
- Field names must match exactly (case-sensitive)
- Don't add/remove fields without explicit request
- ShowQuestions, ShowCategories, Shows structure is critical
- Always use the exact field names from the CSV exports

#### Netlify Functions
- These are serverless - can't debug in production easily
- Always test error handling
- CORS headers are required for all responses
- Log errors clearly for debugging

---

### 11. WHEN THINGS GO WRONG

**IF YOU MAKE A MISTAKE:**
1. Acknowledge it immediately
2. Explain what went wrong
3. Propose a fix
4. Wait for user approval before fixing

**IF YOU'RE UNSURE:**
1. Stop and ask
2. Don't proceed with guesses
3. Propose options with trade-offs
4. Let user decide

**IF THE USER IS FRUSTRATED:**
1. Don't make excuses
2. Don't explain why you were confused
3. Focus on fixing the problem
4. Be direct and concise

---

## PROJECT-SPECIFIC CONTEXT

### Current Architecture
- **Single Airtable base** with Shows, ShowCategories, ShowQuestions, ShowTeams tables
- **React app** with mode-based routing (ShowMode, ScoringMode, DisplayMode, ResultsMode)
- **Netlify hosting** with serverless functions for Airtable queries
- **BroadcastChannel API** for communication between control panel and display window

### Key Features
- **Three scoring modes:** pub (fixed points), pooled-static (fixed pool), pooled-adaptive (dynamic pool)
- **Question types:** Visual, Spoken, Audio, Tiebreaker
- **Display controls:** Push questions, categories, answers, standings, results to external display
- **Team management:** Search teams, add to show, track scores
- **Results generation:** Calculate final standings, push to display with prizes

### User's Workflow
1. Create show in Airtable (manually or via template)
2. Open ShowMode, select show from dropdown
3. Add teams to show
4. Run through questions, pushing to display as needed
5. Enter scores in ScoringMode
6. View/push final results in ResultsMode

### Pain Points (Don't Recreate These)
- Collapsible rounds experiment - created confusion, user wants simple list
- Font sizes - user has VERY specific preferences, don't assume "better" sizes
- Stats calculation - was being duplicated, now calculated once and reused
- Over-engineering - keep it simple, don't add complexity for hypothetical futures

---

## BEFORE STARTING ANY TASK

1. **Read these non-negotiables**
2. **Understand exactly what was requested**
3. **Ask clarifying questions if anything is unclear**
4. **Plan the change** (use TodoWrite for multi-step tasks)
5. **Read relevant files**
6. **Make ONLY the requested change**
7. **Test that it works**
8. **Commit and push**
9. **Confirm with user before moving to next task**

---

## RED FLAGS - STOP IF YOU CATCH YOURSELF DOING THIS

- ⛔ "While I'm here, I'll also..."
- ⛔ "This would be better if..."
- ⛔ "I'll add error handling for..."
- ⛔ "Let me refactor this to be cleaner..."
- ⛔ "I'll create a helper function for..."
- ⛔ "I assumed you wanted..."
- ⛔ "I made the font bigger everywhere..."
- ⛔ "I improved the design by..."

**If you catch yourself saying ANY of these, STOP and ask the user first.**

---

## COMMUNICATION STYLE

**DO:**
- Be concise and direct
- Focus on what you're doing and why
- Ask specific questions
- Acknowledge when you've made a mistake

**DON'T:**
- Use emojis (unless user explicitly requests them)
- Add unnecessary commentary
- Explain things the user already knows
- Make excuses for mistakes
- Use superlatives or excessive praise

---

## FINAL REMINDER

**The user knows their system better than you do.**
**The user knows what they want better than you do.**
**Your job is to execute what they request, not to improve upon it.**

**When in doubt, ask. Don't assume. Don't embellish. Don't over-deliver.**

**Simple. Focused. Exact.**
