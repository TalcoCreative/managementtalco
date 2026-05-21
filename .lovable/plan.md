# Monthly Team Review System

A confidential, anonymous monthly peer review system for HR and Super Admin to understand team collaboration and culture. Hidden from regular users — appears as immersive fullscreen experience only during the active review window.

## Scope

### 1. Database (migration)

New tables:
- `team_review_settings` (singleton row) — `enabled` (bool), `open_day` (int 1–31), `deadline_day` (int 1–31), `require_before_clockin` (bool), `updated_at`
- `team_review_questions` — `id`, `question_text`, `order_index`, `is_active`, `created_at`
- `team_review_submissions` — `id`, `reviewer_id`, `review_month` (date, first of month), `submitted_at`, unique(`reviewer_id`, `review_month`)
- `team_review_answers` — `id`, `submission_id`, `reviewed_user_id`, `question_id`, `score` (1–5), `comment` (text, optional). **Does NOT store reviewer_id** to preserve anonymity at query level.
- `team_review_drafts` — `reviewer_id`, `review_month`, `payload` (jsonb), `updated_at`, PK(reviewer_id, review_month) — for autosave
- Add `include_in_team_review` (bool, default true) to `profiles`

RLS:
- Settings/questions: read for authenticated; write only HR/super_admin
- Submissions/answers: insert allowed when reviewer_id = auth.uid(); SELECT restricted to HR/super_admin only (anonymity)
- Drafts: only the owner can read/write their own draft
- Profiles `include_in_team_review` editable by HR/super_admin

Seed 5 default questions.

### 2. Settings page — `/system/team-review-settings`

Toggles for enable, open day, deadline day, require-before-clockin, plus questions CRUD (add/edit/delete/reorder via drag handle). Nav entry under Settings, gated by HR/super_admin.

### 3. Users/Teams page

Add "Include in Team Review" checkbox column / inline toggle for HR/super_admin.

### 4. Immersive review experience

New component `TeamReviewOverlay` mounted in `AppLayout`. Logic:
- Query settings + today's date — is review period active (open_day ≤ today ≤ deadline_day, enabled = true)?
- Query if current user has submitted for current month
- Query if current user is `include_in_team_review`
- If active + not submitted + included → render fullscreen overlay (fixed inset-0, backdrop-blur, z-[100])

Flow:
- Welcome screen → for each participant (excluding self, only included users) → question cards with 1–5 rating buttons → optional comment → next person → final summary → submit
- Smooth framer-motion transitions, rounded cards, glassmorphism, mobile-friendly
- Autosave to `team_review_drafts` on every answer change (debounced)
- Resume from draft on reload
- Cannot close (no X) if `require_before_clockin` is true; otherwise has "Skip for now" button
- ClockIn component checks settings — blocks if review pending and required

### 5. Admin dashboard — `/team-review`

Gated by HR/super_admin only (ProtectedRoute + role check; not in sidebar for others).

Tabs/sections:
- **Overview**: completion rate (X of Y submitted), pending users list, average overall score, monthly trend chart (last 6 months)
- **Per question**: average score per question, trend
- **Per user**: list of reviewed users → click → detail with monthly score trend, per-question averages, anonymous comments. Never shows reviewer identity.

### 6. Navigation

- Add `/team-review` and `/system/team-review-settings` to `nav-config.ts` under a "Culture" / Settings group, but only render via PermissionGate for HR/super_admin
- Routes in `App.tsx` wrapped in ProtectedRoute + internal role guard that redirects regular users to `/`

## Technical notes

- Anonymity enforced by schema: `team_review_answers` has no FK back to reviewer. Only `team_review_submissions` knows reviewer, and it's never joined to answers in any client query — admin dashboard only aggregates per `reviewed_user_id`.
- "Review month" = `date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')` to align with project TZ rule.
- Clockin block: extend `ClockInOut.tsx` to check pending review when `require_before_clockin` is on.
- Reuse design tokens (HSL semantic), Plus Jakarta Sans, glassmorphism per existing style memory.
- Use framer-motion (already present) for transitions.
- Drag-reorder questions via `@dnd-kit` if already installed, else simple up/down buttons.

## Files

**New**
- `supabase/migrations/...` (tables, RLS, seed)
- `src/pages/TeamReview.tsx` (admin dashboard)
- `src/pages/TeamReviewSettings.tsx`
- `src/components/team-review/TeamReviewOverlay.tsx`
- `src/components/team-review/ReviewQuestionCard.tsx`
- `src/components/team-review/QuestionsManager.tsx`
- `src/components/team-review/AdminOverview.tsx`
- `src/components/team-review/UserAnalytics.tsx`
- `src/hooks/useTeamReview.ts`

**Edited**
- `src/App.tsx` (routes)
- `src/components/layout/AppLayout.tsx` (mount overlay)
- `src/components/layout/nav-config.ts` (gated nav)
- `src/components/attendance/ClockInOut.tsx` (block when required)
- `src/pages/Users.tsx` (include toggle)

After plan approval I'll run the migration and build the UI.