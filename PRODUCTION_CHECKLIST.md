# GymDuo Production Sanity Checklist

## 1. Fresh Install
- [ ] Clone repo, install dependencies, set up .env, run migrations/seed
- [ ] App boots with no errors
- [ ] All flows (login, register, dashboard, explore, payment) work from scratch

## 2. Incognito/Session Expiry
- [ ] Open in incognito: forced login, no session leaks
- [ ] Expired session: forced re-auth, no stale UI

## 3. Refresh/Navigation
- [ ] Refresh on all pages: session/data revalidated, no flicker
- [ ] Navigate between dashboard, explore, payments: state is correct, no stale data

## 4. Slow Network
- [ ] Throttle network: loading states everywhere, no partial UI
- [ ] No double fetches or race conditions

## 5. Error Handling
- [ ] API/server errors: user-friendly messages, no console leaks
- [ ] Invalid input: clear errors, no crashes

## 6. Edge Cases
- [ ] Role change mid-session: forced logout or redirect
- [ ] Payment failure: no double charge, error shown
- [ ] Location denied: waitlist or fallback UI

## 7. No Misleading UI
- [ ] All loading, error, and empty states explicit
- [ ] No UI renders before data/auth ready
- [ ] No role flicker or stale state

---

**Update this checklist as new edge cases are found.**

See FLOWMAP.md for flow details and patterns.