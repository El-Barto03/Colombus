# Netlify + Supabase setup

This version is a standard Next.js application. Netlify runs the API routes as server functions, and those routes use a server-only Supabase secret to store shops and uploaded logos.

## 1. Create the Supabase tables and logo bucket

1. Open your Supabase project.
2. Go to **SQL Editor** and choose **New query**.
3. Open `supabase/schema.sql`, copy all of it into the query, and click **Run**.
4. Confirm that **Table Editor** shows `shops` and `app_state`, and **Storage** shows `shop-logos`.

## 2. Copy the two Supabase values

In Supabase, open **Project Settings → API Keys** (or **Connect**) and copy:

- the project URL, such as `https://abc123.supabase.co`;
- a server-side **Secret key** beginning with `sb_secret_`.

Never put the secret key in GitHub, browser-side code, or a variable starting with `NEXT_PUBLIC_`.

## 3. Add the Netlify environment variables

In Netlify, open the connected site and go to **Project configuration → Environment variables**. Add these variables for all deploy contexts and make them available to Functions:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | Your `sb_secret_...` server key |
| `SUPABASE_LOGO_BUCKET` | `shop-logos` |

If the project only offers the older `service_role` key, save it as `SUPABASE_SERVICE_ROLE_KEY`; the code supports that fallback. Do not add both.

## 4. Confirm Netlify build settings

- Build command: `pnpm build`
- Publish directory: `.next`
- Node.js: `22.13.0`
- Base directory: blank when `package.json` is at the repository root

## 5. Deploy and test

Choose **Deploys → Trigger deploy → Deploy site**. On the first successful request, the baseline shops are seeded into an empty Supabase database. Add a temporary shop, edit it, change a tracking field, upload a small logo, delete the temporary record, and refresh on a second device.

## Important migration note

The source contains the baseline list, but not changes that exist only in the old hosted database. Those records need a separate export/import before the old site is retired.

## Security model

The secret exists only in Netlify server functions. Direct anonymous access to the tables is blocked by Row Level Security. The app's own write routes remain public because anyone with the map link is meant to collaborate.
