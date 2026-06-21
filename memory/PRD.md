# Cherry Case — PRD

## Original Problem Statement
Continue fixing the Cherry Case project. Multiple iterations across crash, slots, mines, admin, promo, RU translations, withdrawal email, deposited/bonus stars, risk warnings, top-up info copy, round isolation, and Mines RTP nerf.

ADMIN_SECRET=9hNiTxKMM9Qb9YB9zJgqPhuVpS3MUrlkY4LtV3wVU-k

## Architecture
- Backend: FastAPI on :8001 with `/api` prefix, MongoDB at `localhost:27017` (db `test_database`).
- Frontend: React (CRA + craco), served on :3000, uses `REACT_APP_BACKEND_URL`.
- Auth: Telegram WebApp / fallback dev user via `/api/auth/telegram`.
- Admin auth: ADMIN_SECRET via `/api/admin/login` and `/api/admin/verify`, header `X-ADMIN`.
- Email: Resend (graceful skip when `RESEND_API_KEY` missing).

## Implemented

### Crash — strict round isolation (iter4)
- `currentRoundRef` + `betPlacedRef` + locked `roundCrashedAt` snapshot at the moment of crash.
- Cashout rejects if `mult >= round.crashAt`; idempotent on server (`already_cashed:true`).
- Live multiplier keeps animating after cashout; cashout shown as pinned overlay card.
- Crash secondary text uses the LOCKED snapshot, never the next round's `crashAt`.
- History appended only on real round completion.
- Per-user no-immediate-repeat in backend via `db.crash_games.find_one(sort=created_at)`.

### Mines — RTP 0.77 with quadratic floor (iter5)
```
fair = 0.77 / survival
floor = 1.0 + (0.005*picks + 0.003*picks²*√mines) / (size/5)
multiplier = max(fair, floor)
```
- 5x5/1m: 1.01, 1.02, 1.04, 1.07, 1.10 (matches spec for first 3 tiles)
- 7x7/1m: 1.01, 1.02, 1.03, 1.05 (matches spec for first 3 tiles)
- 5x5/24m: 19.25x; 5x5/18m: 2.75x; 7x7/48m: 37.73x; 3x3/8m: 6.93x — high-mine stays rewarding.
- 2x requires pick 16 on 5x5/1m and pick 21 on 7x7/1m (anti-farming).
- Monte Carlo RTP: 0.76 – 0.87 range (within or slightly above 75–80% target).

### Slots, Wheel — unchanged from iter2
- Slots: Lose 65 / 0.5x 14 / 1x 10 / 2x 7 / 5x 3 / 20x 0.9999 / 100x 0.0001.

### Deposited vs Bonus Stars
- `user.deposited_balance` increments on paid invoice only. `spend_balance` drains deposited first.
- `BonusBetModal` warns in real mode when bet > deposited.
- Admin endpoints return derived `bonus_balance`.

### Top-Up flow (iter3)
- 3-stage modal: choose → stars / admin.
- Stars stage: presets + custom amount + promo (English) + admin `/admin` trigger + pay button.
- Admin stage: full RU/EN copy, "Связаться с @RadioArseny" CTA → t.me/RadioArseny.
- Promo only in stars stage; admin stage has no promo input; TopBar has no promo input.

### Withdrawal Emails (Resend)
- One-time email to `arseny.yurevi4@gmail.com` on real-mode withdraw create.
- Full verification block + `WD-XXXXXX` short id. Skipped silently when `RESEND_API_KEY` missing.

### Admin
- `POST /api/admin/users/{tg_id}/add-stars` adds to balance (bonus only).
- Admin UI shows D{deposited}/B{bonus} per user + per-withdrawal source case + REVIEW flag.

## Test Status
- iter1: 23/24 backend, 100% frontend
- iter2: 25/25 backend, 13/13 frontend (100%)
- iter3: minor frontend fix (you-lost div via stale closure)
- iter4: 10/10 backend pytest; mines math 16/16 exact; frontend manually verified at preview
- iter5 (mines nerf): direct math + Monte Carlo verified, no further agent run requested

## Files Of Interest
- Backend: `/app/backend/server.py`
- Frontend pages: `/app/frontend/src/pages/{Crash,Mines,Slots,Wheel,Profile,Admin,Inventory,Games}.jsx`
- Components: `/app/frontend/src/components/{TopBar,TopUpModal,BonusBetModal}.jsx`
- Context: `/app/frontend/src/context/AppContext.jsx`
- Translations: `/app/frontend/src/data/translations.js`

## Backlog
- Split `server.py` into routers (admin/games/cases/payments).
- Real promo code redemption endpoint.
- `/api/inventory/sell` race-prone read-then-write — guard with $inc or transaction.
- Cleanup legacy `/app/backend/tests/test_cherry_case.py` (references `/api/profile`).
