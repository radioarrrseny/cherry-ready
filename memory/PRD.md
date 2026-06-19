# Cherry Case — PRD

## Original Problem Statement
Continue fixing the Cherry Case project. Apply 10 specific fixes (Crash distribution, Slots RTP, Mines 3/5/7, remove admin hint, Promo code field, hidden /admin modal, admin add-stars endpoint, RU translations, preserve existing features).

ADMIN_SECRET=9hNiTxKMM9Qb9YB9zJgqPhuVpS3MUrlkY4LtV3wVU-k

## Architecture
- Backend: FastAPI on :8001, prefix `/api`, MongoDB at `localhost:27017` (db `test_database`).
- Frontend: React (CRA + craco), served on :3000, uses `REACT_APP_BACKEND_URL`.
- Auth: Telegram WebApp / fallback dev user via `/api/auth/telegram`.
- Admin auth: ADMIN_SECRET in backend `.env`, verified via `/api/admin/login`, `/api/admin/verify`, header `X-ADMIN`.

## Core Requirements (Static)
- Casino-style mini-app: Cases, Crash, Mines, Slots, Wheel, Inventory, Withdrawals, Live drops, Profile.
- Demo mode (1,000,000 ⭐) and Real mode (Telegram Stars top-ups).
- Provably fair distributions per spec.
- Admin dashboard for withdrawal moderation + user inspection + add-stars.
- Russian + English UI.

## What's Been Implemented (2026-06-19)

### Session 1 — 2026-06-19 — 10 Fixes Applied
1. **Crash distribution** rewritten to continuous-range sampler matching spec (20/25/25/18/8/3.9/0.1%). Never returns 0. **Per-user** no-immediate-repeat guarantee via last `crash_at` lookup.
2. **Crash cashout** made idempotent — second call returns `already_cashed:true`, no double payout.
3. **Slots RTP** updated to Lose=65%, 0.5x=14%, 1x=10%, 2x=7%, 5x=3%, 20x=0.9999%, 100x=0.0001%.
4. **Mines** reworked: sizes 3/5/7 only; mine ranges 1–8/1–24/1–48; RTP raised to 0.82.
5. **Admin hint removed** from Profile page.
6. **Promo Code input** added to TopBar (English UI).
7. **Hidden /admin modal**: entering `/admin` in promo opens Admin Access modal; secret validated via `POST /api/admin/verify`.
8. **Admin add-stars**: `POST /api/admin/users/{tg_id}/add-stars` (validates X-ADMIN, rejects ≤0, 404 if user missing, logs to `admin_actions`); frontend form on Admin page with optional user browser.
9. **Russian translations expanded** + hardcoded English removed from Games / Crash / Inventory / Admin.
10. **Preserved**: cases, inventory, withdrawals, demo mode, live drops, Telegram bot config, admin secret.

### Verified
- Backend pytest: 23/24 (95.8%); minor was global-cross-client repeat, fixed by per-user no-repeat.
- Frontend Playwright: 100% (promo input, admin modal, admin page, mines 3/5/7, profile clean, RU translations).
- Sanity check: 200 sequential per-user crash starts → 0 consecutive repeats.

## Prioritized Backlog

### P1
- Real promo code system (admin can create codes that grant stars / bonus).
- Per-user crash history view in Profile (last 20 rounds with multiplier + outcome).

### P2
- Refactor `server.py` (1141 lines) into routers (`admin`, `games`, `cases`).
- Server-Sent Events for live drops instead of polling.
- Add /api/profile alias for legacy tests, or remove legacy test file.

### P0 Remaining
- None. All requested fixes are live.

## Enhancement Idea (engagement)
Add a small "Daily Login Streak" indicator next to the balance — gives 50/100/200/500 ⭐ on consecutive days. Drives retention with near-zero implementation cost (re-use existing `daily_cooldown`).
