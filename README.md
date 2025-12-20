# tropiccove.github.io

Static GitHub Pages site starter using Bootstrap (via CDN).

## Deploy to GitHub Pages

1. Push this repo to GitHub (branch: `main`).
2. In GitHub: **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Select **Branch**: `main` and **Folder**: `/ (root)`.

## Booking (Private Online) with Supabase

The booking page (`booking.html`) uses Supabase (Auth + Postgres + RLS) for private online access.

### Setup

1. Create a Supabase project.
2. Create a table `reservations` with at least:
   - `id` (text or uuid, primary key)
   - `user_id` (uuid) default `auth.uid()`
   - `status`, `checkInDate`, `checkOutDate`, `fee`, `amount`, `source`, `guest`, `notes`, `createdAt`, `updatedAt`
3. Enable Row Level Security (RLS) and add policies so only the owner can read/write:
   - `select`: `user_id = auth.uid()`
   - `insert`: `user_id = auth.uid()`
   - `update`: `user_id = auth.uid()`
   - `delete`: `user_id = auth.uid()`
4. Set your config values in `assets/js/supabase-config.js`:
   - `TC_SUPABASE_URL`
   - `TC_SUPABASE_ANON_KEY`
   - optional `TC_SUPABASE_ALLOWED_EMAILS`

### Important

- The anon key is safe to be public; privacy is enforced by RLS policies.
