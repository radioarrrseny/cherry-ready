# Cherry Case — PRD

## Original Problem Statement
Continue fixing the Cherry Case project. Multiple fix rounds applied (crash distribution, slots RTP, mines reworked, admin panel, promo code, hidden admin, RU translations, withdrawal email notifications, deposited/bonus stars separation, risk warnings, top-up info copy).

ADMIN_SECRET=9hNiTxKMM9Qb9YB9zJgqPhuVpS3MUrlkY4LtV3wVU-k

## Architecture
- Backend: FastAPI on :8001 with `/api` prefix, MongoDB at `localhost:27017` (db `test_database`).
- Frontend: React (CRA + craco), served on :3000, uses `REACT_APP_BACKEND_URL`.
- Auth: Telegram WebApp / fallback dev user via `/api/auth/telegram`.
- Admin auth: ADMIN_SECRET via `/api/admin/login` and `/api/admin/verify`, header `X-ADMIN`.
- Email: Resend (graceful skip when `RESEND_API_KEY` missing).

## Implemented (latest snapshot)

### Crash
- `generate_crash_multiplier(last)` with per-user no-repeat (uses last user crash_at).
- Cashout is atomic and idempotent: optimistic local credit + server confirmation. Second call returns `already_cashed:true`.
- Frontend never shows "Crash at 0/undefined/NaN". When user cashed out, the cashout message is the main result; round crash result is shown as secondary text. When user did not cash out, "Round crashed at X" + "You lost X⭐".

### Mines
- Sizes 3/5/7 only (3x3:1-8, 5x5:1-24, 7x7:1-48). RTP 0.82.
- `mines_multiplier = max(0.82/survival, 1.0 + picks*0.02)` — slow growth on low-mine boards (5x5/1mine: 1.02, 1.04, 1.06 per safe tile).
- Low-risk warning (3x3/1, 5x5/1-3, 7x7/1-5) and high-risk warning (3x3/6-8, 5x5/16-24, 7x7/32-48) shown near selector.

### Slots
- RTP per spec (Lose 65 / 0.5x 14 / 1x 10 / 2x 7 / 5x 3 / 20x 0.9999 / 100x 0.0001).

### Deposited vs Bonus Stars
- `user.deposited_balance` tracks Telegram-Stars-paid amount only (incremented in payment webhook).
- Real-mode bet/case-open spending uses helper `spend_balance` → deposited first, then bonus.
- `balance` is the total (deposited + bonus); `bonus_balance` derived in admin endpoints.
- Frontend modal warning ("You are playing with bonus Stars") in real mode when bet > deposited (Crash/Mines/Slots/Wheel via `confirmBonusBet`).

### Top-Up
- Modal text replaced with the contact-admin instruction copy (RU + EN), plus "Message @RadioArseny" CTA opening t.me/RadioArseny.
- Promo Code field lives inside the Top-Up modal (English UI). `/admin` opens hidden Admin Access modal.

### Withdrawal Emails (Resend)
- Real-mode withdrawal creation triggers a one-time email to `arseny.yurevi4@gmail.com`.
- Subject: `Cherry Case Withdrawal Request`. Body includes Telegram username/ID (or "Not available yet"), gift name/value/image, source case, total deposits, current balance, inventory value, short Request ID (`WD-XXXXXX`), created-at human time, full verification block, and warning if suspicious.
- Skips silently if `RESEND_API_KEY` not configured.
- No emails for demo mode, duplicates, or status changes.

### Admin
- `POST /api/admin/users/{tg_id}/add-stars` — Stars added to `balance` only (bonus), validates X-ADMIN, rejects ≤0/missing user, logs to `admin_actions`.
- `GET /api/admin/users` returns each user's `deposited_balance` and `bonus_balance`.
- `GET /api/admin/player/{tg_id}` returns the same + per-record withdrawal verification.
- Admin UI: users list shows (D/B), player drawer shows Total/Deposited/Bonus, withdrawal cards show source case and "REVIEW" flag for suspicious.

## Files Of Interest
- Backend: `/app/backend/server.py`
- Frontend pages: `/app/frontend/src/pages/{Crash,Mines,Slots,Wheel,Profile,Admin,Inventory,Games}.jsx`
- Components: `/app/frontend/src/components/{TopBar,TopUpModal,BonusBetModal}.jsx`
- Context: `/app/frontend/src/context/AppContext.jsx`
- Translations: `/app/frontend/src/data/translations.js`

## Backlog
- Real promo code redemption endpoint.
- "Deposited balance" badge on TopBar for transparency.
- Server-side ratelimit on `/api/admin/verify` against brute force.
