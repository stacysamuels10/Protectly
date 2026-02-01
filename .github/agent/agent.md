# AI Agent System - Global Rules

This document defines the immutable rules that govern both the Dev Agent and QA Agent.

## Core Principles

1. **Human Control**: All code must be human-reviewed before reaching `main`
2. **Minimal Changes**: Agents make small, focused changes only
3. **Safety First**: When in doubt, skip or comment instead of coding
4. **Transparency**: All decisions must be logged and explainable

## Absolute Prohibitions

Agents must **NEVER**:

- Push directly to `main` or `qa` branches
- Merge any pull request
- Modify secrets, `.env` files, or environment configuration
- Change infrastructure files (Docker, CI/CD configs beyond agent files)
- Create or run database migrations
- Modify the Prisma schema unless explicitly instructed in the issue
- Work on more than one issue per run
- Refactor code unrelated to the current task
- Add features beyond what's specified in the issue
- Skip the test suite
- Use force push or destructive git operations

## Branching Model

```
main        ← production-ready, human-reviewed only
qa          ← AI QA-reviewed staging branch  
agent/dev/* ← dev agent working branches (PRs target qa)
agent/qa/*  ← QA agent fix branches (PRs target qa)
```

## Decision Output Format

Every agent run must output a decision in this format:

```json
{
  "decision": "implement" | "skip",
  "issueNumber": number | null,
  "confidence": number,
  "reason": "string"
}
```

## Confidence Threshold

- Agents must not implement if confidence < 0.7
- Confidence should reflect:
  - Clarity of requirements
  - Scope of changes needed
  - Risk of unintended side effects
  - Familiarity with affected code areas

## Issue Labels

| Label | Meaning |
|-------|---------|
| `agent-ok` | Issue is approved for agent work |
| `agent-hold` | Agent must skip this issue |
| `needs-design` | Requires human design decisions first |

## File Restrictions

Agents should avoid modifying:

- `prisma/schema.prisma` (unless explicitly required)
- `prisma/migrations/*` (never)
- `.env*` files (never)
- `*.yml` files in `.github/workflows/` (except agent workflows)
- `package.json` (only for adding dependencies if required)
- `next.config.js`, `tailwind.config.ts` (rarely)

## Test Requirements

- Dev Agent must run `npm run test:run` before committing
- QA Agent must run `npm run test:run` after applying fixes
- If tests fail, changes are reverted and no PR is created

## Feedback Loop

When a PR has human comments:

1. Agent reads all comments on next run
2. Agent applies only requested changes
3. Agent does not add new features
4. Agent commits with message referencing feedback

## Dry Run Mode

When `dryRun: true` in config:

- Agents log what they would do
- No branches are created
- No PRs are opened
- No comments are posted
- Use for testing and validation
