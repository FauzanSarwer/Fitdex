# GymDuo End-to-End Flow Map

## 1. Authentication & Session Flows

### Login
- User visits /auth/login
- Credentials/Google login via NextAuth
- On success: JWT/session cookie set, user redirected to dashboard (role-based)
- On failure: Error message shown, no session set
- Edge: Incognito/expired session → redirect to login

### Registration
- User visits /auth/register
- Fills form, submits
- Backend creates user, sets session, redirects to dashboard
- Edge: Duplicate email → error shown

### Password Reset
- User visits /auth/forgot
- Submits email, receives token
- Visits /auth/reset/[token], sets new password
- Edge: Invalid/expired token → error shown

### Logout
- User clicks logout
- Session destroyed, redirected to /auth/login
- All client state reset

## 2. Dashboard Navigation
- Authenticated user lands on /dashboard
- Role-based redirect: owner → /dashboard/owner, user → /dashboard/user
- Navigation between dashboard sections (analytics, gym, members, payments, etc.)
- Edge: Unauthorized role → redirect to /auth/login

## 3. Role-Based Access
- Owner: Can access all /dashboard/owner/* routes
- User: Can access all /dashboard/user/* routes
- Middleware and server components enforce role checks
- Edge: Role change mid-session → force logout or redirect

## 4. Data Fetching & State
- All data fetches use fetchJson with unmount guards
- Loading, error, and empty states explicit in UI
- No UI renders before data/auth ready
- Edge: Slow network → loading spinners, no stale data

## 5. Payment Flows
- User initiates payment (Razorpay)
- Payment handler opens Razorpay modal, awaits verification
- On success: Membership/payment updated, UI reflects new state
- On failure: Error shown, no state change
- Edge: Payment verification fails → error, no double charge

## 6. Error Handling
- All async flows have try/catch, error boundaries
- User-facing errors shown in UI, not console
- Edge: API/server errors → user-friendly message

## 7. Edge Cases
- Incognito: No session, forced login
- Refresh: Session revalidated, state restored
- Slow network: Loading states everywhere
- Navigation: State cleanup on unmount, no stale data
- No misleading UI: All states explicit, no flicker

---

## Diagrams/Tables

| Flow         | Entry Point         | Guards/Checks         | Success Outcome         | Failure Outcome         |
|--------------|--------------------|-----------------------|------------------------|------------------------|
| Login        | /auth/login        | Credentials/Google    | Dashboard redirect     | Error message          |
| Register     | /auth/register     | Email unique          | Dashboard redirect     | Error message          |
| Reset Pass   | /auth/reset/[tok]  | Token valid           | Password updated       | Error message          |
| Dashboard    | /dashboard         | Auth, role            | Section loaded         | Redirect to login      |
| Payment      | /dashboard/user/payments | Auth, membership | Payment success        | Error message          |

---

## See also
- middleware.ts: All routing/role checks
- lib/permissions.ts: Role logic
- components/providers.tsx: Session provider
- All dashboard pages: Data fetch, error, and loading handling

---

This document is maintained as the single source of truth for all critical user flows. Update as flows change.

## Session/Role Contract

All session and role access is centralized and strictly typed:

- See `lib/auth.ts` for `SessionUserSchema` (zod) and `getSessionUser()` helper.
- All role checks (`isOwner`, `isUser`, etc) use this contract (see `lib/permissions.ts`).
- All API input is validated with zod before use.
- Types are enforced in `types/next-auth.d.ts`.

**Pattern:**

```ts
import { getSessionUser } from "@/lib/auth";
const user = getSessionUser(session);
if (!user || user.role !== "OWNER") throw new Error("Not owner");
```

This ensures a single source of truth for all session/role/data access.

## UI/Business Logic Separation

**Rule:** All business logic (fetching, mutations, side effects, data transforms) must be moved out of JSX and into hooks or lib functions. UI components must:

- Only call hooks or helpers for data/state
- Never contain fetch, mutation, or side effect logic inline
- Always use explicit loading, error, and empty states (never render partial or misleading UI)
- Use unmount guards for all async flows

**Pattern:**

```tsx
// BAD:
return <div>{fetch('/api/foo')}</div>

// GOOD:
const { data, loading, error } = useFoo();
if (loading) return <Loading />;
if (error) return <Error />;
return <div>{data.value}</div>;
```

All contributors must follow this pattern. See `app/dashboard/*` and `app/(public)/*` for examples.

## Architectural Cleanup & Documentation

- All dead code and deprecated files (e.g., dashboard-redirect) have been removed.
- Logic is deduplicated and moved to shared hooks/lib where possible.
- Folder structure is documented in README.md (see "Project Structure").
- All flows, contracts, and patterns are documented in this FLOWMAP.md.
- Environment variables are documented in .env.example and README.md.
- Separation of concerns is enforced: UI, business logic, and data contracts are strictly separated.