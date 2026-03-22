# Phase 12: Onboarding & Empty States - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-21
**Phase:** 12-onboarding-empty-states
**Areas discussed:** Onboarding flow structure, Empty state design, Onboarding completion tracking

---

## Onboarding Flow Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard overlay | Modal/dialog on dashboard. 3-4 steps, progress indicator. | ✓ |
| Full-page route | /onboarding with step pages | |
| Inline dashboard cards | Checklist cards on dashboard | |

| Option | Description | Selected |
|--------|-------------|----------|
| 3 steps | Welcome, Add email, Dashboard | ✓ |
| 4 steps | Welcome, Add email, Guest mode, Tour | |
| 2 steps | Welcome+email, Done | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, skip button | "Skip for now" on each step | ✓ |
| No, must complete | Force all steps | |

---

## Empty State Design

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + text + CTA | Lucide icon, explanation, action button | ✓ |
| Illustration + text | Custom illustrations | |
| Text only | Simple paragraph | |

| Option | Description | Selected |
|--------|-------------|----------|
| Helpful and encouraging | "No emails yet — add your first..." | ✓ |
| Minimal and factual | "No entries. Add an email." | |
| You decide | Claude picks | |

---

## Completion Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Database field | Boolean onboardingCompleted on User | ✓ |
| localStorage | Client-side only | |

| Option | Description | Selected |
|--------|-------------|----------|
| No replay | One-time flow, help center for later | ✓ |
| Settings replay | Button in settings | |

## Claude's Discretion

Wizard component, step indicator, icon choices, exact copy, animations, Step 2 submit behavior.

## Deferred Ideas

None.
