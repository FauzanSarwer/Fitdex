# GYMDUO — District of Gyms

A premium gym discovery and duo accountability platform for Delhi NCR.

## Features

- 🗺️ **Map-based gym discovery** — Find gyms near you
- 👥 **Duo system** — Invite a partner, stack discounts
- 💳 **Real payments** — Razorpay integration
- 📊 **Analytics dashboards** — For members and gym owners
- 🎨 **Premium dark UI** — Glassmorphism, gradients, smooth animations

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, ShadCN/UI, Framer Motion
- **Backend**: Next.js API routes, Prisma ORM, SQLite
- **Auth**: NextAuth (Email + Google OAuth)
- **Payments**: Razorpay Checkout
- **Maps**: Google Maps API

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys (leave as `XXXXX` for local dev if you don't have keys).

3. **Set up database**
   ```bash
   npx prisma migrate dev --schema=db/schema.prisma
   npx tsx db/seed.ts
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

## Database

- SQLite database at `dev.db` (created automatically)
- Prisma schema at `db/schema.prisma`
- Seed script creates 3 Delhi gyms automatically

## Project Structure

```
/app
  /(public)      # Public pages (home, explore, pricing)
  /auth          # Login, register
  /dashboard     # User & owner dashboards
  /api           # API routes
/components      # React components
/lib             # Utilities (auth, prisma, razorpay, etc.)
/db              # Prisma schema & seed
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

- `DATABASE_URL` — SQLite database path
- `NEXTAUTH_SECRET` — NextAuth secret
- `NEXTAUTH_URL` — App URL
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Razorpay keys
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps API key

## Features in Detail

### Discount Engine
- Welcome discount (first-time users)
- Yearly discount (yearly plans)
- Partner discount (active duos)
- Discounts stack, capped at `maxDiscountCapPercent` (default 40%)

### Duo System
- Invite via email or code
- Both users must have active memberships at the same gym
- Duo auto-activates when both memberships are active

### Location & Service Area
- Delhi NCR only
- GPS required on first visit
- Shows waitlist if outside service area

## Development

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run db:migrate` — Run migrations
- `npm run db:seed` — Seed database

## License

Private — All rights reserved
