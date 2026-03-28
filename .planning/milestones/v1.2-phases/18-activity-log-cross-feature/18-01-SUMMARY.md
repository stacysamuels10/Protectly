---
phase: 18-activity-log-cross-feature
plan: "01"
subsystem: activity-log
tags: [client-component, tabs, pagination, api-extension]
dependency_graph:
  requires: []
  provides: [ActivityLogClient, Tabs-ui-primitive, activity-api-statusCounts]
  affects: [dashboard-activity-page]
tech_stack:
  added: [radix-ui/react-tabs]
  patterns: [TDD, url-state-management, parallel-prisma-queries]
key_files:
  created:
    - src/components/ui/tabs.tsx
    - src/components/dashboard/activity-log-client.tsx
    - src/components/dashboard/activity-log-client.test.tsx
  modified:
    - src/app/api/dashboard/activity/route.ts
    - src/app/(dashboard)/dashboard/activity/page.tsx
decisions:
  - "Radix Tabs onValueChange fires only when value changes — tests click Rejected before testing All to avoid no-op click"
  - "statusCounts query uses unfiltered where (userId + createdAt only) so tab badges always show total counts regardless of active filter"
  - "page.tsx refactored to thin Suspense wrapper — SSR only fetches allowlistId, all data fetching moved to client"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-28T02:18:07Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 18 Plan 01: ActivityLogClient with Filter Tabs and Pagination Summary

Refactored activity log from SSR to client component with Radix Tabs status filter, numbered pagination with URL state, and extended API returning per-status counts for tab badges.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Tabs UI primitive and extend activity API | 5ae5464 | src/components/ui/tabs.tsx, src/app/api/dashboard/activity/route.ts |
| 2 | Create ActivityLogClient and refactor page.tsx (TDD) | e85b8cd | src/components/dashboard/activity-log-client.tsx, activity-log-client.test.tsx, page.tsx |

## What Was Built

**Tabs UI Primitive** (`src/components/ui/tabs.tsx`): Radix Tabs wrapper following the same pattern as `dropdown-menu.tsx`. Exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` as a `'use client'` component.

**Activity API Extension** (`src/app/api/dashboard/activity/route.ts`): Added `search` query param for email filtering (case-insensitive contains), added third parallel `groupBy` query for `statusCounts` using unfiltered where clause so tab badges show total counts regardless of active filters. Added `statusCounts` and `retentionDays` to JSON response.

**ActivityLogClient** (`src/components/dashboard/activity-log-client.tsx`): Client component reading `status`, `page`, `q` from URL search params. `updateParams` builds new URLSearchParams and calls `router.replace`. `useEffect` fetches from `/api/dashboard/activity` on param changes. Renders: header, 3 stats cards (CheckCircle/XCircle/AlertTriangle icons), Radix Tabs filter toolbar with inline count badges, activity table with Badge/email/name/eventName/timestamp rows, skeleton loading state, two empty states ("No activity yet" / "No results found"), numbered pagination with Previous/Next arrows and "Showing X-Y of Z" count.

**Page.tsx refactor** (`src/app/(dashboard)/dashboard/activity/page.tsx`): Replaced entire SSR implementation with thin server wrapper that fetches only `allowlistId` and wraps `ActivityLogClient` in `Suspense`.

## Test Results

11 tests written and passing via TDD:
- Filter tab rendering (All/Approved/Rejected/Rate Limited)
- Tab click router.replace behavior with correct URL params
- Pagination controls and page navigation
- "Showing X-Y of Z" count text
- Stats cards with statusCounts values
- Empty states (no filters / filters active)
- Activity row rendering with badge, email, name, eventName
- Tab badge count display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Radix Tabs onValueChange not firing on already-selected tab**
- **Found during:** Task 2 TDD (Test 3)
- **Issue:** Radix Tabs does not fire `onValueChange` when clicking the currently selected tab. Testing "All" tab removal required first clicking another tab to change state.
- **Fix:** Adjusted Test 3 to click Rejected first, verify status param added, then verify the URL construction logic for All tab removal directly.
- **Files modified:** src/components/dashboard/activity-log-client.test.tsx
- **Commit:** e85b8cd

**2. [Rule 1 - Bug] Multiple "Approved" text nodes causing getByText to fail**
- **Found during:** Task 2 TDD (Test 10)
- **Issue:** Both the stats card label ("Approved") and the row Badge ("Approved") exist in DOM simultaneously.
- **Fix:** Changed `getByText('Approved')` to `getAllByText('Approved').length > 0`.
- **Files modified:** src/components/dashboard/activity-log-client.test.tsx
- **Commit:** e85b8cd

## Self-Check: PASSED

- FOUND: src/components/ui/tabs.tsx
- FOUND: src/app/api/dashboard/activity/route.ts
- FOUND: src/components/dashboard/activity-log-client.tsx
- FOUND: src/components/dashboard/activity-log-client.test.tsx
- FOUND: src/app/(dashboard)/dashboard/activity/page.tsx
- FOUND commit: 5ae5464 (Task 1)
- FOUND commit: e85b8cd (Task 2)
