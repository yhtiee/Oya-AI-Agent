# Spec questions

Places where the build diverges from SPEC.md or the spec needs an answer (SPEC §0 rule 4). Each has a matching
`// SPEC-QUESTION:` comment in code where relevant.

## SQ-001 — Email + password sign-in isn't in the spec

- **Spec:** phone OTP (§4.6), or in bootstrap mode Google sign-in + 6-digit email code, explicitly _not_ magic links
  (§20.1).
- **Founder decision (2026-10-08):** email + password for now.
- **Things to settle before launch:**
  - Password reset needs email delivery. Supabase's built-in email is heavily rate-limited, so a custom SMTP (e.g.
    Resend free tier, §20.1) is needed for production.
  - Reset links have the same "opens in the wrong browser" problem as magic links on Android (§20.1). Prefer a
    6-digit reset code over a link.
  - The 180-day re-verification rule (§3.3, §4.6) becomes "sign in with your password again".
  - Booking still needs an ops-confirmed phone (§20.1), whatever the sign-in method.
- **Update (M1):** built as Oya-managed auth, not Supabase Auth (D-010). Done: sign-up with 18+ check and consents,
  sign-in, sign-out, rate limits, lockout, password change, sessions list, ops TOTP. **Not done yet:**
  - email verification (anyone can sign up with an email they don't own);
  - password reset (needs an email sender);
  - phone OTP behind `phone_otp`.
- **Status:** open. Decide on an email provider (e.g. Resend free tier) so verification and reset codes can ship.

## SQ-002 — Single Supabase project

- **Spec:** separate dev, staging and prod projects (§16.4); local Supabase for development (§21.1); M2 accepts on
  `supabase db reset` reproducing a dev DB.
- **Now:** one linked project that also holds the live waitlist (decision D-005).
- **Status:** open. Needs a staging project or Docker before M2's acceptance can be met as written.
