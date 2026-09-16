# Public UI review and verification

Reviewed and implemented 16 September 2026.

## Existing application
Next.js App Router with React, TypeScript, CSS modules/global CSS and Supabase. The public routes are /, /schedule, /submit and /status. Admin routes, authentication, API contracts, database schema and RLS policies are unchanged.

The live baseline had small calendar text and controls, weak public navigation, hidden mobile submission step labels, inconsistent spacing and large unused landing-page space. Public research-group membership is restricted by RLS, so the redesign does not expose researcher names or broaden access.

## Changes
- Shared public shell with three persistent navigation links, active states, home branding and a skip link. Admin navigation remains separate.
- Scoped green design tokens, readable typography, visible focus, comfortable touch targets, responsive cards and forms.
- Clear landing-page actions, desktop calendar and mobile defense-date list.
- Schedule views for all, upcoming and completed defenses; readable date/time, venue and panel details; useful filter and empty states.
- Explicit completed and awaiting-update labels. Elapsed time alone never marks a scheduled defense completed. Philippine-time and overnight boundaries have regression tests.
- Four-step submission flow retains the existing payload and workflow, adds visible progress, clearer labels and validation focus, and handles network/clipboard errors.
- Improved status-code form, invalid-code feedback, loading and route-error states.
- No new dependencies. Added lockfile and typecheck/test scripts.

## Verification
- npm run typecheck: passed.
- npm test: 3 tests passed.
- npm run build: passed; Vercel review deployment ready.
- git diff --check: passed.
- This repository has no configured lint command.
- Browser layout checks on all four public pages at widths 320, 360, 390, 412, 430, 768 and 1024 px, plus desktop at 1363 px. No horizontal overflow. Visible public controls passed the 44 px target check (43 px measurement tolerance).
- Visually reviewed phone, tablet and desktop layouts, including long published research titles.
- Exercised schedule filters and empty results, invalid status-code response, submission required-field validation, conditional program fields, member add/remove and progression through review.
- A temporary responsive-review harness was used on the review branch and is excluded from production.

## Verification boundaries
No synthetic research record was submitted to the live database. Final submission success and a private, valid Research Code result were not exercised end to end. Browser checks used Chromium with responsive viewport frames; a physical iOS/Android device check remains useful. Backend schema, authentication, RLS and API handlers were not changed.
