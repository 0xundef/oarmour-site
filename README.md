# Realtime

Realtime — a Next.js application shell with authentication and user management.

## Stack

- **Next.js 16** (App Router) + React 18 + TypeScript
- **Prisma 5** + PostgreSQL
- **NextAuth v4** (Google / GitHub OAuth + email & password with email verification)
- **Stripe** billing
- Tailwind CSS + shadcn/ui

## What's included

- Sign in / register (`/signin`) with OAuth and email-password (email-verified registration)
- Dashboard shell (`/dashboard`) gated by auth middleware
- Admin: user management + login-activity audit (`/dashboard/admin`)
- Billing (`/dashboard/billing`) via Stripe
- Marketing landing pages (`/`, `/v2`) — placeholder copy, ready to be rewritten

## Database

Realtime shares a Postgres instance with other apps but lives in its own schema
(`?schema=realtime_app`). Configure:

```
REALTIME_DATABASE_URL="postgresql://user:password@host:5432/db?schema=realtime_app"
REALTIME_DIRECT_URL="postgresql://user:password@host:5432/db?schema=realtime_app"
```

Apply the schema (no reset of other apps' data):

```
npx prisma migrate deploy   # or: npx prisma db push
```

## Development

```
npm install
npx prisma generate
npm run dev
```

See `env.example.txt` for required environment variables.
