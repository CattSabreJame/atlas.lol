# Atlas

Atlas is a premium dark bio/link hub built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, Supabase, and Groq.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (Auth + Postgres + Storage)
- Groq API (server-side AI helper route)

## Features

- Email/password auth + magic link auth
- Claim and manage unique `@handle`
- Public profile at `/{handle}`
- Profile editor (`/editor`) for:
  - links
  - templates
  - layouts
  - color accent
  - link style, avatar shape, hero alignment
  - custom background modes (theme / gradient / image)
  - profile animations
  - badges (owner/admin/staff/verified/pro/founder)
  - rich text
  - music API search + embed URL helper (Spotify/YouTube/SoundCloud/Apple)
  - basic link/music URL allowlist (YouTube, SoundCloud, Spotify, Discord + approved music storage)
  - live preview
  - comments moderation
- Link reorder + CRUD
- Analytics dashboard (`/dashboard`) for views and clicks
- Settings page (`/settings`) with handle change rules + logout
- Admin badge panel (`/admin`) with DB-enforced admin authorization
- Admin console (`/admin`) with profile moderation + admin role management
- AI Assist panel:
  - Bio Generator (3 options)
  - Link Label Helper
  - Bio Polish (minimal + expressive variants)
- Premium gating enforced for AI Assist and Cursor Studio (Pro badge required)
- Public legal/docs pages (`/docs`, `/tos`, `/privacy`)
- Safe AI behavior with rate limiting and fallback mode

## Supabase Setup

1. Create a Supabase project.
2. Run all migrations in `supabase/migrations` in ascending filename order.
3. Make sure the latest production migrations are applied:
   - `supabase/migrations/202602140005_premium_feature_gates.sql`
   - `supabase/migrations/202602140006_ai_pro_and_entry_fonts.sql`
4. In Supabase Auth settings, add redirect URLs:
   - `https://joinatlas.dev/auth/callback`
5. Confirm the migration created:
  - Tables: `profiles`, `links`, `analytics_daily`, `music_tracks`, `widgets` (writes disabled), `comments`, `admin_users`
   - Storage buckets: `avatars`, `cursors`, `profile-backgrounds`, `profile-fonts`, `link-icons`
   - RLS policies + tracking functions

### Bootstrap First Admin

After migrations, add your first admin user ID:

```sql
insert into public.admin_users (user_id)
values ('YOUR_AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

Then use `/admin` to assign or remove profile badges.

## Environment Variables

Create `.env.local` using `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=https://joinatlas.dev/
SITE_URL=https://joinatlas.dev/
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
DISCORD_CLIENT_ID=your_discord_oauth_client_id
DISCORD_CLIENT_SECRET=your_discord_oauth_client_secret
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_PRESENCE_GUILD_ID=your_discord_guild_id
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME=Atlas
NEXT_PUBLIC_DISCORD_APPEAL_URL=https://discord.gg/your-server
NEXT_PUBLIC_DISCORD_PREMIUM_TICKET_URL=https://discord.gg/your-server
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is used server-side for tracking routes only.
- If `GROQ_API_KEY` is missing, AI features switch to local fallback templates and show `AI not configured`.
- `NEXT_PUBLIC_DISCORD_PREMIUM_TICKET_URL` is used for premium upgrade CTAs.
- Signup, magic link, and password reset emails are sent through `/api/auth/email` using your SMTP settings.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is optional. If provided, Google Analytics tracking will be enabled site-wide.

## Run Locally

```bash
npm install
npm run dev
```

Open `https://joinatlas.dev/`.

## Key Routes

- Public:
  - `/`
  - `/about`
  - `/docs`
  - `/tos`
  - `/privacy`
  - `/{handle}`
- Auth:
  - `/auth`
  - `/auth/callback`
  - `/auth/update-password`
- Protected:
  - `/dashboard`
  - `/editor`
  - `/settings`
  - `/admin`
- API:
  - `POST /api/auth/email`
  - `GET /api/music/search?q=`
  - `GET /api/admin/profile?handle=`
  - `POST /api/admin/profile`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `GET /api/admin/badges?handle=`
  - `POST /api/admin/badges`
  - `POST /api/track/view?handle=`
  - `POST /api/track/click`
  - `POST /api/comments`
  - `POST /api/ai`

## Premium Purchase Flow

- Premium feature CTAs link to `NEXT_PUBLIC_DISCORD_PREMIUM_TICKET_URL`.
- If `NEXT_PUBLIC_DISCORD_PREMIUM_TICKET_URL` is not set, the app falls back to `NEXT_PUBLIC_DISCORD_APPEAL_URL`.

## AI API Payloads

`POST /api/ai`

- Bio Generator

```json
{
  "action": "bio-generate",
  "vibe": "clean/professional",
  "interests": "design systems, product strategy",
  "length": "short"
}
```

- Link Label Helper

```json
{
  "action": "link-label",
  "vibe": "minimal",
  "url": "https://example.com"
}
```

- Bio Polish

```json
{
  "action": "bio-polish",
  "vibe": "confident",
  "bio": "building thoughtful products and sharing what I learn"
}
```
