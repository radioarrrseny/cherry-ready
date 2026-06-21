"""Iter4 — Cherry Case focused tests:
- Mines multipliers (RTP 0.78, new floor formula)
- Live 5x5/1mine game multipliers via /reveal
- Crash cashout idempotency + lost path
- 5 sequential crash rounds: no consecutive duplicates
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _uid():
    return f"test_{uuid.uuid4().hex[:10]}"


def H(uid):
    return {"X-TG-ID": uid}


@pytest.fixture(scope="module")
def uid():
    u = _uid()
    r = requests.post(f"{API}/auth/telegram", json={"fallback_user_id": u, "fallback_username": "iter4"})
    assert r.status_code == 200, r.text
    return u


# --- Mines multiplier table via live game ---
# Use /mines/start + /reveal to exercise the same mines_multiplier() server-side.
def _start_mines(uid, size, mines, bet=100):
    r = requests.post(f"{API}/games/mines/start",
                      json={"bet": bet, "size": size, "mines": mines, "mode": "demo"},
                      headers=H(uid))
    assert r.status_code == 200, r.text
    return r.json()["game_id"]


def _reveal_safe(uid, gid, picks_needed, total_cells):
    """Reveal `picks_needed` safe tiles, retrying around bombs. Returns list of mults."""
    mults = []
    tried = set()
    idx = 0
    while len(mults) < picks_needed and len(tried) < total_cells:
        if idx in tried:
            idx += 1; continue
        tried.add(idx)
        r = requests.post(f"{API}/games/mines/reveal",
                          json={"game_id": gid, "index": idx},
                          headers=H(uid))
        if r.status_code != 200:
            idx += 1; continue
        j = r.json()
        if j.get("hit_bomb"):
            return None  # game over, retry
        mults.append(j["multiplier"])
        idx += 1
    return mults


@pytest.mark.parametrize("size,mines,expected_picks", [
    (5, 1, [1.01, 1.03, 1.04, 1.06, 1.07]),  # picks 1..5
    (7, 1, [1.01, 1.02, 1.03, 1.04, 1.05]),
    (5, 2, [1.02, 1.04, 1.06, 1.11]),         # picks 1..4 (4th is fair-driven)
])
def test_mines_multiplier_table(uid, size, mines, expected_picks):
    # Retry game start until we manage to reveal len(expected_picks) safe tiles
    for _attempt in range(10):
        gid = _start_mines(uid, size, mines)
        mults = _reveal_safe(uid, gid, len(expected_picks), size * size)
        if mults is None:
            continue
        if len(mults) == len(expected_picks):
            break
    else:
        pytest.skip(f"Could not collect {len(expected_picks)} safe reveals")
    for i, (got, exp) in enumerate(zip(mults, expected_picks), start=1):
        assert abs(got - exp) < 0.02, f"size={size} mines={mines} pick={i} got={got} expected={exp}"


def test_mines_high_setups():
    """Direct unit test of mines_multiplier(): 5/24=19.5, 7/48=38.22, 3/8=7.02."""
    import sys, importlib.util
    spec = importlib.util.spec_from_file_location("srv", "/app/backend/server.py")
    srv = importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
    assert abs(srv.mines_multiplier(5, 24, 1) - 19.5) < 0.05
    assert abs(srv.mines_multiplier(7, 48, 1) - 38.22) < 0.05
    assert abs(srv.mines_multiplier(3, 8, 1) - 7.02) < 0.05


# --- Crash cashout idempotency ---
def test_crash_cashout_before_after_idempotent(uid):
    # Start with controlled bet
    r = requests.post(f"{API}/games/crash/start", json={"bet": 100, "mode": "demo"}, headers=H(uid))
    assert r.status_code == 200
    d = r.json()
    gid = d["game_id"]
    crash_at = d["crash_at"]
    # Cashout before crash at 1.01 (always less than crash_at >= 1.01)
    target = 1.01 if crash_at > 1.01 else None
    if target is None:
        pytest.skip("crash_at too low")
    bal_before = requests.get(f"{API}/me", headers=H(uid)).json()["user"]["demo_balance"]
    r2 = requests.post(f"{API}/games/crash/cashout", json={"game_id": gid, "multiplier": target}, headers=H(uid))
    assert r2.status_code == 200, r2.text
    b = r2.json()
    assert b["lost"] is False
    assert b["win"] == int(100 * target)
    bal_after = requests.get(f"{API}/me", headers=H(uid)).json()["user"]["demo_balance"]
    assert bal_after - bal_before == b["win"]
    # Second cashout — idempotent
    r3 = requests.post(f"{API}/games/crash/cashout", json={"game_id": gid, "multiplier": target}, headers=H(uid))
    assert r3.status_code == 200
    b3 = r3.json()
    assert b3.get("already_cashed") is True
    assert b3["win"] == b["win"]
    bal_after2 = requests.get(f"{API}/me", headers=H(uid)).json()["user"]["demo_balance"]
    assert bal_after2 == bal_after, "balance must not change on idempotent re-cashout"


def test_crash_cashout_after_crash_returns_lost(uid):
    r = requests.post(f"{API}/games/crash/start", json={"bet": 100, "mode": "demo"}, headers=H(uid))
    assert r.status_code == 200
    d = r.json()
    gid = d["game_id"]
    crash_at = d["crash_at"]
    r2 = requests.post(f"{API}/games/crash/cashout",
                      json={"game_id": gid, "multiplier": crash_at + 0.5},
                      headers=H(uid))
    assert r2.status_code == 200
    b = r2.json()
    assert b["lost"] is True
    assert b["win"] == 0


def test_crash_no_consecutive_duplicates(uid):
    """5 sequential rounds: crash_at should never equal the prior."""
    prev = None
    for i in range(6):
        r = requests.post(f"{API}/games/crash/start", json={"bet": 50, "mode": "demo"}, headers=H(uid))
        assert r.status_code == 200
        ca = r.json()["crash_at"]
        if prev is not None:
            assert ca != prev, f"round {i}: duplicate {ca} == {prev}"
        prev = ca
        # immediately bust to free game state
        requests.post(f"{API}/games/crash/cashout",
                      json={"game_id": r.json()["game_id"], "multiplier": 999},
                      headers=H(uid))


# --- Regression: mines start size validation ---
def test_mines_start_invalid_size(uid):
    r = requests.post(f"{API}/games/mines/start",
                      json={"bet": 10, "size": 4, "mines": 2, "mode": "demo"},
                      headers=H(uid))
    assert r.status_code == 400


# --- Regression: admin add-stars ---
def test_admin_add_stars(uid):
    secret = "9hNiTxKMM9Qb9YB9zJgqPhuVpS3MUrlkY4LtV3wVU-k"
    r = requests.post(f"{API}/admin/users/{uid}/add-stars",
                      json={"amount": 500},
                      headers={"X-ADMIN": secret})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["balance"] >= 500


# --- Regression: slots returns reels + win ---
def test_slots_shape(uid):
    r = requests.post(f"{API}/games/slots/spin", json={"bet": 10, "mode": "demo"}, headers=H(uid))
    assert r.status_code == 200
    j = r.json()
    assert "reels" in j and len(j["reels"]) == 3
    assert "win" in j and isinstance(j["win"], int)
