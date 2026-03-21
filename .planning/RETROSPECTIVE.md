# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Core Infrastructure

**Shipped:** 2026-03-21
**Phases:** 4 | **Plans:** 7 | **Tests added:** 51

### What Was Built
- Sentry error monitoring with PII scrubbing, source maps, and RSC capture
- PostHog product analytics tracking 9 user events with serverless-safe flush
- Structured JSON logging (pino) replacing all 43 console.log/error calls
- Resend transactional email with 5 React Email templates
- Email notification preferences (3 per-type toggles on settings page)
- Preference-gated booking approved/rejected email notifications
- Idempotent trial expiry cron with write-first warning emails

### What Worked
- Sequential wave execution prevented next.config.js conflicts across 3 plans modifying it
- Milestone-level research (4 parallel researchers) front-loaded all package decisions — no version surprises during execution
- TDD approach caught Vite/server-only incompatibility early in Phase 7
- Single-plan phases (9 and 10) executed extremely fast with minimal overhead
- Plan checker caught missing `add_email` and `logout` PostHog events before execution

### What Was Inefficient
- Phase 7 could have been a single plan instead of 3 sequential waves — the tools are independent enough
- Research was skipped for Phase 9 (correct call) but forced for Phase 8 despite milestone research already covering Resend

### Patterns Established
- `serverExternalPackages` in next.config.js for Node.js-only packages (pino)
- `server-only` import guard + Vite alias in vitest.config.ts for server-only modules
- `flushPostHog()` helper with Promise.race timeout for serverless event capture
- `sendEmail()` wrapped in try/catch in all callers — email failures never block responses
- Write-first, email-second ordering for idempotent cron operations
- `force-dynamic` + `runtime = 'nodejs'` exports on cron routes

### Key Lessons
1. When 3+ plans modify the same config file, sequential waves prevent merge conflicts even if the plans are otherwise independent
2. Plan checker verification is worth the cost — it caught 3 issues (1 blocker) that would have required gap closure
3. `prisma db push` (not `migrate dev`) is the right approach when shadow database isn't available
4. Resend test mode (`delivered@resend.dev`) enables full email testing without domain verification

### Cost Observations
- Model mix: opus for planning, sonnet for research/execution/verification
- 7 plans across 4 phases executed in a single session
- Total milestone duration: ~45 minutes wall clock

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Tests (Total) | Tests Added |
|-----------|--------|-------|---------------|-------------|
| v0.1 Security | 6 | 13 | 86 | 86 |
| v1.0 Core Infra | 4 | 7 | 137 | 51 |

**Velocity trend:** v1.0 was faster per-phase (fewer plans per phase, well-scoped work) despite higher complexity.

**Pattern:** Infrastructure phases (logging, email) are best as 1-2 plan phases. Feature integration phases (webhook email sends, cron) are single-plan phases.
