---
applyTo: '**'
---
You are working on a production-grade two-sided marketplace platform.

Fitdex includes:
- User panel (buyers)
- Gym Owner panel (sellers)
- Admin panel (platform operator)
- Payments & GST logic
- Invoice generation
- Role-based access control

This is NOT a simple SaaS dashboard.
This platform handles real money and financial documents.

All code must be stable, secure, and marketplace-safe.

---

# Core Marketplace Principles (Mandatory)

1. Never mix user, owner, and admin logic.
2. Always enforce role-based access on the backend.
3. Never trust frontend data.
4. Never expose privileged data across roles.
5. Never allow cross-gym data access.
6. Never allow a user to see another user’s private data.
7. Never allow an owner to access another owner’s analytics or billing data.

If a feature affects:
- Money
- Identity
- Role access
- Invoices
- Commission
- Subscriptions

Treat it as sensitive.

---

# Before Writing Code

You MUST:

1. Inspect relevant schema and models.
2. Inspect existing auth logic.
3. Identify:
   - Role checks
   - Plan restrictions (Free / 1499 / 1999)
   - Payment dependencies
4. Explain briefly what will change (if requested).
5. Make minimal diffs only.

If unsure:
- Ask for clarification.
- Do not guess.

---

# Architecture Rules

- Do not rewrite large files unless explicitly required.
- Do not refactor unrelated logic.
- Do not rename database fields.
- Do not introduce breaking schema changes.
- Do not assume relationships.
- Do not assume optional fields exist.

Match the existing architecture exactly.

---

# Payments & Financial Safety Rules (Critical)

If writing anything related to:

- Payments
- GST
- Invoice generation
- Commission
- Payouts
- Subscription plans
- Billing logic

Then:

1. All calculations must happen on the backend.
2. Never rely on frontend values for billing.
3. Avoid floating-point precision errors.
4. Ensure invoice numbering is sequential and race-condition safe.
5. Never allow duplicate invoice generation.
6. Store calculated tax breakdown permanently.
7. Ensure idempotency for payment webhooks.
8. Never allow modification of invoice after creation.
9. Never calculate GST dynamically inside PDF render.

Accuracy > speed.

---

# Role-Based Access Rules

Always verify:

- Is user authenticated?
- What is the role? (user / owner / admin)
- Is owner linked to this gym?
- Is admin required?
- Is plan level sufficient (1499 / 1999)?

Never enforce access only in frontend.
Always validate on backend.

---

# Invoice & GST Requirements

When generating invoice:

- Snapshot gym data at time of invoice creation.
- Snapshot member data.
- Snapshot GSTIN.
- Store tax rate used.
- Store base amount separately from tax amount.
- Store invoice type (GST / Non-GST).
- Make invoice immutable after generation.

Invoices must never be deleted.

---

# Database Rules

- Never write destructive queries without explicit instruction.
- Never delete invoices.
- Use transactions for financial operations.
- Avoid race conditions in sequential counters.
- Validate all inputs server-side.
- Sanitize all user-provided data.

---

# Frontend Rules

- No UI clutter.
- Maintain responsive layout.
- Add proper loading states.
- Add disabled states for async actions.
- Show user-friendly error messages.
- Do not expose internal stack traces.
- Follow existing Tailwind design patterns.
- Do not over-animate.
- Do not introduce inconsistent styling.

---

# Strictly Forbidden

- Using `any` to bypass TypeScript.
- Adding `@ts-ignore`.
- Guessing database schema.
- Writing placeholder TODO code.
- Hardcoding financial values.
- Ignoring null/undefined checks.
- Silent error handling.
- Rewriting working logic unnecessarily.

---

# Performance Rules

- Avoid unnecessary re-renders.
- Avoid duplicate database calls.
- Do not introduce performance regressions.
- Use memoization only when required.
- Avoid unnecessary dependencies.

---

# Edge Case Checklist

Before final output, verify:

- What if user is not logged in?
- What if role is incorrect?
- What if gym has no GST?
- What if payment fails?
- What if invoice already exists?
- What if duplicate request occurs?
- What if plan changes mid-session?
- What if data is null or undefined?

If any scenario breaks — fix it.

---

# Output Requirements

- Code must compile without errors.
- No new TypeScript warnings.
- No console errors.
- No incomplete implementations.
- No pseudo-code.
- No placeholder comments.
- Production-ready only.
- Minimal diffs.
- Maintain existing code style.

---

# Execution Reminder

This is a two-sided marketplace handling real money.

Do not guess.
Do not rush.
Production-grade only.