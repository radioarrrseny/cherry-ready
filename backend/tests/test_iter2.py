"""Iteration 2 backend tests for Cherry Case fixes.

Focus: deposited vs bonus balance, mines floor RTP (0.02x/tile),
crash idempotent cashout returning user, mines size 4 rejection,
admin users w/ deposited_balance + bonus_balance, withdrawal w/
verification block and silent email skip, demo withdraw rejected.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_SECRET = "9hNiTxKMM9Qb9YB9zJgqPhuVpS3MUrlkY4LtV3wVU-k"


def _uid():
    return f"test_{uuid.uuid4().hex[:12]}"


def H(uid):
    return {"X-TG-ID": uid}


def auth(uid):
    r = requests.post(f"{API}/auth/telegram",
                      json={"fallback_user_id": uid, "fallback_username": "t"})
    assert r.status_code == 200, r.text
    return r.json()["user"]


def me(uid):
    return requests.get(f"{API}/me", headers=H(uid)).json()["user"]


def add_stars(uid, amt):
    return requests.post(f"{API}/admin/users/{uid}/add-stars",
                         json={"amount": amt},
                         headers={"X-ADMIN": ADMIN_SECRET})


# ---------- Root / health ----------
class TestRoot:
    def test_root_ok(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ---------- New user shape (balance/deposited/demo) ----------
class TestUserShape:
    def test_new_user_balances(self):
        uid = _uid()
        u = auth(uid)
        assert u["balance"] == 0
        assert u["deposited_balance"] == 0
        assert u["demo_balance"] == 1_000_000


# ---------- Admin add-stars: bonus only ----------
class TestAdminAddStarsBonus:
    def test_add_stars_bonus_only(self):
        uid = _uid()
        auth(uid)
        r = add_stars(uid, 200)
        assert r.status_code == 200, r.text
        u = me(uid)
        assert u["balance"] == 200
        assert u["deposited_balance"] == 0  # bonus

    def test_crash_real_spends_bonus_when_no_deposit(self):
        uid = _uid()
        auth(uid)
        add_stars(uid, 200)
        # real-mode bet 50, deposited=0 so bonus is spent
        r = requests.post(f"{API}/games/crash/start",
                          json={"bet": 50, "mode": "real"},
                          headers=H(uid))
        assert r.status_code == 200, r.text
        u = me(uid)
        assert u["balance"] == 150
        assert u["deposited_balance"] == 0


# ---------- Crash idempotent cashout ----------
class TestCrashIdempotent:
    def test_already_cashed_no_double_pay(self):
        uid = _uid()
        auth(uid)
        for _ in range(15):
            r = requests.post(f"{API}/games/crash/start",
                              json={"bet": 50, "mode": "demo"},
                              headers=H(uid))
            assert r.status_code == 200
            d = r.json()
            if d["crash_at"] >= 1.10:
                gid = d["game_id"]
                target = 1.05
                bal0 = me(uid)["demo_balance"]
                r1 = requests.post(f"{API}/games/crash/cashout",
                                   json={"game_id": gid, "multiplier": target},
                                   headers=H(uid))
                assert r1.status_code == 200
                b1 = r1.json()
                assert b1.get("win", 0) > 0
                assert not b1.get("already_cashed")
                bal1 = me(uid)["demo_balance"]
                assert bal1 - bal0 == b1["win"]
                # Second call: idempotent, must return already_cashed and not pay
                r2 = requests.post(f"{API}/games/crash/cashout",
                                   json={"game_id": gid, "multiplier": target},
                                   headers=H(uid))
                assert r2.status_code == 200
                b2 = r2.json()
                assert b2.get("already_cashed") is True
                assert "user" in b2
                bal2 = me(uid)["demo_balance"]
                assert bal2 == bal1
                return
            else:
                # round ends (lost) — let it crash
                requests.post(f"{API}/games/crash/cashout",
                              json={"game_id": d["game_id"],
                                    "multiplier": d["crash_at"] + 10},
                              headers=H(uid))
        pytest.skip("Could not get crash_at >= 1.10 in 15 attempts")


# ---------- Crash multiplier: never 0, no consecutive repeats ----------
class TestCrashMultRepeats:
    def test_no_zero_no_consecutive_repeat(self):
        uid = _uid()
        auth(uid)
        add_stars(uid, 1000)
        vals = []
        for _ in range(100):
            r = requests.post(f"{API}/games/crash/start",
                              json={"bet": 1, "mode": "demo"},
                              headers=H(uid))
            assert r.status_code == 200
            c = r.json()["crash_at"]
            assert c > 0
            assert c >= 1.01
            vals.append(c)
            # End round
            requests.post(f"{API}/games/crash/cashout",
                          json={"game_id": r.json()["game_id"],
                                "multiplier": c + 10},
                          headers=H(uid))
        consec = sum(1 for i in range(1, len(vals)) if vals[i] == vals[i - 1])
        assert consec == 0, f"{consec} consecutive repeats found: {vals}"


# ---------- Mines floor multiplier (0.02 per safe tile) ----------
class TestMinesFloor:
    """Verify floor=1 + picks*0.02 dominates for low-risk plays."""

    @pytest.mark.parametrize("size,picks,expected", [
        (5, 1, 1.02),
        (5, 2, 1.04),
        (5, 3, 1.06),
        (7, 1, 1.02),
        (7, 2, 1.04),
        (7, 3, 1.06),
    ])
    def test_low_risk_floor(self, size, picks, expected):
        """Run mines with size, 1 mine, reveal `picks` safe cells, read mult."""
        uid = _uid()
        auth(uid)
        # Allow a few attempts in case we hit the bomb
        for _ in range(20):
            r = requests.post(f"{API}/games/mines/start",
                              json={"bet": 10, "size": size,
                                    "mines": 1, "mode": "demo"},
                              headers=H(uid))
            assert r.status_code == 200, r.text
            gid = r.json()["game_id"]
            total = size * size
            ok = True
            last_mult = None
            for i in range(picks):
                # Try cells until we find a safe one
                hit = False
                for idx in range(total):
                    rev = requests.post(f"{API}/games/mines/reveal",
                                        json={"game_id": gid, "index": idx},
                                        headers=H(uid))
                    if rev.status_code != 200:
                        continue
                    body = rev.json()
                    if body.get("hit_bomb"):
                        ok = False
                        break
                    last_mult = body.get("multiplier")
                    hit = True
                    break
                if not ok or not hit:
                    ok = False
                    break
            if ok and last_mult is not None:
                assert abs(last_mult - expected) < 0.005, \
                    f"size={size} picks={picks}: got {last_mult}, want {expected}"
                return
        pytest.fail(f"Could not get {picks} safe reveals for size={size}")

    def test_high_risk_5_24(self):
        """5x5 with 24 mines, 1 pick → ~20.5x (fair dominates)."""
        uid = _uid()
        auth(uid)
        # 24 mines means only 1 safe cell — pick all
        for _ in range(40):
            r = requests.post(f"{API}/games/mines/start",
                              json={"bet": 10, "size": 5,
                                    "mines": 24, "mode": "demo"},
                              headers=H(uid))
            assert r.status_code == 200
            gid = r.json()["game_id"]
            for idx in range(25):
                rev = requests.post(f"{API}/games/mines/reveal",
                                    json={"game_id": gid, "index": idx},
                                    headers=H(uid))
                if rev.status_code != 200:
                    continue
                body = rev.json()
                if body.get("hit_bomb"):
                    break
                mult = body.get("multiplier")
                assert 19.0 < mult < 22.0, f"got {mult}, want ~20.5"
                return
        pytest.fail("Could not find safe cell in 5x5/24 mines after 40 tries")

    def test_high_risk_7_48(self):
        """7x7 with 48 mines, 1 pick → ~40.18x."""
        uid = _uid()
        auth(uid)
        for _ in range(80):
            r = requests.post(f"{API}/games/mines/start",
                              json={"bet": 10, "size": 7,
                                    "mines": 48, "mode": "demo"},
                              headers=H(uid))
            assert r.status_code == 200
            gid = r.json()["game_id"]
            for idx in range(49):
                rev = requests.post(f"{API}/games/mines/reveal",
                                    json={"game_id": gid, "index": idx},
                                    headers=H(uid))
                if rev.status_code != 200:
                    continue
                body = rev.json()
                if body.get("hit_bomb"):
                    break
                mult = body.get("multiplier")
                assert 39.0 < mult < 42.0, f"got {mult}, want ~40.18"
                return
        pytest.fail("Could not find safe cell in 7x7/48 mines")


# ---------- Mines size validation ----------
class TestMinesSize:
    def test_size_4_rejected(self):
        uid = _uid()
        auth(uid)
        r = requests.post(f"{API}/games/mines/start",
                          json={"bet": 10, "size": 4, "mines": 3, "mode": "demo"},
                          headers=H(uid))
        assert r.status_code == 400

    @pytest.mark.parametrize("size", [3, 5, 7])
    def test_size_accepted(self, size):
        uid = _uid()
        auth(uid)
        r = requests.post(f"{API}/games/mines/start",
                          json={"bet": 10, "size": size, "mines": 1, "mode": "demo"},
                          headers=H(uid))
        assert r.status_code == 200


# ---------- Admin users / player ----------
class TestAdminUsers:
    def test_admin_users_has_dep_bonus(self):
        uid = _uid()
        auth(uid)
        add_stars(uid, 333)
        r = requests.get(f"{API}/admin/users",
                         headers={"X-ADMIN": ADMIN_SECRET})
        assert r.status_code == 200
        users = r.json()["users"]
        u = next((x for x in users if x["tg_id"] == uid), None)
        assert u is not None
        assert u["deposited_balance"] == 0
        assert u["bonus_balance"] == 333

    def test_admin_users_unauth(self):
        r = requests.get(f"{API}/admin/users")
        assert r.status_code == 401

    def test_admin_player_has_bonus(self):
        uid = _uid()
        auth(uid)
        add_stars(uid, 555)
        r = requests.get(f"{API}/admin/player/{uid}",
                         headers={"X-ADMIN": ADMIN_SECRET})
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["deposited_balance"] == 0
        assert u["bonus_balance"] == 555


# ---------- Inventory withdrawal: verification block + email skip ----------
class TestWithdrawal:
    def test_real_withdraw_creates_verification_and_skips_email(self):
        uid = _uid()
        auth(uid)
        # Bypass any real-mode prereqs by injecting an inventory item:
        # we can only get a real-mode item through case open, so admin
        # add balance and open the cheapest case in real mode.
        add_stars(uid, 100)
        # Open Daily real case (price 1)
        gift_item = None
        for _ in range(30):
            r = requests.post(f"{API}/cases/open",
                              json={"case_id": "basic", "mode": "real"},
                              headers=H(uid))
            if r.status_code != 200:
                # cooldown for daily or insufficient — top up more
                add_stars(uid, 100)
                continue
            rwd = r.json().get("reward", {})
            if rwd.get("type") == "gift":
                inv = requests.get(f"{API}/inventory?mode=real",
                                   headers=H(uid)).json()["items"]
                gift_item = inv[0] if inv else None
                if gift_item:
                    break
        if not gift_item:
            pytest.skip("Could not get a real-mode gift")

        wr = requests.post(f"{API}/inventory/withdraw",
                           json={"item_id": gift_item["id"]},
                           headers=H(uid))
        assert wr.status_code == 200, wr.text
        wd_id = wr.json()["withdrawal_id"]

        # Read back from admin
        admin = requests.get(f"{API}/admin/withdrawals",
                             headers={"X-ADMIN": ADMIN_SECRET})
        assert admin.status_code == 200
        wds = admin.json()["withdrawals"]
        record = next((w for w in wds if w["id"] == wd_id), None)
        assert record is not None
        # verification block present
        v = record["verification"]
        assert set(v.keys()) >= {
            "item_exists", "item_was_won_from_case",
            "case_opening_was_paid", "item_not_sold",
            "item_not_already_withdrawn", "not_duplicate",
        }
        # No paid invoices → suspicious=True
        assert record["suspicious"] is True
        assert "no_paid_topups" in record["fraud_flags"]
        # Short id format
        assert record["short_id"].startswith("WD-") and len(record["short_id"]) == 9
        # Source case name set
        assert record["source_case_name"]
        # email_sent should NOT be True (RESEND_API_KEY not configured).
        # The field is either absent or False.
        time.sleep(0.5)  # let the background task complete (if any)
        record2 = next((w for w in requests.get(
            f"{API}/admin/withdrawals",
            headers={"X-ADMIN": ADMIN_SECRET}).json()["withdrawals"]
            if w["id"] == wd_id), None)
        assert record2.get("email_sent") is not True

    def test_demo_withdraw_rejected(self):
        uid = _uid()
        auth(uid)
        # Open demo cases until we have a gift
        item = None
        for _ in range(20):
            r = requests.post(f"{API}/cases/open",
                              json={"case_id": "basic", "mode": "demo"},
                              headers=H(uid))
            assert r.status_code == 200
            if r.json()["reward"]["type"] == "gift":
                inv = requests.get(f"{API}/inventory?mode=demo",
                                   headers=H(uid)).json()["items"]
                if inv:
                    item = inv[0]
                    break
        if not item:
            pytest.skip("no demo gift")
        wr = requests.post(f"{API}/inventory/withdraw",
                           json={"item_id": item["id"]},
                           headers=H(uid))
        assert wr.status_code == 400
        assert "Real" in wr.text or "real" in wr.text.lower()


# ---------- Preserve: cases + live drops ----------
class TestPreserve:
    def test_cases_endpoint(self):
        r = requests.get(f"{API}/cases")
        assert r.status_code == 200
        ids = {c["id"] for c in r.json()["cases"]}
        assert {"daily", "basic", "lucky", "diamond", "cherry"} <= ids

    def test_live_drops(self):
        r = requests.get(f"{API}/live-drops")
        assert r.status_code == 200
        assert isinstance(r.json()["drops"], list)
