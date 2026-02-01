---
name: Agent-Friendly Issue
about: Create an issue that the AI Dev Agent can implement
title: ''
labels: agent-ok
assignees: ''
---

## Goal

<!-- 
Clear, specific description of what should exist when this issue is complete.
Be explicit - the agent will implement exactly what you describe.
-->

## Acceptance Criteria

<!--
Concrete, testable outcomes. The agent uses these to verify success.
Each criterion should be independently verifiable.
-->

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Details

<!--
Specific implementation guidance. Include:
- Which files to modify or create
- Function/component names to use
- API endpoints or routes involved
- Expected behavior with examples
-->

**Files to modify:**
- `src/...`

**Expected behavior:**
```
When X happens, Y should occur
```

## Out of Scope

<!--
What should NOT change. This helps the agent stay focused.
Be explicit about boundaries.
-->

- Do not modify...
- Do not refactor...
- Do not add...

## Test Requirements

<!--
What tests should be added or updated?
-->

- [ ] Unit test for...
- [ ] E2E test for... (optional)

## Notes for Agent

<!--
Any additional context, warnings, or hints.
- Mention related files the agent should read
- Warn about tricky edge cases
- Note any patterns to follow
-->

---

### Checklist (for humans)

Before adding `agent-ok` label:

- [ ] Issue has clear, unambiguous acceptance criteria
- [ ] Technical details specify which files are involved
- [ ] Out of scope section defines boundaries
- [ ] No Prisma schema changes required (or explicitly approved)
- [ ] No database migrations required
- [ ] No environment/secret changes required
- [ ] Estimated as small/focused change
