# Research Defense Scheduler

A responsive web application for research group submissions, defense scheduling, panel assignments, and public schedule viewing.

## Stack

- Next.js 16
- React 19
- Supabase Database and Auth
- Vercel deployment
- TypeScript
- Mobile-first CSS

## Current features

- Public defense schedule dashboard
- Student research submission form
- Private contact information
- Faculty directory integration
- Admin email/password login
- Initial admin dashboard with submission counts and recent submissions
- Row Level Security on Supabase tables
- Server-only research submission endpoint

## Environment variables

Copy `.env.example` to `.env.local` for local development and provide:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` must remain server-only and must never be exposed in browser code or committed to GitHub.

## Main routes

- `/` - public published defense schedule
- `/submit` - student research submission
- `/admin` - administrator login
- `/admin/dashboard` - protected administrator dashboard

## Database

The Supabase project contains:

- `admin_profiles`
- `faculty`
- `research_groups`
- `group_members`
- `defense_schedules`
- `panel_assignments`

Only published schedule information is available to unauthenticated visitors. Student contact information remains protected by RLS and is available only to authorized administrators.

## Deployment

Import this GitHub repository into Vercel, add the three environment variables, and deploy. After deployment, create the first administrator account in Supabase Auth and link that user to `admin_profiles`.

## Next development items

- Faculty management page
- Research group detail/edit page
- Defense date/time/venue assignment
- Panel assignment interface
- Schedule conflict detection
- Publish/unpublish controls
