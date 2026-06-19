"""Tests for the 10 fixes applied in this iteration.

Covers:
- /api/admin/verify and /api/admin/login
- /api/admin/users/{tg_id}/add-stars
- /api/admin/users
- Crash multiplier distribution + no repeats + no zero
- Crash idempotent cashout (already_cashed)
- Slots distribution roughly matches RTP spec
- Mines size validation (3/5/7 only), mines bounds, multiplier RTP 0.82
"""
import os
import uuid
import collections
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_SECRET = "9hNiTxKMM9Qb9YB9zJgqPhuVpS3MUrlkY4LtV3wVU-k"


def _new_uid():
    return f"test_{uuid.uuid4().hex[:12]}"


def H(uid):
    return {"X-TG-ID": uid}


def get_user(uid):
    """GET /api/me → user dict."""
    return requests.get(f"{API}/me", headers=H(uid)).json()["user"]


@pytest.fixture(scope="module")
def user_id():
    uid = _new_uid()
    r = requests.post(f"{API}/auth/telegram", json={"fallback_user_id": uid, "fallback_username": "tester"})
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert u["balance"] == 0
    assert u["demo_balance"] == 1000000
    return uid


# ---------------- ADMIN VERIFY/LOGIN ----------------
class TestAdminAuth:
    def test_admin_verify_valid(self):
        r = requests.post(f"{API}/admin/verify", json={"secret": ADMIN_SECRET})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_admin_verify_invalid(self):
        r = requests.post(f"{API}/admin/verify", json={"secret": "wrong"})
        assert r.status_code == 401

    def test_admin_verify_missing(self):
        r = requests.post(f"{API}/admin/verify", json={})
        assert r.status_code == 401

    def test_admin_login_valid(self):
        r = requests.post(f"{API}/admin/login", json={"secret": ADMIN_SECRET})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_admin_login_invalid(self):
        r = requests.post(f"{API}/admin/login", json={"secret": "nope"})
        assert r.status_code == 401


# ---------------- ADMIN ADD-STARS ----------------
class TestAdminAddStars:
    def test_add_stars_success(self, user_id):
        before = get_user(user_id)["balance"]
        r = requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 500},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        assert r.status_code == 200, r.text
        after = get_user(user_id)["balance"]
        assert after == before + 500

    def test_add_stars_zero_rejected(self, user_id):
        r = requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 0},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        assert r.status_code == 400

    def test_add_stars_negative_rejected(self, user_id):
        r = requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": -10},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        assert r.status_code == 400

    def test_add_stars_bad_secret(self, user_id):
        r = requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 100},
            headers={"X-ADMIN": "bad"},
        )
        assert r.status_code == 401

    def test_add_stars_no_secret(self, user_id):
        r = requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 100},
        )
        assert r.status_code == 401

    def test_add_stars_nonexistent_user(self):
        r = requests.post(
            f"{API}/admin/users/nope_nope_nope/add-stars",
            json={"amount": 100},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        assert r.status_code == 404

    def test_admin_users_list(self):
        r = requests.get(f"{API}/admin/users", headers={"X-ADMIN": ADMIN_SECRET})
        assert r.status_code == 200
        body = r.json()
        users = body.get("users", body) if isinstance(body, dict) else body
        assert isinstance(users, list)

    def test_admin_users_list_unauth(self):
        r = requests.get(f"{API}/admin/users")
        assert r.status_code == 401


# ---------------- CRASH DISTRIBUTION ----------------
class TestCrashDistribution:
    """Sample crash multipliers via start endpoint and check buckets and constraints."""

    def _bucket(self, v):
        if v <= 1.20:
            return "b1"
        if v <= 1.50:
            return "b2"
        if v <= 2.00:
            return "b3"
        if v <= 3.00:
            return "b4"
        if v <= 5.00:
            return "b5"
        if v <= 10.00:
            return "b6"
        return "b7"

    def test_distribution_and_no_repeats(self, user_id):
        # Top up so we have enough for 1000 small bets (1 each)
        requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 5000},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        N = 1000
        vals = []
        for _ in range(N):
            r = requests.post(
                f"{API}/games/crash/start",
                json={"bet": 1, "mode": "demo"},
                headers=H(user_id),
            )
            assert r.status_code == 200, r.text
            crash_at = r.json()["crash_at"]
            assert crash_at > 0, "crash_at must never be 0"
            assert crash_at >= 1.01
            vals.append(crash_at)
            # Cleanup: cashout above crash so game ends (lost) and balance stays predictable.
            gid = r.json()["game_id"]
            requests.post(
                f"{API}/games/crash/cashout",
                json={"game_id": gid, "multiplier": crash_at + 10.0},
                headers=H(user_id),
            )

        # No two identical consecutive values
        repeats = sum(1 for i in range(1, N) if vals[i] == vals[i - 1])
        assert repeats == 0, f"Found {repeats} consecutive repeats"

        # Bucket distribution roughly matches spec (allow +/- 5 percentage points)
        counts = collections.Counter(self._bucket(v) for v in vals)
        pct = {k: 100.0 * counts[k] / N for k in ["b1", "b2", "b3", "b4", "b5", "b6", "b7"]}
        targets = {"b1": 20, "b2": 25, "b3": 25, "b4": 18, "b5": 8, "b6": 3.9, "b7": 0.1}
        # log for visibility
        print("Crash buckets pct:", pct, "targets:", targets)
        for k, t in targets.items():
            # allow generous tolerance for the high-mult buckets which are small samples
            tol = 6 if t >= 5 else (3 if t >= 1 else 1.5)
            assert abs(pct[k] - t) <= tol, f"Bucket {k} pct {pct[k]:.2f}% off target {t}% (tol {tol})"


# ---------------- CRASH IDEMPOTENT CASHOUT ----------------
class TestCrashCashoutIdempotent:
    def test_double_cashout(self, user_id):
        # Top up
        requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 1000},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        r = requests.post(
            f"{API}/games/crash/start",
            json={"bet": 50, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 200
        d = r.json()
        gid = d["game_id"]
        crash_at = d["crash_at"]
        # Find a multiplier that cashes out for a win
        target = max(1.01, min(crash_at - 0.01, 1.05))
        if target >= crash_at:
            # crash_at is around 1.01 - skip this test sample
            pytest.skip(f"crash_at {crash_at} too low to cashout")
        bal_before = get_user(user_id)["demo_balance"]
        r1 = requests.post(
            f"{API}/games/crash/cashout",
            json={"game_id": gid, "multiplier": target},
            headers=H(user_id),
        )
        assert r1.status_code == 200
        body1 = r1.json()
        win1 = body1.get("win", 0)
        assert win1 > 0
        bal_after_first = get_user(user_id)["demo_balance"]
        assert bal_after_first - bal_before == win1

        # Second cashout: should not double pay
        r2 = requests.post(
            f"{API}/games/crash/cashout",
            json={"game_id": gid, "multiplier": target},
            headers=H(user_id),
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2.get("already_cashed") is True, f"Expected already_cashed flag, got {body2}"
        bal_after_second = get_user(user_id)["demo_balance"]
        assert bal_after_second == bal_after_first, "Balance changed on second cashout!"


# ---------------- SLOTS DISTRIBUTION ----------------
class TestSlots:
    def test_no_nan_and_deduct(self, user_id):
        requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 1000},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        bal = get_user(user_id)["demo_balance"]
        r = requests.post(
            f"{API}/games/slots/spin",
            json={"bet": 10, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 200
        d = r.json()
        assert "win" in d and d["win"] is not None
        assert isinstance(d["win"], (int, float))
        # JSON has no NaN; just confirm not null
        bal2 = get_user(user_id)["demo_balance"]
        assert bal2 == bal - 10 + d["win"]

    def test_lose_rate_around_65(self, user_id):
        requests.post(
            f"{API}/admin/users/{user_id}/add-stars",
            json={"amount": 5000},
            headers={"X-ADMIN": ADMIN_SECRET},
        )
        N = 200
        loses = 0
        for _ in range(N):
            r = requests.post(
                f"{API}/games/slots/spin",
                json={"bet": 1, "mode": "demo"},
                headers=H(user_id),
            )
            if r.status_code != 200:
                continue
            if r.json().get("win", 0) == 0:
                loses += 1
        pct = 100.0 * loses / N
        print(f"Slots lose rate: {pct}%")
        # 65% +/- 12 percentage points for 200 samples
        assert 50 <= pct <= 80, f"Lose rate {pct}% far from 65%"


# ---------------- MINES SIZE/RTP ----------------
class TestMinesSize:
    def test_size_4_rejected(self, user_id):
        r = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": 4, "mines": 3, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 400

    @pytest.mark.parametrize("size", [3, 5, 7])
    def test_valid_sizes(self, user_id, size):
        r = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": size, "mines": 1, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 200, r.text

    def test_mines_below_min(self, user_id):
        r = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": 5, "mines": 0, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 400

    def test_mines_above_max(self, user_id):
        # 5x5 max is 24
        r = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": 5, "mines": 25, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 400

        # 3x3 max is 8
        r2 = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": 3, "mines": 9, "mode": "demo"},
            headers=H(user_id),
        )
        assert r2.status_code == 400

        # 7x7 max is 48
        r3 = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": 7, "mines": 49, "mode": "demo"},
            headers=H(user_id),
        )
        assert r3.status_code == 400

    def test_mines_multiplier_rtp_via_reveal(self, user_id):
        """5x5 with 1 mine, after 1 safe pick, multiplier should be ~0.82*25/24 ≈ 0.85."""
        r = requests.post(
            f"{API}/games/mines/start",
            json={"bet": 10, "size": 5, "mines": 1, "mode": "demo"},
            headers=H(user_id),
        )
        assert r.status_code == 200
        gid = r.json()["game_id"]
        # Find one safe cell
        for i in range(25):
            rev = requests.post(
                f"{API}/games/mines/reveal",
                json={"game_id": gid, "index": i},
                headers=H(user_id),
            )
            if rev.status_code != 200:
                continue
            body = rev.json()
            if body.get("mine") or body.get("status") == "lost":
                # restart and try again
                r = requests.post(
                    f"{API}/games/mines/start",
                    json={"bet": 10, "size": 5, "mines": 1, "mode": "demo"},
                    headers=H(user_id),
                )
                gid = r.json()["game_id"]
                continue
            mult = body.get("multiplier") or body.get("mult")
            if mult is None:
                # Cashout to read multiplier
                co = requests.post(
                    f"{API}/games/mines/cashout",
                    json={"game_id": gid},
                    headers=H(user_id),
                )
                if co.status_code == 200:
                    mult = co.json().get("multiplier") or (co.json().get("win", 0) / 10.0)
            print(f"5x5 1 mine 1 pick multiplier: {mult}")
            assert mult is not None
            # Expected ≈ 0.82 * 25/24 = 0.854166 → round 2 = 0.85
            assert 0.80 <= float(mult) <= 0.90, f"Got mult {mult}, expected ~0.85"
            break
