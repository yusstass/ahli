# AHLI — database and authentication

Drop these files into a fresh Next.js 14 project (App Router, TypeScript, Tailwind).

```bash
npx create-next-app@14 ahli --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"
cd ahli          # then copy this folder's contents over the project
npm i @prisma/client bcryptjs zod
npm i -D prisma tsx @types/bcryptjs
npm pkg set prisma.seed="tsx prisma/seed.ts"
cp .env.example .env     # fill in DATABASE_URL, APP_URL, ADMIN_*
npx prisma migrate dev --name init
npx prisma db seed       # plans, pricing config, first admin
npm run dev              # /register, /login, /family, /provider, /admin
```

## What is implemented
- PostgreSQL schema for every model in the brief (`prisma/schema.prisma`), with money as Decimal(12,3) because the dinar has 3 decimals.
- Plans and pricing are rows in the database; `lib/pricing.ts` computes prices from them. Subscriptions store a price snapshot.
- Register, login, logout: bcrypt (cost 12), zod validation, DB-backed sessions (hashed token, httpOnly, SameSite=Lax, Secure in production), origin check, rate limiting, generic error messages, timing equalisation.
- Role-based access: `requireRole()` on each dashboard; middleware is only a fast redirect. Admin accounts can only come from the seed.

## Not implemented yet (do before launch)
- Email verification and password reset (needs an email provider).
- Provider onboarding and document upload (needs private object storage with signed URLs).
- Payment providers (Stripe/PayPal depend on the company's legal setup; bank transfer needs the real RIB).
- Dashboards reading from the database (shells only), API routes for services, reviews, medication.
- Rate limiter is in-memory: use Redis if you run more than one server. Add CSP and security headers.
- Legal review of terms, privacy, medical disclaimer and local Tunisian data-protection rules.

## Google sign-in
1. Google Cloud Console → create a project → APIs & Services → OAuth consent screen (External). While it is in "Testing" mode, only the test users you add can sign in.
2. Credentials → Create credentials → OAuth client ID → Web application. Add this Authorized redirect URI exactly: `APP_URL/api/auth/google/callback` (for Codespaces: `https://<name>-3000.app.github.dev/api/auth/google/callback`).
3. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then run `npx prisma migrate dev --name google_auth` and restart.

How it works: authorization-code flow with PKCE and a random `state` (kept in a short-lived httpOnly cookie), then Google's userinfo endpoint. Only Google accounts with a verified email are accepted. New Google users become FAMILY accounts; providers and admins never come from Google. If the email already belongs to a password account, Google sign-in is refused (the user logs in with the password) because AHLI does not verify emails yet, and silently linking would let someone who pre-registered a victim's email take over their Google login. Account linking from a settings page is a good next step once email verification exists.

## Admin dashboard
Open `/admin/login` (dedicated sign-in, admins only, 8-hour sessions). Sections: Overview, Customers, Care Providers, Bookings & Visits, Subscriptions, Payments & Payouts, Complaints & Reports, Notifications, Admin Accounts & Roles, Audit Logs, Settings.

**Update and migrate** (the schema changed: provider/booking/ticket statuses, audit log, notes, provider categories). Use a development database, because renaming enum values can fail if rows already use the old ones:
```bash
npx prisma migrate dev --name admin_dashboard
```

**Create the first administrator** (server only, never from the website):
```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long unique password' npx tsx scripts/create-admin.ts
```
The script refuses to promote an existing user. Google sign-in never creates admins.

**Security model**
- `requireAdmin()` runs in every admin page, route handler and server action; customers and providers get a 404 on `/admin`. Middleware is only a fast redirect.
- Booking state changes go through `lib/booking.ts` (`canMove`) on the server. A provider can only be Verified after identity and profession documents are approved by an admin. A subscription becomes Active only when an admin verifies a bank transfer (or, later, a payment webhook).
- Every sensitive change writes to the audit log (who, what, when, IP). The admin sees recipient name and city only, never address, phone or care notes.
- CSV export escapes spreadsheet formulas. Admin pages are sent with `Cache-Control: no-store`.

**Not done yet**
- No Supabase or RLS: this project uses Prisma + PostgreSQL, so access control is enforced in server code. Plans keep their existing names (Essential, Care+, Complete).
- Customers cannot yet create bookings, payments or support tickets from the app, so those admin lists stay empty until those flows are built.
- Document and visit-photo viewing needs private object storage with signed links.
- Notifications are saved in the database; email/SMS delivery is not connected.
- One admin role only. No sortable column headers (lists are newest first). Failed admin sign-ins are rate-limited but not written to the audit log. The rate limiter is in memory.
- Not run: type-checking and the Phase 4 tests (login/logout, role access, filters, state changes) need a real install and database. Do a full run before trusting it.
