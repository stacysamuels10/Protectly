---
phase: 06-legacy-cleanup
plan: 01
subsystem: infra
tags: [express, sequelize, git, gitignore, cleanup]

# Dependency graph
requires: []
provides:
  - "15 legacy Express+Sequelize files removed from git index and filesystem"
  - "app.js, server/, views/, models/ deleted (CLN-01)"
  - ".sequelizerc, config/config.js, migrations/, seeders/ deleted (CLN-02)"
  - ".gitignore cleaned of 7 dead rules for deleted directories"
affects: [06-legacy-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: [Use git rm (not rm) for tracked file removal — ensures git index and filesystem stay in sync]

key-files:
  created: []
  modified:
    - ".gitignore"

key-decisions:
  - "git rm used (not rm) to remove legacy files — ensures removals are staged in git index immediately"
  - "config/ directory verified removed after config/config.js deletion — git does not track empty directories"
  - "Out-of-scope legacy .gitignore entries preserved (components, actions, reducers, buildscript.js, Procfile.dev, public/App.js, public/App.css) — those directories still tracked, cleanup is out of scope for this phase"

patterns-established:
  - "When removing tracked files: always use git rm, never rm, to keep git index and filesystem synchronized"

requirements-completed: [CLN-01, CLN-02]

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 6 Plan 01: Legacy Express + Sequelize File Removal Summary

**885 lines of dead Express+Sequelize code removed via git rm — 15 files across app.js, server/, views/, models/, migrations/, seeders/, and .sequelizerc; .gitignore cleaned of 7 dead rules**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T20:52:00Z
- **Completed:** 2026-02-22T20:53:04Z
- **Tasks:** 2
- **Files modified:** 16 (15 removed, 1 modified)

## Accomplishments
- Removed all 15 legacy Express application files from git index and filesystem using `git rm`
- Deleted 885 lines of dead code: app.js (219 lines), server/routes (329 lines), views/ templates, models/ (103 lines), migrations/ (86 lines), seeders/ (101 lines)
- Cleaned .gitignore of 7 dead rules referencing deleted directories, preserving out-of-scope legacy entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove all legacy Express and Sequelize files via git rm** - `2a27549` (chore)
2. **Task 2: Clean dead .gitignore entries for removed directories** - `deffefc` (chore)

**Plan metadata:** _(to be committed with this SUMMARY)_

## Files Created/Modified
- `.gitignore` - Removed 7 dead rules: /server/, /models/, /migrations/, /seeders/, /config/, /views/, app.js

## Files Removed
- `app.js` - Legacy Express application entry point (219 lines)
- `.sequelizerc` - Sequelize configuration file
- `config/config.js` - Sequelize database config (41 lines)
- `server/routes/ApprovedList/app.js` - Express approved list route (170 lines)
- `server/routes/Webhooks/index.js` - Express webhook route (74 lines)
- `server/routes/Webhooks/verifyWebhook.js` - Express webhook verification (85 lines)
- `models/index.js` - Sequelize models index (46 lines)
- `models/approvedlist.js` - Sequelize approved list model (30 lines)
- `models/userstable.js` - Sequelize users model (27 lines)
- `views/error.hbs` - Handlebars error template
- `views/index.hbs` - Handlebars index template
- `migrations/20220908211246-create-users-table.js` - Sequelize migration (35 lines)
- `migrations/20220912155446-approvedlist.js` - Sequelize migration (51 lines)
- `seeders/20220909130248-UsersTables.js` - Sequelize seeder (37 lines)
- `seeders/20220912160435-approvedlists.js` - Sequelize seeder (64 lines)

## Decisions Made
- Used `git rm` (not `rm`) to remove legacy files — ensures removals are staged in the git index immediately, not just deleted from filesystem
- Out-of-scope legacy .gitignore entries (components, actions, reducers, buildscript.js, Procfile.dev, public/App.js, public/App.css) preserved — those files are still tracked in git and outside this phase's scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CLN-01 and CLN-02 satisfied: all Express+Sequelize artifacts removed from repository
- Repository now clearly reflects Next.js+Prisma architecture with no legacy code confusion
- Ready for Phase 06 Plan 02: further legacy cleanup tasks

---
*Phase: 06-legacy-cleanup*
*Completed: 2026-02-22*

## Self-Check: PASSED

- CONFIRMED ABSENT: app.js, server/, views/, models/, .sequelizerc, config/config.js, migrations/, seeders/ (filesystem)
- CONFIRMED: All legacy files removed from git index (git ls-files returns empty)
- CONFIRMED: Dead gitignore rules removed (grep count = 0)
- CONFIRMED: 3 out-of-scope entries preserved in .gitignore (components, actions, reducers)
- FOUND: Task 1 commit 2a27549
- FOUND: Task 2 commit deffefc
