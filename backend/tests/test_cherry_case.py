"""Backend tests for Cherry Case Telegram Mini App"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cherry-telegram-play.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _new_user_id():
    return f"test_{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="module")
def user_id():
    """Create a fresh user via auth fallback."""
    uid = _new_user_id()
    r = requests.post(f"{API}/auth/telegram", json={"fallback_user_id": uid, "fallback_username": "tester"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["balance"] == 0
    assert data["user"]["demo_balance"] == 1000000
    return uid


def H(uid):
    return {"X-TG-ID": uid}


def get_profile(uid):
    """Helper: GET /api/me returns {user: {...}}"""
    return requests.get(f"{API}/me", headers=H(uid)).json()["user"]


# ---------- AUTH ----------
class TestAuth:
    def test_auth_fallback_creates_user(self):
        uid = _new_user_id()
        r = requests.post(f"{API}/auth/telegram", json={"fallback_user_id": uid, "fallback_username": "u1"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["balance"] == 0
        assert u["demo_balance"] == 1000000


# ---------- CASES ----------
class TestCases:
    def test_list_cases(self):
        r = requests.get(f"{API}/cases")
        assert r.status_code == 200
        cases = r.json()["cases"]
        ids = {c["id"] for c in cases}
        assert {"daily", "basic", "lucky", "diamond", "cherry"}.issubset(ids)
        # No chance fields exposed
        for c in cases:
            for rw in c["rewards"]:
                assert "chance" not in rw, f"chance leaked in {c['id']}/{rw}"

    @pytest.mark.parametrize("case_id", ["basic", "lucky", "diamond", "cherry"])
    def test_open_case_demo(self, user_id, case_id):
        # get price
        cases = requests.get(f"{API}/cases").json()["cases"]
        case = next(c for c in cases if c["id"] == case_id)
        # ensure balance
        b_before = requests.get(f"{API}/profile", headers=H(user_id)).json()["demo_balance"]
        r = requests.post(f"{API}/cases/open", json={"case_id": case_id, "mode": "demo"}, headers=H(user_id))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reward" in data
        b_after = data.get("new_balance", data.get("demo_balance"))
        # Verify deduction (after possible stars-reward credit)
        prof = requests.get(f"{API}/profile", headers=H(user_id)).json()
        assert prof["demo_balance"] <= b_before  # decreased or net depending on reward
        # if gift, must show up in inventory
        if data["reward"].get("type") == "gift":
            inv = requests.get(f"{API}/inventory?mode=demo", headers=H(user_id)).json()
            assert any(i.get("reward_id") == data["reward"]["id"] or i.get("name") == data["reward"]["name"] for i in inv.get("items", inv if isinstance(inv, list) else []))

    def test_daily_cooldown(self, user_id):
        # First open of daily should succeed
        r1 = requests.post(f"{API}/cases/open", json={"case_id": "daily", "mode": "demo"}, headers=H(user_id))
        assert r1.status_code in (200, 429), r1.text
        # Second open must be 429 cooldown
        r2 = requests.post(f"{API}/cases/open", json={"case_id": "daily", "mode": "demo"}, headers=H(user_id))
        assert r2.status_code == 429
        body = r2.text.lower()
        assert "cooldown" in body


# ---------- INVENTORY ----------
class TestInventory:
    def test_inventory_list_and_sell(self, user_id):
        # Open cherry case to (likely) get a gift
        gift_item = None
        for _ in range(5):
            r = requests.post(f"{API}/cases/open", json={"case_id": "cherry", "mode": "demo"}, headers=H(user_id))
            if r.status_code == 200 and r.json()["reward"].get("type") == "gift":
                break
        inv_resp = requests.get(f"{API}/inventory?mode=demo", headers=H(user_id))
        assert inv_resp.status_code == 200
        items = inv_resp.json()
        items = items.get("items", items) if isinstance(items, dict) else items
        # Find an unsold gift
        unsold = [i for i in items if not i.get("sold") and not i.get("withdrawn")]
        if not unsold:
            pytest.skip("No unsold gift to sell")
        gift_item = unsold[0]
        item_id = gift_item.get("id") or gift_item.get("_id")
        val = gift_item["value"]
        bal_before = requests.get(f"{API}/profile", headers=H(user_id)).json()["demo_balance"]
        r = requests.post(f"{API}/inventory/sell", json={"item_id": item_id}, headers=H(user_id))
        assert r.status_code == 200, r.text
        bal_after = requests.get(f"{API}/profile", headers=H(user_id)).json()["demo_balance"]
        expected = round(val * 1.05)
        assert bal_after - bal_before == expected, f"expected +{expected}, got +{bal_after - bal_before}"

    def test_withdraw_demo_rejected(self, user_id):
        for _ in range(5):
            r = requests.post(f"{API}/cases/open", json={"case_id": "cherry", "mode": "demo"}, headers=H(user_id))
            if r.status_code == 200 and r.json()["reward"].get("type") == "gift":
                break
        items = requests.get(f"{API}/inventory?mode=demo", headers=H(user_id)).json()
        items = items.get("items", items) if isinstance(items, dict) else items
        unsold = [i for i in items if not i.get("sold") and not i.get("withdrawn")]
        if not unsold:
            pytest.skip("no item")
        item_id = unsold[0].get("id") or unsold[0].get("_id")
        r = requests.post(f"{API}/inventory/withdraw", json={"item_id": item_id}, headers=H(user_id))
        assert r.status_code == 400
        assert "Real Mode" in r.text or "real" in r.text.lower()


# ---------- CRASH ----------
class TestCrash:
    def test_crash_full_flow(self, user_id):
        r = requests.post(f"{API}/games/crash/start", json={"bet": 100, "mode": "demo"}, headers=H(user_id))
        assert r.status_code == 200, r.text
        d = r.json()
        gid = d.get("game_id")
        crash_at = d["crash_at"]
        assert gid and crash_at > 1.0
        # cashout below crash
        target = max(1.01, crash_at - 0.5) if crash_at > 1.5 else 1.01
        r2 = requests.post(f"{API}/games/crash/cashout", json={"game_id": gid, "multiplier": target}, headers=H(user_id))
        assert r2.status_code == 200
        body = r2.json()
        # Either win or lost depending on rounding
        assert "win" in body or "lost" in body or "status" in body

    def test_crash_lost_above_crash(self, user_id):
        r = requests.post(f"{API}/games/crash/start", json={"bet": 100, "mode": "demo"}, headers=H(user_id))
        assert r.status_code == 200
        d = r.json()
        gid = d["game_id"]
        crash_at = d["crash_at"]
        r2 = requests.post(f"{API}/games/crash/cashout", json={"game_id": gid, "multiplier": crash_at + 1.0}, headers=H(user_id))
        assert r2.status_code == 200
        body = r2.json()
        # Should indicate loss
        assert body.get("win", 0) == 0 or body.get("lost") or body.get("status") == "lost"


# ---------- MINES ----------
class TestMines:
    def test_mines_start_reveal_cashout(self, user_id):
        r = requests.post(f"{API}/games/mines/start", json={"bet": 100, "size": 3, "mines": 3, "mode": "demo"}, headers=H(user_id))
        assert r.status_code == 200, r.text
        d = r.json()
        gid = d.get("game_id")
        assert gid
        # Try cells; stop when one safe found
        safe_found = False
        for i in range(9):
            r = requests.post(f"{API}/games/mines/reveal", json={"game_id": gid, "cell": i}, headers=H(user_id))
            if r.status_code != 200:
                continue
            j = r.json()
            if j.get("safe") or j.get("multiplier"):
                safe_found = True
                break
            if j.get("mine") or j.get("status") == "lost":
                break
        if safe_found:
            r = requests.post(f"{API}/games/mines/cashout", json={"game_id": gid}, headers=H(user_id))
            assert r.status_code == 200
            assert "win" in r.json() or "multiplier" in r.json()


# ---------- SLOTS ----------
class TestSlots:
    def test_slots_spin(self, user_id):
        bal_before = requests.get(f"{API}/profile", headers=H(user_id)).json()["demo_balance"]
        r = requests.post(f"{API}/games/slots/spin", json={"bet": 100, "mode": "demo"}, headers=H(user_id))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reels" in d and len(d["reels"]) == 3
        assert "win" in d and isinstance(d["win"], (int, float))
        bal_after = requests.get(f"{API}/profile", headers=H(user_id)).json()["demo_balance"]
        assert bal_after == bal_before - 100 + d["win"]


# ---------- WHEEL ----------
class TestWheel:
    def test_wheel_segments(self):
        r = requests.get(f"{API}/games/wheel/segments")
        assert r.status_code == 200
        segs = r.json()
        segs = segs.get("segments", segs) if isinstance(segs, dict) else segs
        assert isinstance(segs, list) and len(segs) > 0

    def test_wheel_spin(self, user_id):
        r = requests.post(f"{API}/games/wheel/spin", json={"bet": 100, "mode": "demo"}, headers=H(user_id))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "segment_index" in d
        assert "label" in d
        assert "mult" in d
        assert "win" in d


# ---------- LIVE DROPS ----------
class TestLiveDrops:
    def test_list(self):
        r = requests.get(f"{API}/live-drops")
        assert r.status_code == 200
        body = r.json()
        items = body.get("drops", body) if isinstance(body, dict) else body
        assert isinstance(items, list)

    def test_simulate(self):
        r = requests.post(f"{API}/internal/simulate-drop")
        assert r.status_code in (200, 201), r.text


# ---------- RESET DEMO ----------
class TestResetDemo:
    def test_reset(self, user_id):
        # spend some
        requests.post(f"{API}/games/slots/spin", json={"bet": 100, "mode": "demo"}, headers=H(user_id))
        r = requests.post(f"{API}/profile/reset-demo", headers=H(user_id))
        assert r.status_code == 200, r.text
        prof = requests.get(f"{API}/profile", headers=H(user_id)).json()
        assert prof["demo_balance"] == 1000000
        inv = requests.get(f"{API}/inventory?mode=demo", headers=H(user_id)).json()
        items = inv.get("items", inv) if isinstance(inv, dict) else inv
        # all should be empty or sold/withdrawn (cleared)
        assert all(i.get("sold") or i.get("withdrawn") for i in items) or len(items) == 0
