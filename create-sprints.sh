#!/bin/bash

# PriCal 2026 Sprint Setup Script
# This script creates GitHub milestones and issues for the 25-sprint roadmap

# Configuration - Update these!
REPO="stacysamuels10/protectly"  # Change to your actual repo

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Creating PriCal 2026 Roadmap in GitHub...${NC}"
echo ""

# Create Labels first
echo -e "${GREEN}Creating labels...${NC}"
gh label create "tech" --description "Technical/Development work" --color "1d76db" --repo $REPO 2>/dev/null || true
gh label create "marketing" --description "Marketing tasks" --color "d93f0b" --repo $REPO 2>/dev/null || true
gh label create "content" --description "Content creation" --color "0e8a16" --repo $REPO 2>/dev/null || true
gh label create "legal" --description "Legal/Compliance" --color "5319e7" --repo $REPO 2>/dev/null || true
gh label create "ux" --description "User Experience" --color "f9d0c4" --repo $REPO 2>/dev/null || true
gh label create "product" --description "Product decisions" --color "fbca04" --repo $REPO 2>/dev/null || true
gh label create "launch" --description "Launch activities" --color "b60205" --repo $REPO 2>/dev/null || true
gh label create "support" --description "Customer support" --color "c5def5" --repo $REPO 2>/dev/null || true
gh label create "docs" --description "Documentation" --color "0075ca" --repo $REPO 2>/dev/null || true
gh label create "seo" --description "SEO work" --color "7057ff" --repo $REPO 2>/dev/null || true
gh label create "P0-critical" --description "Must have for launch" --color "b60205" --repo $REPO 2>/dev/null || true
gh label create "P1-important" --description "Should have" --color "ff9f1c" --repo $REPO 2>/dev/null || true
gh label create "P2-nice-to-have" --description "Nice to have" --color "2ec4b6" --repo $REPO 2>/dev/null || true

# ============================================================================
# PHASE 1: FOUNDATION (Sprints 1-4)
# ============================================================================

echo -e "${GREEN}Creating Sprint 1: Infrastructure & Monitoring...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 1: Infrastructure & Monitoring" -f due_on="2026-01-19T23:59:59Z" -f description="Fix critical gaps, establish infrastructure. Jan 6-19, 2026"

gh issue create --repo $REPO --title "Set up error monitoring (Sentry)" --body "## Task
Set up Sentry for production error monitoring.

## Acceptance Criteria
- [ ] Sentry account created
- [ ] Sentry SDK installed in Next.js app
- [ ] Test error captured and visible in dashboard
- [ ] Source maps uploaded for better stack traces
- [ ] Alert notifications configured

## Time Estimate
2 hours" --label "tech,P0-critical" --milestone "Sprint 1: Infrastructure & Monitoring"

gh issue create --repo $REPO --title "Set up product analytics (PostHog)" --body "## Task
Set up PostHog for user behavior analytics.

## Acceptance Criteria
- [ ] PostHog account created (free tier)
- [ ] PostHog SDK installed
- [ ] Key events tracked: signup, add_email, upgrade_click, webhook_received
- [ ] User identification working
- [ ] Dashboard created with key metrics

## Time Estimate
2 hours" --label "tech,P0-critical" --milestone "Sprint 1: Infrastructure & Monitoring"

gh issue create --repo $REPO --title "Implement trial expiration logic" --body "## Task
Handle what happens when a user's 14-day Pro trial expires.

## Acceptance Criteria
- [ ] Cron job or scheduled function to check trial expirations
- [ ] Downgrade users to FREE tier when trial ends
- [ ] Send email notification before trial expires (3 days, 1 day)
- [ ] Send email when trial has expired
- [ ] UI shows trial status and days remaining

## Technical Notes
- Consider using Vercel Cron or a simple daily check
- Update \`subscriptionTier\` to FREE and \`subscriptionStatus\` to ACTIVE

## Time Estimate
3 hours" --label "tech,P0-critical" --milestone "Sprint 1: Infrastructure & Monitoring"

gh issue create --repo $REPO --title "Audit and fix mobile responsiveness" --body "## Task
Ensure dashboard works well on mobile devices.

## Acceptance Criteria
- [ ] Test all dashboard pages on mobile (375px, 414px widths)
- [ ] Fix any layout issues
- [ ] Sidebar collapses properly on mobile
- [ ] Tables are scrollable or stack on mobile
- [ ] Forms are usable on mobile
- [ ] Test on actual device (not just dev tools)

## Time Estimate
3 hours" --label "tech,ux" --milestone "Sprint 1: Infrastructure & Monitoring"

echo -e "${GREEN}Creating Sprint 2: CSV Import Feature...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 2: CSV Import Feature" -f due_on="2026-02-02T23:59:59Z" -f description="Implement CSV import/export for allowlist. Jan 20 - Feb 2, 2026"

gh issue create --repo $REPO --title "Implement CSV import for allowlist (Pro+ feature)" --body "## Task
Build CSV import functionality for bulk adding emails to allowlist.

## Acceptance Criteria
- [ ] Upload button in allowlist page (Pro+ only)
- [ ] Parse CSV with columns: email (required), name (optional), notes (optional)
- [ ] Validate email formats
- [ ] Skip duplicates, report how many added/skipped
- [ ] Handle large files (500+ rows) without timeout
- [ ] Show progress indicator for large imports
- [ ] Error handling for malformed CSVs

## Technical Notes
- Use client-side parsing (papaparse) to reduce server load
- Batch API calls (50 at a time)
- Gate feature behind tier check

## Time Estimate
6 hours" --label "tech,P0-critical" --milestone "Sprint 2: CSV Import Feature"

gh issue create --repo $REPO --title "Add CSV export functionality" --body "## Task
Allow users to export their allowlist as CSV.

## Acceptance Criteria
- [ ] Export button in allowlist page
- [ ] Downloads CSV with columns: email, name, notes, added_date
- [ ] Works for large allowlists (2000+ entries)
- [ ] Filename includes date: prical-allowlist-2026-01-20.csv

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 2: CSV Import Feature"

gh issue create --repo $REPO --title "Add rate limiting to API endpoints" --body "## Task
Protect API endpoints from abuse with rate limiting.

## Acceptance Criteria
- [ ] Rate limit on /api/allowlists endpoints (100 req/min)
- [ ] Rate limit on /api/auth endpoints (20 req/min)
- [ ] Rate limit on /api/billing endpoints (10 req/min)
- [ ] Return 429 status with Retry-After header
- [ ] Log rate limit violations to Sentry

## Technical Notes
- Use Vercel's built-in rate limiting or upstash/ratelimit
- Consider IP-based + user-based limiting

## Time Estimate
2 hours" --label "tech,P0-critical" --milestone "Sprint 2: CSV Import Feature"

echo -e "${GREEN}Creating Sprint 3: Legal & Branding...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 3: Legal & Branding" -f due_on="2026-02-16T23:59:59Z" -f description="Legal pages and basic brand identity. Feb 3-16, 2026"

gh issue create --repo $REPO --title "Draft Privacy Policy" --body "## Task
Create a Privacy Policy page for PriCal.

## Content to Cover
- What data we collect (email, name, Calendly tokens, booking data)
- How we use the data (provide service, analytics)
- Third parties (Calendly API, Stripe, analytics)
- Data retention
- User rights (delete account, export data)
- Contact information
- CCPA/GDPR basics

## Acceptance Criteria
- [ ] Privacy policy written
- [ ] Page created at /privacy
- [ ] Linked in footer
- [ ] Last updated date shown

## Time Estimate
3 hours" --label "legal,P0-critical" --milestone "Sprint 3: Legal & Branding"

gh issue create --repo $REPO --title "Draft Terms of Service" --body "## Task
Create Terms of Service page for PriCal.

## Content to Cover
- Service description
- User responsibilities
- Acceptable use
- Payment terms
- Cancellation/refund policy
- Liability limitations
- Dispute resolution
- Changes to terms

## Acceptance Criteria
- [ ] ToS written
- [ ] Page created at /terms
- [ ] Linked in footer
- [ ] Last updated date shown

## Time Estimate
3 hours" --label "legal,P0-critical" --milestone "Sprint 3: Legal & Branding"

gh issue create --repo $REPO --title "Create simple logo and brand assets" --body "## Task
Create basic brand identity for PriCal.

## Deliverables
- [ ] Simple logo (shield + calendar concept)
- [ ] Favicon (multiple sizes)
- [ ] Social media profile image (square)
- [ ] Open Graph image (1200x630)
- [ ] Brand colors documented

## Options
- Fiverr/99designs ($50-100)
- DIY with Figma/Canva
- AI tools (Midjourney, DALL-E)

## Time Estimate
2 hours (if using existing tools/services)" --label "marketing" --milestone "Sprint 3: Legal & Branding"

gh issue create --repo $REPO --title "Add legal pages to app" --body "## Task
Integrate legal pages into the application.

## Acceptance Criteria
- [ ] /privacy route working
- [ ] /terms route working
- [ ] Footer links on all pages
- [ ] Links in signup/checkout flow
- [ ] Checkbox: 'I agree to Terms of Service' on signup (optional)

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 3: Legal & Branding"

echo -e "${GREEN}Creating Sprint 4: Onboarding & Email...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 4: Onboarding & Email" -f due_on="2026-03-02T23:59:59Z" -f description="User onboarding flow and email infrastructure. Feb 17 - Mar 2, 2026"

gh issue create --repo $REPO --title "Build user onboarding flow" --body "## Task
Create a guided setup experience for new users.

## Flow
1. Welcome screen after OAuth: 'Welcome to PriCal!'
2. Step 1: Add your first email (with explanation)
3. Step 2: Explain how protection works
4. Step 3: Show them their dashboard
5. Optional: Prompt to upgrade or continue with free

## Acceptance Criteria
- [ ] Onboarding only shows for new users (first login)
- [ ] Can be skipped
- [ ] Tracks completion in analytics
- [ ] Sets flag so it doesn't show again

## Time Estimate
5 hours" --label "tech,ux,P0-critical" --milestone "Sprint 4: Onboarding & Email"

gh issue create --repo $REPO --title "Add empty state improvements" --body "## Task
Improve the experience when users have no data yet.

## Empty States to Improve
- [ ] Dashboard: No recent activity → Explain what will appear
- [ ] Allowlist: No emails → CTA to add first email
- [ ] Activity: No attempts → Explain when this populates

## Acceptance Criteria
- [ ] Each empty state has helpful illustration/icon
- [ ] Clear explanation of what will appear
- [ ] CTA to take action where appropriate

## Time Estimate
2 hours" --label "ux" --milestone "Sprint 4: Onboarding & Email"

gh issue create --repo $REPO --title "Set up transactional email (Resend/Postmark)" --body "## Task
Set up email infrastructure for sending notifications.

## Acceptance Criteria
- [ ] Email service account created (Resend recommended - free tier)
- [ ] Email sending utility created in /lib/email.ts
- [ ] From address configured (hello@prical.io or similar)
- [ ] Test email sends successfully
- [ ] Email templates styled (simple, clean)

## Emails to Prepare For
- Welcome email
- Trial expiring (3 days)
- Trial expired
- Booking approved notification
- Booking rejected notification
- Password reset (if applicable)

## Time Estimate
3 hours" --label "tech,P0-critical" --milestone "Sprint 4: Onboarding & Email"

# ============================================================================
# PHASE 2: FEATURE COMPLETION (Sprints 5-8)
# ============================================================================

echo -e "${GREEN}Creating Sprint 5: Email Notifications...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 5: Email Notifications" -f due_on="2026-03-16T23:59:59Z" -f description="Booking notification emails. Mar 3-16, 2026"

gh issue create --repo $REPO --title "Email notification: booking approved" --body "## Task
Send email when a booking is approved.

## Email Content
- Subject: '✓ Meeting booked: [Name] - [Event Type]'
- Who booked (name, email)
- Event details (type, date/time)
- Link to activity log

## Acceptance Criteria
- [ ] Email sent immediately after webhook approves booking
- [ ] Clean, branded template
- [ ] Unsubscribe option (or link to settings)
- [ ] Works with all email clients

## Time Estimate
4 hours" --label "tech,P0-critical" --milestone "Sprint 5: Email Notifications"

gh issue create --repo $REPO --title "Email notification: booking rejected" --body "## Task
Send email when a booking is rejected/cancelled.

## Email Content
- Subject: '🛡️ Unauthorized booking cancelled: [Name]'
- Who tried to book (name, email)
- Event they tried to book
- Why rejected (not on allowlist, unapproved guest)
- Quick action: 'Add to allowlist' button

## Acceptance Criteria
- [ ] Email sent after cancellation
- [ ] 'Add to allowlist' button works (deep link to add dialog)
- [ ] Clean, branded template

## Time Estimate
4 hours" --label "tech,P0-critical" --milestone "Sprint 5: Email Notifications"

gh issue create --repo $REPO --title "User settings for email preferences" --body "## Task
Let users control which emails they receive.

## Settings
- [ ] Notify on approved bookings (default: on)
- [ ] Notify on rejected bookings (default: on)
- [ ] Weekly summary email (default: off, future feature)

## Acceptance Criteria
- [ ] Settings page has email preferences section
- [ ] Preferences saved to database
- [ ] Email sending respects preferences

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 5: Email Notifications"

echo -e "${GREEN}Creating Sprint 6: Domain Allowlisting...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 6: Domain Allowlisting" -f due_on="2026-03-30T23:59:59Z" -f description="Domain-based pattern matching. Mar 17-30, 2026"

gh issue create --repo $REPO --title "Implement domain-based allowlisting" --body "## Task
Allow users to add entire domains (e.g., *@company.com).

## Technical Approach
- Store patterns in AllowlistEntry with \`isPattern: boolean\` flag
- Pattern format: store as \`%@domain.com\` or similar
- Webhook check: first exact match, then pattern match

## Acceptance Criteria
- [ ] Can add domain pattern from UI
- [ ] Pattern validation (valid domain, has TLD)
- [ ] Webhook correctly matches domain patterns
- [ ] Domain entries shown differently in table (globe icon)
- [ ] Works with subdomains (@sub.company.com matches *@company.com)

## Time Estimate
6 hours" --label "tech,P1-important" --milestone "Sprint 6: Domain Allowlisting"

gh issue create --repo $REPO --title "Update UI for domain patterns" --body "## Task
Update the Add Email dialog to support domain patterns.

## Changes
- [ ] Toggle: 'Allow entire domain' checkbox
- [ ] When checked, input changes to domain input
- [ ] Validation changes for domain format
- [ ] Help text explaining domain patterns

## Time Estimate
2 hours" --label "tech,ux" --milestone "Sprint 6: Domain Allowlisting"

gh issue create --repo $REPO --title "Write tests for domain pattern matching" --body "## Task
Ensure domain matching logic is well-tested.

## Test Cases
- [ ] Exact email match works
- [ ] Domain pattern matches email from that domain
- [ ] Domain pattern doesn't match similar domains
- [ ] Subdomain handling (user@sub.domain.com vs *@domain.com)
- [ ] Case insensitivity
- [ ] Invalid pattern rejection

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 6: Domain Allowlisting"

echo -e "${GREEN}Creating Sprint 7: Activity Log Enhancements...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 7: Activity Log Enhancements" -f due_on="2026-04-13T23:59:59Z" -f description="Search, filter, and quick actions. Mar 31 - Apr 13, 2026"

gh issue create --repo $REPO --title "Activity log: search and filter UI" --body "## Task
Add search and filter capabilities to activity log.

## Features
- [ ] Search by email or name
- [ ] Filter by status (All/Approved/Rejected)
- [ ] Debounced search (300ms)

## Acceptance Criteria
- [ ] Filters work with pagination
- [ ] URL reflects filter state (shareable URLs)
- [ ] Clear filters button
- [ ] Empty state when no results

## Time Estimate
4 hours" --label "tech,ux" --milestone "Sprint 7: Activity Log Enhancements"

gh issue create --repo $REPO --title "Activity log: date range filter" --body "## Task
Add date range filtering to activity log.

## Features
- [ ] Start date picker
- [ ] End date picker
- [ ] Quick presets: Today, Last 7 days, Last 30 days, This month

## Acceptance Criteria
- [ ] Works with search and status filters
- [ ] Respects tier-based retention limits
- [ ] Clear date filter option

## Time Estimate
3 hours" --label "tech,ux" --milestone "Sprint 7: Activity Log Enhancements"

gh issue create --repo $REPO --title "Quick add to allowlist from rejected entries" --body "## Task
Add a button on rejected entries to quickly add that email to allowlist.

## Flow
1. User sees rejected entry in activity log
2. Clicks 'Add to allowlist' button
3. Opens AddEmailDialog pre-filled with that email
4. Submits and email is added

## Acceptance Criteria
- [ ] Button visible on rejected entries only
- [ ] Pre-fills email in dialog
- [ ] Success refreshes the page
- [ ] Works on mobile

## Time Estimate
3 hours" --label "tech,ux" --milestone "Sprint 7: Activity Log Enhancements"

echo -e "${GREEN}Creating Sprint 8: Polish & Testing...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 8: Polish & Testing" -f due_on="2026-04-27T23:59:59Z" -f description="Production quality, E2E tests. Apr 14-27, 2026"

gh issue create --repo $REPO --title "Webhook health status indicator" --body "## Task
Show users whether their calendar protection is active.

## Implementation
- Track last successful webhook received
- Show in dashboard header: '🟢 Protection Active' or '🟡 No recent activity'
- Alert if no webhooks in 7+ days: '🔴 Check your Calendly connection'

## Acceptance Criteria
- [ ] Status indicator in dashboard header
- [ ] Tooltip explaining status
- [ ] Link to troubleshooting if there's an issue

## Time Estimate
3 hours" --label "tech,ux" --milestone "Sprint 8: Polish & Testing"

gh issue create --repo $REPO --title "E2E tests: complete signup flow" --body "## Task
Write Playwright test for full signup flow.

## Test Flow
1. Visit landing page
2. Click 'Get Started'
3. (Mock) Complete Calendly OAuth
4. Verify redirected to dashboard
5. Verify allowlist exists
6. Verify welcome state shown

## Acceptance Criteria
- [ ] Test passes consistently
- [ ] Mock OAuth properly
- [ ] Cleanup test data after

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 8: Polish & Testing"

gh issue create --repo $REPO --title "E2E tests: add email to allowlist" --body "## Task
Write Playwright test for adding email to allowlist.

## Test Flow
1. (Authenticated user)
2. Navigate to allowlist page
3. Click 'Add Email'
4. Fill in email and name
5. Submit
6. Verify email appears in table
7. Refresh page, verify persisted

## Time Estimate
1 hour" --label "tech" --milestone "Sprint 8: Polish & Testing"

gh issue create --repo $REPO --title "Bug bash and polish" --body "## Task
Go through entire app and fix issues.

## Checklist
- [ ] Test all pages in Chrome, Firefox, Safari
- [ ] Test on mobile device
- [ ] Check for console errors
- [ ] Fix any visual inconsistencies
- [ ] Improve error messages
- [ ] Check loading states
- [ ] Verify all links work

## Time Estimate
2 hours" --label "tech,ux" --milestone "Sprint 8: Polish & Testing"

gh issue create --repo $REPO --title "Performance audit" --body "## Task
Ensure app loads quickly and performs well.

## Checklist
- [ ] Check Vercel Analytics for slow pages
- [ ] Run Lighthouse audit
- [ ] Optimize images (next/image)
- [ ] Check database query performance
- [ ] Add caching where beneficial
- [ ] Core Web Vitals all green

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 8: Polish & Testing"

# ============================================================================
# PHASE 3: BETA & VALIDATION (Sprints 9-12)
# ============================================================================

echo -e "${GREEN}Creating Sprint 9: Beta Launch Prep...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 9: Beta Launch Prep" -f due_on="2026-05-11T23:59:59Z" -f description="Prepare and launch beta program. Apr 28 - May 11, 2026"

gh issue create --repo $REPO --title "Create beta signup landing page" --body "## Task
Create a page to collect beta tester signups.

## Options
- /beta route in app
- Tally/Typeform embed
- Simple email capture form

## Fields to Collect
- Email
- Role (Executive/Educator/Other)
- How they use Calendly
- Company size (optional)

## Acceptance Criteria
- [ ] Page live at /beta or linked from landing
- [ ] Form submissions captured
- [ ] Auto-response email sent

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 9: Beta Launch Prep"

gh issue create --repo $REPO --title "Identify 30 potential beta users" --body "## Task
Create list of people to invite to beta.

## Sources
- Personal network
- LinkedIn connections
- Former colleagues
- Friends who use Calendly

## Spreadsheet Columns
- Name
- Email
- Relationship
- Role
- Why they'd benefit
- Contacted (Y/N)
- Response

## Target Profiles
- Executives with public Calendly
- Educators with office hours
- Coaches/consultants
- HR professionals

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 9: Beta Launch Prep"

gh issue create --repo $REPO --title "Write beta invitation email template" --body "## Task
Create template for inviting beta testers.

## Template Elements
- Personal greeting
- Why you thought of them
- What PriCal does (1-2 sentences)
- What you're asking (feedback, usage)
- How to sign up
- What they get (free access)

## Acceptance Criteria
- [ ] Template written
- [ ] Personalization placeholders marked
- [ ] Subject line options

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 9: Beta Launch Prep"

gh issue create --repo $REPO --title "Personal outreach to first 10 beta candidates" --body "## Task
Send personalized invitations to 10 people.

## Approach
- Individual emails or LinkedIn DMs
- Personalize each one
- Reference something specific about them
- Don't mass-blast

## Goal
- 10 invites sent
- 5 responses
- 3 signups

## Time Estimate
3 hours" --label "marketing" --milestone "Sprint 9: Beta Launch Prep"

gh issue create --repo $REPO --title "Prepare beta onboarding documentation" --body "## Task
Create guide for beta testers.

## Content
- How to connect Calendly
- How to add emails to allowlist
- What to expect (cancellation flow)
- How to provide feedback
- Known limitations
- Contact for support

## Format
- Google Doc or Notion page
- Link sent with beta invite

## Time Estimate
2 hours" --label "docs" --milestone "Sprint 9: Beta Launch Prep"

echo -e "${GREEN}Creating Sprint 10: Beta Onboarding...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 10: Beta Onboarding" -f due_on="2026-05-25T23:59:59Z" -f description="Onboard beta users and collect feedback. May 12-25, 2026"

gh issue create --repo $REPO --title "Onboard beta users (hands-on support)" --body "## Task
Actively help beta users get set up.

## Activities
- Offer setup calls for first 5-10 users
- Screen share if needed
- Document UX issues observed
- Answer questions immediately

## Goal
- All beta users complete setup
- Connection working for each user

## Time Estimate
3 hours" --label "support,product" --milestone "Sprint 10: Beta Onboarding"

gh issue create --repo $REPO --title "Monitor for issues during beta" --body "## Task
Actively monitor all systems during beta period.

## Daily Checks
- [ ] Sentry for new errors
- [ ] PostHog for unusual patterns
- [ ] Database for failed operations
- [ ] Email for user questions

## Time Estimate
2 hours (spread across sprint)" --label "support,tech" --milestone "Sprint 10: Beta Onboarding"

gh issue create --repo $REPO --title "Fix critical bugs from beta feedback" --body "## Task
Address any critical issues found by beta users.

## Process
- Triage incoming issues
- Fix P0 bugs within 24 hours
- Communicate fixes to affected users

## Time Estimate
3 hours (buffer for unknowns)" --label "tech" --milestone "Sprint 10: Beta Onboarding"

gh issue create --repo $REPO --title "Set up feedback collection system" --body "## Task
Create easy way for beta users to submit feedback.

## Options
- Canny.io (free tier)
- Simple Google Form
- Email to feedback@prical.io
- In-app feedback button

## Acceptance Criteria
- [ ] Feedback channel set up
- [ ] Link added to app (dashboard footer or help menu)
- [ ] Beta users informed how to submit feedback

## Time Estimate
1 hour" --label "product" --milestone "Sprint 10: Beta Onboarding"

gh issue create --repo $REPO --title "Send weekly beta update email" --body "## Task
Keep beta users engaged with weekly updates.

## Content
- What was fixed/improved this week
- What's coming next
- Request for specific feedback
- Thanks for participating

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 10: Beta Onboarding"

echo -e "${GREEN}Creating Sprint 11: Beta Iteration...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 11: Beta Iteration" -f due_on="2026-06-08T23:59:59Z" -f description="Iterate based on beta feedback. May 26 - Jun 8, 2026"

gh issue create --repo $REPO --title "Categorize and prioritize all beta feedback" --body "## Task
Organize all feedback received from beta users.

## Categories
- Bug
- UX issue
- Feature request
- Nice-to-have

## Prioritization
- Impact (how many users affected)
- Effort (how hard to fix)
- Alignment (fits product vision)

## Time Estimate
1 hour" --label "product" --milestone "Sprint 11: Beta Iteration"

gh issue create --repo $REPO --title "Implement top 2-3 feedback items" --body "## Task
Build the highest-priority improvements from feedback.

## Likely Candidates
- UX confusion fixes
- Missing small features
- Error message improvements
- Flow optimizations

## Time Estimate
5 hours" --label "tech,product" --milestone "Sprint 11: Beta Iteration"

gh issue create --repo $REPO --title "Conduct 3-5 user interviews" --body "## Task
Have deeper conversations with beta users.

## Format
- 15-20 minute calls
- Ask about their experience
- Watch them use the product (if possible)
- Ask what's working, what's frustrating

## Questions
- Walk me through how you're using PriCal
- What problem does it solve for you?
- What almost made you give up?
- What feature would make it 10x better?

## Time Estimate
3 hours (including scheduling)" --label "product" --milestone "Sprint 11: Beta Iteration"

gh issue create --repo $REPO --title "Collect testimonials and quotes" --body "## Task
Get permission to use user feedback publicly.

## Approach
- Ask happy users: 'Would you mind if I quoted you on the website?'
- Get written permission
- Capture: quote, name, role, company (if ok)

## Goal
- 3-5 usable testimonials

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 11: Beta Iteration"

echo -e "${GREEN}Creating Sprint 12: Beta Wrap-up...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 12: Beta Wrap-up" -f due_on="2026-06-22T23:59:59Z" -f description="Finalize for public launch. Jun 9-22, 2026"

gh issue create --repo $REPO --title "Create 2-3 mini case studies" --body "## Task
Write short case studies based on beta users.

## Format (each ~150 words)
- User type and context
- Problem they had
- How PriCal helped
- Quote from user

## Example
'Executive at a Fortune 500 uses PriCal to protect their calendar from sales spam'

## Time Estimate
2 hours" --label "marketing,content" --milestone "Sprint 12: Beta Wrap-up"

gh issue create --repo $REPO --title "Validate and finalize pricing" --body "## Task
Confirm pricing based on beta feedback.

## Questions to Answer
- Would users pay \$9/mo?
- Is free tier too generous?
- Does Business tier make sense?
- Any pricing feedback from users?

## Action
- Adjust if needed
- Document pricing rationale

## Time Estimate
1 hour" --label "product" --milestone "Sprint 12: Beta Wrap-up"

gh issue create --repo $REPO --title "Performance optimization pass" --body "## Task
Final performance improvements before launch.

## Areas
- [ ] Database query optimization
- [ ] Image optimization
- [ ] Caching headers
- [ ] Bundle size check
- [ ] Core Web Vitals green

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 12: Beta Wrap-up"

gh issue create --repo $REPO --title "Security audit" --body "## Task
Review security before public launch.

## Checklist
- [ ] OAuth tokens stored securely
- [ ] API endpoints protected
- [ ] No SQL injection risks
- [ ] Rate limiting working
- [ ] HTTPS enforced
- [ ] Session security (expiration, secure cookies)
- [ ] No sensitive data in logs

## Time Estimate
2 hours" --label "tech,P0-critical" --milestone "Sprint 12: Beta Wrap-up"

gh issue create --repo $REPO --title "Update landing page with social proof" --body "## Task
Add testimonials and credibility to landing page.

## Additions
- [ ] Testimonial section (3 quotes with photos/initials)
- [ ] 'Trusted by X professionals' counter
- [ ] Case study snippets or links
- [ ] 'As seen on' badges (if submitted to directories)

## Time Estimate
2 hours" --label "marketing,tech" --milestone "Sprint 12: Beta Wrap-up"

gh issue create --repo $REPO --title "Beta graduation email" --body "## Task
Email beta users about transition to public launch.

## Content
- Thank you for being a beta tester
- What's changing (nothing for them)
- Special offer for beta users (extended free Pro, discount, etc.)
- Ask to share with others
- Invite to stay in touch

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 12: Beta Wrap-up"

# ============================================================================
# PHASE 4: CONTENT & SEO (Sprints 13-18)
# ============================================================================

echo -e "${GREEN}Creating Sprint 13: Content Foundation...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 13: Content Foundation" -f due_on="2026-07-06T23:59:59Z" -f description="Blog setup and first post. Jun 23 - Jul 6, 2026"

gh issue create --repo $REPO --title "Set up blog infrastructure" --body "## Task
Create a blog for content marketing.

## Options (Pick One)
1. MDX in Next.js (/blog route)
2. Hashnode (free, faster setup)
3. Ghost (self-hosted or paid)
4. Notion + Super.so

## Recommendation
Hashnode for speed, can migrate later if needed.

## Acceptance Criteria
- [ ] Blog accessible at blog.prical.io or prical.io/blog
- [ ] Clean design matching main site
- [ ] RSS feed available
- [ ] SEO metadata working

## Time Estimate
2 hours" --label "marketing,tech" --milestone "Sprint 13: Content Foundation"

gh issue create --repo $REPO --title "Conduct keyword research" --body "## Task
Identify SEO target keywords.

## Tools
- Ubersuggest (free)
- Google Keyword Planner
- AnswerThePublic

## Target Keywords
- calendly spam
- protect calendly link
- calendly unwanted bookings
- calendly for executives
- calendar protection
- stop random calendly bookings

## Deliverable
Spreadsheet with: keyword, volume, difficulty, target page

## Time Estimate
2 hours" --label "seo,marketing" --milestone "Sprint 13: Content Foundation"

gh issue create --repo $REPO --title "Write Blog Post #1: Why Executives Hesitate to Use Calendly" --body "## Blog Post
Title: 'Why Executives Are Hesitant to Use Calendly (And How to Fix It)'

## Outline
1. The Problem - Calendly is great, but public links are risky
2. The Hidden Cost - Time wasted, calendar chaos
3. The Solution - Calendar protection concept
4. How PriCal Works - Brief intro
5. CTA - Try it free

## SEO Target
'calendly for executives', 'executive calendar protection'

## Time Estimate
4 hours" --label "content" --milestone "Sprint 13: Content Foundation"

gh issue create --repo $REPO --title "Set up help center" --body "## Task
Create basic help/FAQ documentation.

## Content
- Getting started guide
- How to connect Calendly
- How to add emails
- Pricing FAQ
- Troubleshooting common issues

## Format
- Simple FAQ page in app
- Or Notion public page
- Or Intercom articles (if using Intercom)

## Time Estimate
1 hour" --label "docs" --milestone "Sprint 13: Content Foundation"

echo -e "${GREEN}Creating Sprint 14: SEO Content Push...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 14: SEO Content Push" -f due_on="2026-07-20T23:59:59Z" -f description="SEO-focused content and directory submissions. Jul 7-20, 2026"

gh issue create --repo $REPO --title "Write Blog Post #2: How to Stop Unwanted Calendly Bookings" --body "## Blog Post
Title: 'How to Stop Unwanted Calendly Bookings in 2026'

## Outline
1. The problem is growing
2. Method 1: Manual review (time-consuming)
3. Method 2: Calendly built-in options (limited)
4. Method 3: Zapier automation (complex)
5. Method 4: PriCal (recommended)
6. Comparison table
7. Conclusion

## SEO Target
'stop calendly spam', 'unwanted calendly bookings'

## Time Estimate
4 hours" --label "content,seo" --milestone "Sprint 14: SEO Content Push"

gh issue create --repo $REPO --title "Create comparison landing page" --body "## Task
Create /compare or /vs-manual page.

## Content
PriCal vs Managing Calendly Manually
- Comparison table
- Time savings calculator (optional)
- CTA to try PriCal

## Time Estimate
2 hours" --label "marketing,tech" --milestone "Sprint 14: SEO Content Push"

gh issue create --repo $REPO --title "Submit to startup directories" --body "## Task
Submit PriCal to free startup directories.

## Directories
- [ ] BetaList (free, slow queue)
- [ ] Product Hunt Ship (free)
- [ ] SaaSHub
- [ ] AlternativeTo
- [ ] StartupBase
- [ ] Launching Next
- [ ] All Startups Info

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 14: SEO Content Push"

gh issue create --repo $REPO --title "Set up internal linking and social sharing" --body "## Task
Optimize blog for SEO and sharing.

## Tasks
- [ ] Link blog posts to each other
- [ ] Link to product pages
- [ ] Add blog link to main nav
- [ ] Add Open Graph images
- [ ] Test Twitter cards

## Time Estimate
1 hour" --label "seo,tech" --milestone "Sprint 14: SEO Content Push"

echo -e "${GREEN}Creating Sprint 15: Vertical Content & Social...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 15: Vertical Content & Social" -f due_on="2026-08-03T23:59:59Z" -f description="Educator content and LinkedIn presence. Jul 21 - Aug 3, 2026"

gh issue create --repo $REPO --title "Write Blog Post #3: Calendar Management for Educators" --body "## Blog Post
Title: 'Calendar Management Tips for Educators: Protecting Office Hours'

## Outline
1. The educator's scheduling challenge
2. Common problems with public Calendly links
3. Semester-based access needs
4. How to limit to current students
5. PriCal for educators
6. CTA

## SEO Target
'calendly for teachers', 'office hours scheduling'

## Time Estimate
4 hours" --label "content" --milestone "Sprint 15: Vertical Content & Social"

gh issue create --repo $REPO --title "Create LinkedIn content calendar" --body "## Task
Plan 4 weeks of LinkedIn content.

## Post Types (2x/week)
1. Problem awareness posts
2. Behind-the-scenes/building
3. Tips and value posts
4. Social proof/testimonials

## Deliverable
8 posts drafted and scheduled (Buffer or native)

## Time Estimate
3 hours" --label "marketing" --milestone "Sprint 15: Vertical Content & Social"

gh issue create --repo $REPO --title "Set up LinkedIn personal brand" --body "## Task
Optimize LinkedIn profile for PriCal credibility.

## Updates
- [ ] Headline mentions building PriCal
- [ ] Banner image with product visual
- [ ] Featured section with product link
- [ ] About section mentions the problem you're solving

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 15: Vertical Content & Social"

gh issue create --repo $REPO --title "Improve landing page copy" --body "## Task
Refine landing page based on learnings.

## Improvements
- [ ] A/B test headlines
- [ ] Add specific use cases
- [ ] Improve CTA button text
- [ ] Add directory badges if listed

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 15: Vertical Content & Social"

echo -e "${GREEN}Creating Sprint 16: Product Hunt Prep...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 16: Product Hunt Prep" -f due_on="2026-08-17T23:59:59Z" -f description="PH preparation and testimonials. Aug 4-17, 2026"

gh issue create --repo $REPO --title "Write Blog Post #4: Calendly Privacy Settings Guide" --body "## Blog Post
Title: 'The Complete Guide to Calendly Privacy Settings (And Their Limits)'

## Outline
1. Calendly's built-in privacy features
2. What each setting does
3. Limitations of native settings
4. When you need additional protection
5. PriCal as complement to Calendly
6. CTA

## SEO Target
'calendly privacy settings', 'calendly security'

## Time Estimate
3 hours" --label "content,seo" --milestone "Sprint 16: Product Hunt Prep"

gh issue create --repo $REPO --title "Create Product Hunt page (Ship mode)" --body "## Task
Set up Product Hunt page without launching.

## Content
- [ ] Tagline (60 chars): 'Automatic calendar protection for Calendly'
- [ ] Description (problem, solution, how it works)
- [ ] 3-5 screenshots
- [ ] Product GIF
- [ ] Maker profile linked

## Status
Ship mode (collect followers, don't launch yet)

## Time Estimate
2 hours" --label "marketing,launch" --milestone "Sprint 16: Product Hunt Prep"

gh issue create --repo $REPO --title "Build Product Hunt launch email list" --body "## Task
Collect emails specifically for PH launch notification.

## Method
- Add 'Notify me of launch' on landing page
- Separate from main email list
- GDPR-compliant

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 16: Product Hunt Prep"

gh issue create --repo $REPO --title "Collect more testimonials for launch" --body "## Task
Get more social proof before launch.

## Approach
- Email all beta users asking for quotes
- Offer something in return (extended Pro, swag, credit)
- Get permission for name/role/photo

## Goal
5+ testimonials ready for landing page and PH

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 16: Product Hunt Prep"

gh issue create --repo $REPO --title "Add testimonials to landing page" --body "## Task
Design and add testimonial section.

## Design
- Photo or initials avatar
- Quote (1-2 sentences)
- Name, Role, Company

## Placement
Below hero or above pricing

## Time Estimate
2 hours" --label "marketing,tech" --milestone "Sprint 16: Product Hunt Prep"

echo -e "${GREEN}Creating Sprint 17: Demo & Conversion...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 17: Demo & Conversion" -f due_on="2026-08-31T23:59:59Z" -f description="Demo video and conversion optimization. Aug 18-31, 2026"

gh issue create --repo $REPO --title "Create product demo video" --body "## Task
Record a 3-minute demo video.

## Script Structure
0:00-0:30 - The problem
0:30-1:00 - The solution (PriCal intro)
1:00-2:30 - Walkthrough (signup, add email, show protection)
2:30-2:45 - CTA

## Tools
- Loom (free, easy)
- Screen recording + voiceover
- Simple editing

## Deliverable
- Embed on landing page above fold
- Upload to YouTube (unlisted or public)

## Time Estimate
3 hours" --label "marketing" --milestone "Sprint 17: Demo & Conversion"

gh issue create --repo $REPO --title "Write Blog Post #5: Customer Success Use Case" --body "## Blog Post
Title: 'How Customer Success Teams Use Calendar Protection'

## Outline
1. CS teams share scheduling links with customers
2. Problem: customers keep using old links
3. How calendar protection helps
4. Use case example
5. CTA

## Time Estimate
3 hours" --label "content" --milestone "Sprint 17: Demo & Conversion"

gh issue create --repo $REPO --title "Optimize landing page for conversions" --body "## Task
Improve landing page conversion rate.

## Improvements
- [ ] Add demo video above fold
- [ ] Improve headline based on A/B tests
- [ ] Add urgency ('14-day free trial')
- [ ] Add FAQ section
- [ ] Improve mobile layout
- [ ] Add trust badges

## Time Estimate
2 hours" --label "marketing,tech" --milestone "Sprint 17: Demo & Conversion"

gh issue create --repo $REPO --title "A/B test CTA buttons" --body "## Task
Test different CTA copy.

## Variants
A: 'Get Started Free'
B: 'Start Free Trial'
C: 'Protect Your Calendar'

## Tools
- Vercel's edge config
- Or simple cookie-based split

## Time Estimate
1 hour" --label "marketing,tech" --milestone "Sprint 17: Demo & Conversion"

echo -e "${GREEN}Creating Sprint 18: Final Launch Prep...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 18: Final Launch Prep" -f due_on="2026-09-14T23:59:59Z" -f description="Everything ready for launch. Sep 1-14, 2026"

gh issue create --repo $REPO --title "Write Blog Post #6: HR and Interview Scheduling" --body "## Blog Post
Title: 'Why HR Teams Need Calendar Protection for Interviews'

## Outline
1. HR uses Calendly for candidate scheduling
2. Problem: old candidates keep booking
3. Interview-specific allowlisting
4. PriCal for HR use case
5. CTA

## Time Estimate
3 hours" --label "content" --milestone "Sprint 18: Final Launch Prep"

gh issue create --repo $REPO --title "Prepare all launch assets" --body "## Task
Finalize all assets for launch day.

## Checklist
- [ ] 5 high-quality screenshots (fresh data)
- [ ] Product demo GIF (15-20 seconds)
- [ ] Demo video embedded
- [ ] Twitter announcement image
- [ ] LinkedIn announcement image
- [ ] Email announcement draft
- [ ] Product Hunt page finalized

## Time Estimate
2 hours" --label "marketing,launch" --milestone "Sprint 18: Final Launch Prep"

gh issue create --repo $REPO --title "Line up Product Hunt support" --body "## Task
Prepare people to support PH launch.

## Actions
- [ ] Email beta users about upcoming launch, ask them to upvote
- [ ] DM friends/colleagues
- [ ] Prepare announcement for LinkedIn/Twitter
- [ ] Don't ask for fake engagement, just awareness

## Time Estimate
2 hours" --label "marketing,launch" --milestone "Sprint 18: Final Launch Prep"

gh issue create --repo $REPO --title "Final end-to-end testing" --body "## Task
Complete system test before launch.

## Test Flow
1. New user signup (incognito)
2. Connect Calendly
3. Add email to allowlist
4. Verify webhook received
5. Test booking rejection (if possible)
6. Upgrade to paid plan
7. Verify Stripe checkout works
8. Test cancellation flow

## Time Estimate
2 hours" --label "tech" --milestone "Sprint 18: Final Launch Prep"

gh issue create --repo $REPO --title "Pre-launch checklist review" --body "## Task
Final go/no-go checklist.

## Checklist
- [ ] All P0 bugs fixed
- [ ] Production stable for 2+ weeks
- [ ] Stripe webhooks tested in prod
- [ ] Calendly webhooks verified
- [ ] Sentry active and clean
- [ ] Analytics collecting data
- [ ] SSL valid
- [ ] Support email monitored
- [ ] Landing page <3s load

## Time Estimate
1 hour" --label "launch" --milestone "Sprint 18: Final Launch Prep"

# ============================================================================
# PHASE 5: LAUNCH & GROWTH (Sprints 19-25)
# ============================================================================

echo -e "${GREEN}Creating Sprint 19: Soft Public Launch...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 19: Soft Public Launch" -f due_on="2026-09-28T23:59:59Z" -f description="Go public (not PH yet). Sep 15-28, 2026"

gh issue create --repo $REPO --title "Remove beta gates and go public" --body "## Task
Make PriCal publicly available.

## Actions
- [ ] Remove 'beta' badges from UI
- [ ] Update copy to remove beta language
- [ ] Ensure anyone can sign up
- [ ] Remove any waitlist/approval gates

## Time Estimate
1 hour" --label "launch" --milestone "Sprint 19: Soft Public Launch"

gh issue create --repo $REPO --title "Soft launch announcement (LinkedIn)" --body "## Task
Announce on personal channels (not PH yet).

## Content
Personal story about building PriCal, what it does, invite to try it.

## Channels
- [ ] LinkedIn post
- [ ] Twitter/X
- [ ] Any other personal channels

## Time Estimate
2 hours" --label "marketing,launch" --milestone "Sprint 19: Soft Public Launch"

gh issue create --repo $REPO --title "Email beta users about public launch" --body "## Task
Let beta users know about public launch.

## Content
- Thank you for being early
- What's new since beta
- Special offer (3 months free Pro, etc.)
- Ask them to share

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 19: Soft Public Launch"

gh issue create --repo $REPO --title "Monitor closely for launch issues" --body "## Task
Intensive monitoring for first week of public access.

## Daily Checks
- [ ] Sentry (every few hours)
- [ ] PostHog for anomalies
- [ ] Database health
- [ ] Stripe webhooks
- [ ] Calendly webhook status
- [ ] User support emails

## Time Estimate
4 hours (spread across 2 weeks)" --label "tech,support" --milestone "Sprint 19: Soft Public Launch"

gh issue create --repo $REPO --title "Personal welcome emails to all new signups" --body "## Task
Send personal email to every new signup.

## Template
'Thanks for trying PriCal! I'm [name], the founder. Let me know if you have any questions - I read every email.'

## Goal
Build relationships, gather feedback, demonstrate founder presence

## Time Estimate
2 hours" --label "support,marketing" --milestone "Sprint 19: Soft Public Launch"

echo -e "${GREEN}Creating Sprint 20: Product Hunt Launch...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 20: Product Hunt Launch 🚀" -f due_on="2026-10-12T23:59:59Z" -f description="THE BIG LAUNCH! Sep 29 - Oct 12, 2026"

gh issue create --repo $REPO --title "🚀 LAUNCH: Product Hunt launch day" --body "## LAUNCH DAY

### Timeline (PT)
- 12:01 AM: Launch goes live
- 6:00 AM: Wake up, check status, post maker comment
- 7:00 AM: Share on LinkedIn and Twitter
- 8:00 AM: Email launch list
- 9 AM - 6 PM: Engage with all comments
- 11:59 PM: Voting ends

### Maker Comment (Draft)
Ready in Product Hunt page.

### Goal
- Top 10 daily rank
- 100+ upvotes
- 20+ comments

## Time Estimate
8 hours (launch day is intensive)" --label "launch,P0-critical" --milestone "Sprint 20: Product Hunt Launch 🚀"

gh issue create --repo $REPO --title "Engage with Product Hunt community" --body "## Task
Respond to every comment on launch day.

## Guidelines
- Respond within minutes
- Be genuine and helpful
- Answer questions thoroughly
- Thank everyone
- Don't be defensive about criticism

## Time Estimate
4 hours" --label "launch" --milestone "Sprint 20: Product Hunt Launch 🚀"

gh issue create --repo $REPO --title "Cross-channel launch promotion" --body "## Task
Amplify PH launch across all channels.

## Actions
- [ ] Email entire list with PH link
- [ ] LinkedIn post with PH link
- [ ] Twitter thread
- [ ] DM key supporters
- [ ] Any relevant communities (where appropriate)

## Time Estimate
1 hour" --label "marketing,launch" --milestone "Sprint 20: Product Hunt Launch 🚀"

gh issue create --repo $REPO --title "Write launch blog post" --body "## Task
Publish a 'We launched!' blog post.

## Content
- What we built
- Why we built it
- Link to Product Hunt
- Thanks to supporters
- What's next

## Time Estimate
2 hours" --label "content,launch" --milestone "Sprint 20: Product Hunt Launch 🚀"

gh issue create --repo $REPO --title "Handle launch traffic and signups" --body "## Task
Be ready for traffic spike.

## Actions
- [ ] Monitor server performance
- [ ] Watch for errors
- [ ] Respond to support requests quickly
- [ ] Fix critical issues immediately
- [ ] Document any problems for post-launch

## Time Estimate
2 hours" --label "tech,support" --milestone "Sprint 20: Product Hunt Launch 🚀"

echo -e "${GREEN}Creating Sprint 21: Post-Launch Momentum...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 21: Post-Launch Momentum" -f due_on="2026-10-26T23:59:59Z" -f description="Capitalize on launch energy. Oct 13-26, 2026"

gh issue create --repo $REPO --title "Product Hunt retrospective" --body "## Task
Document learnings from PH launch.

## Questions
- Final rank?
- Total upvotes?
- Comments and sentiment?
- Signups from PH?
- What worked?
- What would you do differently?

## Time Estimate
1 hour" --label "product" --milestone "Sprint 21: Post-Launch Momentum"

gh issue create --repo $REPO --title "Submit to review sites" --body "## Task
Get listed on software review sites.

## Sites
- [ ] G2 (priority)
- [ ] Capterra (priority)
- [ ] GetApp
- [ ] Software Advice
- [ ] TrustRadius

## Time Estimate
3 hours" --label "marketing" --milestone "Sprint 21: Post-Launch Momentum"

gh issue create --repo $REPO --title "Engage Calendly communities" --body "## Task
Find and engage in Calendly-related communities.

## Places
- [ ] r/calendly (Reddit)
- [ ] r/productivity
- [ ] Calendly Facebook groups
- [ ] LinkedIn groups

## Approach
Add value first, mention PriCal naturally when relevant. Don't spam.

## Time Estimate
3 hours" --label "marketing" --milestone "Sprint 21: Post-Launch Momentum"

gh issue create --repo $REPO --title "Fix issues surfaced during launch" --body "## Task
Address any bugs or issues from launch traffic.

## Time Estimate
2 hours (buffer for unknowns)" --label "tech" --milestone "Sprint 21: Post-Launch Momentum"

gh issue create --repo $REPO --title "Write 'What we learned' blog post" --body "## Task
Transparent post about launch experience.

## Content
- Numbers (signups, conversion, PH rank)
- Surprises
- Mistakes
- What's next

## SEO Benefit
'Indie hacker', 'startup launch' keywords

## Time Estimate
2 hours" --label "content" --milestone "Sprint 21: Post-Launch Momentum"

echo -e "${GREEN}Creating Sprint 22: Outbound & Partnerships...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 22: Outbound & Partnerships" -f due_on="2026-11-09T23:59:59Z" -f description="Active outreach to prospects. Oct 27 - Nov 9, 2026"

gh issue create --repo $REPO --title "Set up LinkedIn Sales Navigator" --body "## Task
Start LinkedIn Sales Navigator trial for outreach.

## Cost
~\$100 for 1 month

## Use For
- Find executives with Calendly in profile
- Find educators
- Find coaches/consultants

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 22: Outbound & Partnerships"

gh issue create --repo $REPO --title "Build target prospect list (100 people)" --body "## Task
Create list of ideal prospects for outreach.

## Criteria
- Has Calendly (check LinkedIn, website)
- Role: Executive, Educator, Coach, HR
- Active on LinkedIn

## Spreadsheet Columns
Name, Company, Role, LinkedIn, Template Used, Sent Date, Response

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 22: Outbound & Partnerships"

gh issue create --repo $REPO --title "Write LinkedIn outreach templates" --body "## Task
Create 3 message templates to test.

## Template Types
A: Problem-focused (ask if they experience the problem)
B: Social proof (quote from existing user)
C: Direct (do you use Calendly? built something for you)

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 22: Outbound & Partnerships"

gh issue create --repo $REPO --title "Send 100 personalized LinkedIn messages" --body "## Task
Outreach campaign to target prospects.

## Pace
10-15 per day over 1-2 weeks

## Goal
- 10% response rate (10 responses)
- 5% trial signup (5 new trials)

## Time Estimate
4 hours (spread across sprint)" --label "marketing" --milestone "Sprint 22: Outbound & Partnerships"

gh issue create --repo $REPO --title "Write Blog Post #7: Based on common questions" --body "## Task
Write content based on questions you're receiving.

## Possible Topics
- FAQ-style post
- Deep dive on a feature
- Comparison with alternatives

## Time Estimate
2 hours" --label "content" --milestone "Sprint 22: Outbound & Partnerships"

echo -e "${GREEN}Creating Sprint 23: Influencer Partnerships...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 23: Influencer Partnerships" -f due_on="2026-11-23T23:59:59Z" -f description="Partner with micro-influencers. Nov 10-23, 2026"

gh issue create --repo $REPO --title "Identify 10 potential influencer partners" --body "## Task
Research micro-influencers who might promote PriCal.

## Profiles
- Productivity YouTubers (10K-100K subs)
- LinkedIn creators
- Newsletter writers
- Podcasters

## Research Each
- Audience size
- Engagement rate
- Previous sponsorships
- Contact method

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 23: Influencer Partnerships"

gh issue create --repo $REPO --title "Shortlist 5 best influencer candidates" --body "## Task
Narrow down to best fits.

## Criteria
- Audience matches our ICP
- Reasonable engagement
- Seems authentic (not just ads)
- Affordable (\$100-200 range)

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 23: Influencer Partnerships"

gh issue create --repo $REPO --title "Reach out to 5 influencers" --body "## Task
Contact top 5 influencer candidates.

## Offer Options
- Affiliate partnership (30% recurring)
- Sponsored post (\$100-200)
- Free lifetime Pro + honest review
- Newsletter mention

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 23: Influencer Partnerships"

gh issue create --repo $REPO --title "Negotiate 2-3 influencer deals" --body "## Task
Finalize agreements with interested influencers.

## Details to Agree
- Content type and placement
- Timing
- Compensation
- Tracking (referral code or UTM)

## Budget
\$400 total across 2-3 partners

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 23: Influencer Partnerships"

gh issue create --repo $REPO --title "Continue LinkedIn outreach" --body "## Task
Keep momentum from Sprint 22.

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 23: Influencer Partnerships"

gh issue create --repo $REPO --title "Analyze conversion data" --body "## Task
Understand what's working.

## Questions
- Where are paying customers coming from?
- What's the conversion rate by source?
- Which content is driving traffic?

## Action
Double down on what works.

## Time Estimate
1 hour" --label "product" --milestone "Sprint 23: Influencer Partnerships"

echo -e "${GREEN}Creating Sprint 24: Promotion Push...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 24: Promotion Push" -f due_on="2026-12-07T23:59:59Z" -f description="Black Friday and influencer content. Nov 24 - Dec 7, 2026"

gh issue create --repo $REPO --title "Plan and launch Black Friday promotion" --body "## Task
Run a Black Friday/Cyber Monday promotion.

## Options
A: 30% off annual (Nov 24 - Dec 2)
B: Extended trial (30 days instead of 14)
C: Free months ('3 months free on annual')

## Execution
- [ ] Landing page banner
- [ ] Email to list
- [ ] Social posts
- [ ] Update pricing page temporarily

## Time Estimate
2 hours" --label "marketing" --milestone "Sprint 24: Promotion Push"

gh issue create --repo $REPO --title "Coordinate influencer campaign launch" --body "## Task
Get influencer content live.

## Actions
- [ ] Confirm timing with partners
- [ ] Provide any assets they need
- [ ] Set up tracking codes/UTMs
- [ ] Monitor traffic from their content

## Time Estimate
1 hour" --label "marketing" --milestone "Sprint 24: Promotion Push"

gh issue create --repo $REPO --title "Track and optimize conversions" --body "## Task
Monitor performance of all channels.

## Metrics
- Signups by source
- Trial to paid conversion
- Promo code usage
- Influencer referrals

## Time Estimate
2 hours" --label "marketing,product" --milestone "Sprint 24: Promotion Push"

gh issue create --repo $REPO --title "Write year-end content" --body "## Task
Create relevant year-end content.

## Ideas
- 'Productivity Tools for 2027'
- 'New Year Calendar Reset Guide'
- 'Protect Your Calendar in the New Year'

## Time Estimate
3 hours" --label "content" --milestone "Sprint 24: Promotion Push"

gh issue create --repo $REPO --title "Handle increased support volume" --body "## Task
Be ready for more users from promotions.

## Actions
- Monitor support channels closely
- Quick response times
- Fix any issues immediately

## Time Estimate
2 hours" --label "support" --milestone "Sprint 24: Promotion Push"

echo -e "${GREEN}Creating Sprint 25: Year-End Reflection...${NC}"
gh api repos/$REPO/milestones -f title="Sprint 25: Year-End & 2027 Planning 🎯" -f due_on="2026-12-21T23:59:59Z" -f description="Celebrate and plan next year! Dec 8-21, 2026"

gh issue create --repo $REPO --title "Full 2026 metrics analysis" --body "## Task
Compile all metrics from the year.

## Metrics Dashboard
- Total signups
- Active users
- Paying customers
- MRR
- Churn rate
- Trial conversion rate
- Top traffic sources
- Content performance

## Time Estimate
3 hours" --label "product" --milestone "Sprint 25: Year-End & 2027 Planning 🎯"

gh issue create --repo $REPO --title "Synthesize all user feedback" --body "## Task
Review everything learned from users.

## Questions
- What do users love most?
- What's the #1 feature request?
- What almost made users quit?
- What patterns do you see?

## Time Estimate
2 hours" --label "product" --milestone "Sprint 25: Year-End & 2027 Planning 🎯"

gh issue create --repo $REPO --title "Write year-in-review blog post" --body "## Task
Transparent recap of 2026.

## Content
- What we built
- Numbers (if comfortable sharing)
- Surprises and learnings
- Thanks to users
- What's coming in 2027

## Time Estimate
2 hours" --label "content" --milestone "Sprint 25: Year-End & 2027 Planning 🎯"

gh issue create --repo $REPO --title "Plan 2027 roadmap" --body "## Task
Based on everything learned, plan next year.

## Considerations
- Feature requests to prioritize
- New verticals to target
- Team features (if demand)
- Marketing channels to expand
- Potential integrations

## Time Estimate
2 hours" --label "product" --milestone "Sprint 25: Year-End & 2027 Planning 🎯"

gh issue create --repo $REPO --title "🎉 Celebrate the year!" --body "## Task
You did it! Take time to appreciate what you built.

## Suggestions
- Nice dinner
- Tell friends/family about the journey
- Write a personal reflection
- Take a few days off

## Time Estimate
Priceless 🎉" --label "P0-critical" --milestone "Sprint 25: Year-End & 2027 Planning 🎯"

echo ""
echo -e "${GREEN}✅ Done! Created all 25 sprints with issues.${NC}"
echo ""
echo "Next steps:"
echo "1. Visit https://github.com/$REPO/milestones to see your sprints"
echo "2. Visit https://github.com/$REPO/issues to see all issues"
echo "3. Consider creating a GitHub Project board for visual tracking"
echo ""
echo "Good luck with PriCal! 🚀"