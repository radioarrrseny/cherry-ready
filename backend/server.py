from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hmac
import hashlib
import json
import secrets as pysecrets
import random
from urllib.parse import unquote, parse_qsl
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
WITHDRAWAL_NOTIFY_EMAIL = os.environ.get('WITHDRAWAL_NOTIFY_EMAIL', 'arseny.yurevi4@gmail.com')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- GIFTS / CASES (single source of truth) ----------------
GIFTS = {
    "teddy_bear": {"id": "teddy_bear", "name": "Teddy Bear", "value": 15, "image": "https://i.postimg.cc/ZK7pZHvb/rkeker.jpg"},
    "heart": {"id": "heart", "name": "Heart", "value": 15, "image": "https://i.postimg.cc/MKPVx5fT/vcu.jpg"},
    "red_rose": {"id": "red_rose", "name": "Red Rose", "value": 25, "image": "https://i.postimg.cc/sD67ymGf/vucv.jpg"},
    "rocket": {"id": "rocket", "name": "Rocket", "value": 50, "image": "https://i.postimg.cc/5N7L1gQN/uauk.jpg"},
    "champagne": {"id": "champagne", "name": "Champagne", "value": 50, "image": "https://i.postimg.cc/BQYHspPt/kr.jpg"},
    "diamond": {"id": "diamond", "name": "Diamond", "value": 100, "image": "https://i.postimg.cc/Pr3Yhyv5/oenlg.jpg"},
    "cup": {"id": "cup", "name": "Cup", "value": 100, "image": "https://i.postimg.cc/8PKMD4fc/oen.jpg"},
    "engagement_ring": {"id": "engagement_ring", "name": "Engagement Ring", "value": 100, "image": "https://i.postimg.cc/kX1K9sRB/rke.jpg"},
    "pool_float": {"id": "pool_float", "name": "Pool Float", "value": 370, "image": "https://i.postimg.cc/QMRqDbPS/ukppku.jpg"},
    "whip_cupcake": {"id": "whip_cupcake", "name": "Whip Cupcake", "value": 379, "image": "https://i.postimg.cc/kggsvDKh/ruuk.jpg"},
    "mousse_cake": {"id": "mousse_cake", "name": "Mousse Cake", "value": 575, "image": "https://i.postimg.cc/nckTmqjx/ukpku.jpg"},
    "cookie_heart": {"id": "cookie_heart", "name": "Cookie Heart", "value": 500, "image": "https://i.postimg.cc/65wYTMQR/upkpkupk.jpg"},
    "spring_basket": {"id": "spring_basket", "name": "Spring Basket", "value": 645, "image": "https://i.postimg.cc/x8VgvR3V/pu.jpg"},
    "restless_jar": {"id": "restless_jar", "name": "Restless Jar", "value": 619, "image": "https://i.postimg.cc/5tGs01Hs/popao.jpg"},
    "homemade_cake": {"id": "homemade_cake", "name": "Homemade Cake", "value": 648, "image": "https://i.postimg.cc/bYSK1VpP/fypv.jpg"},
    "toy_bear": {"id": "toy_bear", "name": "Toy Bear", "value": 3578, "image": "https://i.postimg.cc/mDvpdRB1/fukpukpukp.jpg"},
    "money_pot": {"id": "money_pot", "name": "Money Pot", "value": 453, "image": "https://i.postimg.cc/SQ9vnXfp/pukpukpku.jpg"},
    "clover_pin": {"id": "clover_pin", "name": "Clover Pin", "value": 555, "image": "https://i.postimg.cc/YS4xTVXB/ukrurku.jpg"},
    "kissed_frog": {"id": "kissed_frog", "name": "Kissed Frog", "value": 4841, "image": "https://i.postimg.cc/Kz6p9FF6/pagna.jpg"},
    "fresh_socks": {"id": "fresh_socks", "name": "Fresh Socks", "value": 526, "image": "https://i.postimg.cc/9MRNtz3B/ure.jpg"},
    "light_sword": {"id": "light_sword", "name": "Light Sword", "value": 780, "image": "https://i.postimg.cc/FKnBL36K/ukp.jpg"},
    "vice_cream": {"id": "vice_cream", "name": "Vice Cream", "value": 350, "image": "https://i.postimg.cc/prvYhdPd/pukpkupk.jpg"},
}

# Star-reward "pseudo-gifts" for Daily / Basic cases (not stored in inventory, paid out directly)
STAR_REWARDS = {
    "stars_2": {"id": "stars_2", "name": "2 Stars", "type": "stars", "min": 2, "max": 2, "image": "https://i.postimg.cc/QtJQpJFL/IMG-20260611-171554-195.jpg"},
    "stars_3": {"id": "stars_3", "name": "3 Stars", "type": "stars", "min": 3, "max": 3, "image": "https://i.postimg.cc/QtJQpJFL/IMG-20260611-171554-195.jpg"},
    "stars_4": {"id": "stars_4", "name": "4 Stars", "type": "stars", "min": 4, "max": 4, "image": "https://i.postimg.cc/QtJQpJFL/IMG-20260611-171554-195.jpg"},
    "stars_5": {"id": "stars_5", "name": "5 Stars", "type": "stars", "min": 5, "max": 5, "image": "https://i.postimg.cc/QtJQpJFL/IMG-20260611-171554-195.jpg"},
    "stars_10": {"id": "stars_10", "name": "10 Stars", "type": "stars", "min": 10, "max": 10, "image": "https://i.postimg.cc/cLPBZHqC/IMG-20260611-171551-274.jpg"},
    "stars_20_50": {"id": "stars_20_50", "name": "20-50 Stars", "type": "stars", "min": 20, "max": 50, "image": "https://i.postimg.cc/cLPBZHqC/IMG-20260611-171551-274.jpg"},
    "stars_50_100": {"id": "stars_50_100", "name": "50-100 Stars", "type": "stars", "min": 50, "max": 100, "image": "https://i.postimg.cc/441Ptscc/IMG-20260611-171548-929.jpg"},
    "stars_150": {"id": "stars_150", "name": "150 Stars", "type": "stars", "min": 150, "max": 150, "image": "https://i.postimg.cc/441Ptscc/IMG-20260611-171548-929.jpg"},
}

CASES = {
    "daily": {
        "id": "daily", "name": "Daily Case", "price": 1,
        "image": "https://i.postimg.cc/L63yNyR4/file-00000000b2bc7246b4ee3ddc44dc4a0f.png",
        "cooldown_hours": 24,
        "rewards": [
            {"ref": "stars_2", "chance": 50.0, "type": "stars"},
            {"ref": "stars_3", "chance": 25.0, "type": "stars"},
            {"ref": "stars_4", "chance": 12.0, "type": "stars"},
            {"ref": "stars_5", "chance": 5.0, "type": "stars"},
            {"ref": "stars_10", "chance": 3.0, "type": "stars"},
            {"ref": "teddy_bear", "chance": 2.0, "type": "gift"},
            {"ref": "red_rose", "chance": 1.0, "type": "gift"},
            {"ref": "heart", "chance": 1.0, "type": "gift"},
            {"ref": "stars_20_50", "chance": 0.5, "type": "stars"},
            {"ref": "rocket", "chance": 0.45, "type": "gift"},
            {"ref": "stars_50_100", "chance": 0.05, "type": "stars"},
        ],
    },
    "basic": {
        "id": "basic", "name": "Basic Case", "price": 39,
        "image": "https://i.postimg.cc/N0MPyRWd/file-000000003d5c72469cb6cf61e7b6ff01.png",
        "rewards": [
            {"ref": "teddy_bear", "chance": 92.0, "type": "gift"},
            {"ref": "red_rose", "chance": 4.0, "type": "gift"},
            {"ref": "rocket", "chance": 1.5, "type": "gift"},
            {"ref": "champagne", "chance": 1.0, "type": "gift"},
            {"ref": "cup", "chance": 0.8, "type": "gift"},
            {"ref": "engagement_ring", "chance": 0.5, "type": "gift"},
            {"ref": "diamond", "chance": 0.1, "type": "gift"},
            {"ref": "stars_150", "chance": 0.1, "type": "stars"},
        ],
    },
    "lucky": {
        "id": "lucky", "name": "Lucky Case", "price": 149,
        "image": "https://i.postimg.cc/VsMZbfVc/file-000000003e1872468fda63801dc50fbc.png",
        "rewards": [
            {"ref": "diamond", "chance": 33.3, "type": "gift"},
            {"ref": "cup", "chance": 33.3, "type": "gift"},
            {"ref": "engagement_ring", "chance": 33.0, "type": "gift"},
            {"ref": "money_pot", "chance": 0.3, "type": "gift"},
            {"ref": "clover_pin", "chance": 0.0999, "type": "gift"},
            {"ref": "kissed_frog", "chance": 0.0001, "type": "gift"},
        ],
    },
    "diamond": {
        "id": "diamond", "name": "Diamond Case", "price": 249,
        "image": "https://i.postimg.cc/44hqbbmy/file-000000006b447246a40f79c382ec0e4b.png",
        "rewards": [
            {"ref": "engagement_ring", "chance": 39.7, "type": "gift"},
            {"ref": "diamond", "chance": 39.7, "type": "gift"},
            {"ref": "cup", "chance": 19.5, "type": "gift"},
            {"ref": "vice_cream", "chance": 0.8, "type": "gift"},
            {"ref": "fresh_socks", "chance": 0.25, "type": "gift"},
            {"ref": "light_sword", "chance": 0.05, "type": "gift"},
        ],
    },
    "cherry": {
        "id": "cherry", "name": "Cherry Case", "price": 449,
        "image": "https://i.postimg.cc/ZRQHvgrW/file-00000000725c724695fe99ac1d02e253.png",
        "rewards": [
            {"ref": "pool_float", "chance": 48.0, "type": "gift"},
            {"ref": "whip_cupcake", "chance": 48.0, "type": "gift"},
            {"ref": "mousse_cake", "chance": 2.0, "type": "gift"},
            {"ref": "cookie_heart", "chance": 1.0, "type": "gift"},
            {"ref": "spring_basket", "chance": 0.7, "type": "gift"},
            {"ref": "restless_jar", "chance": 0.2, "type": "gift"},
            {"ref": "homemade_cake", "chance": 0.0999, "type": "gift"},
            {"ref": "toy_bear", "chance": 0.0001, "type": "gift"},
        ],
    },
}

CASE_ORDER = ["daily", "basic", "lucky", "diamond", "cherry"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def verify_telegram_init_data(init_data: str) -> Optional[Dict[str, Any]]:
    """Validate Telegram initData. Returns user dict on success, None otherwise."""
    if not init_data or not TELEGRAM_BOT_TOKEN:
        return None
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed, received_hash):
            return None
        user_json = parsed.get("user")
        if not user_json:
            return None
        return json.loads(user_json)
    except Exception:
        logger.exception("initData verification failed")
        return None


# ---------------- Models ----------------
class TelegramAuth(BaseModel):
    init_data: Optional[str] = None
    # Fallback for dev: allow direct user id
    fallback_user_id: Optional[str] = None
    fallback_username: Optional[str] = None


class CaseOpenReq(BaseModel):
    case_id: str
    mode: str = "demo"  # "demo" | "real"


class SellReq(BaseModel):
    item_id: str
    mode: str = "demo"


class WithdrawReq(BaseModel):
    item_id: str


class TopUpReq(BaseModel):
    amount: int  # Stars


class CrashBetReq(BaseModel):
    bet: int
    mode: str = "demo"


class CrashCashoutReq(BaseModel):
    multiplier: float


class SlotsReq(BaseModel):
    bet: int
    mode: str = "demo"


class WheelReq(BaseModel):
    bet: int
    mode: str = "demo"


class MinesStartReq(BaseModel):
    bet: int
    size: int  # 3, 4, 5
    mines: int
    mode: str = "demo"


class MinesRevealReq(BaseModel):
    game_id: str
    index: int


class MinesCashoutReq(BaseModel):
    game_id: str


# ---------------- User helpers ----------------
async def get_or_create_user(tg_id: str, username: str = "", first_name: str = "") -> Dict[str, Any]:
    user = await db.users.find_one({"tg_id": tg_id}, {"_id": 0})
    if user:
        return user
    user = {
        "id": str(uuid.uuid4()),
        "tg_id": tg_id,
        "username": username,
        "first_name": first_name,
        "balance": 0,
        "deposited_balance": 0,
        "demo_balance": 1_000_000,
        "daily_cooldown": None,
        "demo_daily_cooldown": None,
        "created_at": utc_now_iso(),
    }
    await db.users.insert_one(user.copy())
    return user


async def get_user(tg_id: str) -> Dict[str, Any]:
    user = await db.users.find_one({"tg_id": tg_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "user not found")
    # Backfill missing fields for legacy users (no DB migration required)
    if "deposited_balance" not in user:
        await db.users.update_one({"tg_id": tg_id}, {"$set": {"deposited_balance": 0}})
        user["deposited_balance"] = 0
    return user


async def spend_balance(tg_id: str, mode: str, amount: int) -> None:
    """Deduct `amount` from the user's effective balance.

    Real mode: spend `deposited_balance` first, then the remaining (bonus) from `balance`.
    Demo mode: spend `demo_balance` only (no deposit tracking in demo).
    """
    if amount <= 0:
        return
    if mode == "demo":
        await db.users.update_one({"tg_id": tg_id}, {"$inc": {"demo_balance": -amount}})
        return
    # Real mode — split spend: deposited first, then bonus.
    u = await db.users.find_one({"tg_id": tg_id}, {"_id": 0, "balance": 1, "deposited_balance": 1})
    dep = int((u or {}).get("deposited_balance", 0) or 0)
    from_dep = min(dep, amount)
    # Always decrement total balance by full amount.
    inc = {"balance": -amount}
    if from_dep > 0:
        inc["deposited_balance"] = -from_dep
    await db.users.update_one({"tg_id": tg_id}, {"$inc": inc})


async def get_user_from_header(x_tg_id: Optional[str]) -> Dict[str, Any]:
    if not x_tg_id:
        raise HTTPException(401, "Missing X-TG-ID header")
    return await get_user(x_tg_id)


def weighted_pick(rewards: List[Dict[str, Any]]) -> Dict[str, Any]:
    r = random.uniform(0, 100)
    cumulative = 0.0
    for rw in rewards:
        cumulative += rw["chance"]
        if r <= cumulative:
            return rw
    return rewards[-1]


def materialize_reward(reward_def: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a reward def into a concrete reward payload (gift or stars)."""
    ref = reward_def["ref"]
    if reward_def["type"] == "stars":
        sr = STAR_REWARDS[ref]
        amount = random.randint(sr["min"], sr["max"])
        return {
            "type": "stars",
            "id": ref,
            "name": sr["name"],
            "amount": amount,
            "value": amount,
            "image": sr["image"],
        }
    g = GIFTS[ref]
    return {
        "type": "gift",
        "id": g["id"],
        "name": g["name"],
        "value": g["value"],
        "image": g["image"],
    }


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"ok": True, "app": "Cherry Case"}


@api_router.post("/auth/telegram")
async def auth_telegram(payload: TelegramAuth):
    user_data = None
    if payload.init_data and TELEGRAM_BOT_TOKEN:
        user_data = verify_telegram_init_data(payload.init_data)
    if not user_data:
        # Dev fallback when no Telegram env: allow client-provided id (sandbox/preview)
        if payload.fallback_user_id:
            user_data = {
                "id": payload.fallback_user_id,
                "username": payload.fallback_username or "",
                "first_name": payload.fallback_username or "Guest",
            }
        else:
            raise HTTPException(401, "Invalid initData and no fallback")
    user = await get_or_create_user(
        str(user_data["id"]),
        user_data.get("username", ""),
        user_data.get("first_name", ""),
    )
    return {"user": user}


@api_router.get("/me")
async def me(x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    return {"user": user}


@api_router.get("/cases")
async def list_cases():
    out = []
    # Aliases that hide individual small-star drops behind grouped previews
    DAILY_PREVIEW_GROUPS = {
        "stars_2": None, "stars_3": None, "stars_4": None, "stars_5": None,
        "stars_10": {"id": "stars_1_10_preview", "name": "1-10 Stars", "value": 10, "image": "https://i.postimg.cc/QtJQpJFL/IMG-20260611-171554-195.jpg"},
        "stars_20_50": {"id": "stars_10_50_preview", "name": "10-50 Stars", "value": 50, "image": "https://i.postimg.cc/cLPBZHqC/IMG-20260611-171551-274.jpg"},
    }
    for cid in CASE_ORDER:
        c = CASES[cid].copy()
        rewards = []
        seen_preview = set()
        for rw in c["rewards"]:
            if cid == "daily" and rw["ref"] in DAILY_PREVIEW_GROUPS:
                grp = DAILY_PREVIEW_GROUPS[rw["ref"]]
                if grp is None: continue
                if grp["id"] in seen_preview: continue
                seen_preview.add(grp["id"])
                rewards.append({"type": "stars", **grp})
                continue
            if rw["type"] == "stars":
                sr = STAR_REWARDS[rw["ref"]]
                # In daily preview: relabel min/max ranges to required groups
                if cid == "daily" and rw["ref"] == "stars_50_100":
                    rewards.append({"type": "stars", "id": rw["ref"], "name": "50-100 Stars", "value": 100, "image": sr["image"]})
                else:
                    rewards.append({"type": "stars", "id": rw["ref"], "name": sr["name"], "value": sr["max"], "image": sr["image"]})
            else:
                g = GIFTS[rw["ref"]]
                rewards.append({"type": "gift", "id": g["id"], "name": g["name"], "value": g["value"], "image": g["image"]})
        c["rewards"] = rewards
        out.append(c)
    return {"cases": out}


@api_router.get("/cases/all-gifts")
async def all_gifts():
    return {"gifts": list(GIFTS.values())}


def _balance_field(mode: str) -> str:
    return "demo_balance" if mode == "demo" else "balance"


def _cooldown_field(mode: str) -> str:
    return "demo_daily_cooldown" if mode == "demo" else "daily_cooldown"


@api_router.post("/cases/open")
async def open_case(req: CaseOpenReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    case = CASES.get(req.case_id)
    if not case:
        raise HTTPException(404, "case not found")
    if req.mode not in ("demo", "real"):
        raise HTTPException(400, "mode must be demo or real")

    bal_field = _balance_field(req.mode)
    cd_field = _cooldown_field(req.mode)

    # Daily cooldown
    if case["id"] == "daily":
        cd = user.get(cd_field)
        if cd:
            cd_dt = datetime.fromisoformat(cd)
            if cd_dt > datetime.now(timezone.utc):
                remaining = int((cd_dt - datetime.now(timezone.utc)).total_seconds())
                raise HTTPException(429, f"cooldown:{remaining}")

    price = case["price"]
    if user[bal_field] < price:
        raise HTTPException(400, "insufficient balance")

    # Deduct (real mode spends deposited first via spend_balance; demo decrements demo_balance)
    await spend_balance(user["tg_id"], req.mode, price)
    update = {}
    if case["id"] == "daily":
        update[cd_field] = (datetime.now(timezone.utc) + timedelta(hours=case["cooldown_hours"])).isoformat()

    # Pick reward
    reward_def = weighted_pick(case["rewards"])
    reward = materialize_reward(reward_def)

    # Apply reward
    if reward["type"] == "stars":
        # Star rewards are BONUS — only credit `balance` (deposited unchanged)
        await db.users.update_one({"tg_id": user["tg_id"]}, {"$inc": {bal_field: reward["amount"]}})
    else:
        # Add inventory item
        item = {
            "id": str(uuid.uuid4()),
            "tg_id": user["tg_id"],
            "mode": req.mode,
            "gift_id": reward["id"],
            "name": reward["name"],
            "value": reward["value"],
            "image": reward["image"],
            "status": "owned",
            "case_id": case["id"],
            "case_name": case["name"],
            "created_at": utc_now_iso(),
        }
        await db.inventory.insert_one(item.copy())

    if update:
        await db.users.update_one({"tg_id": user["tg_id"]}, {"$set": update})

    # Stats log
    await db.case_opens.insert_one({
        "id": str(uuid.uuid4()),
        "tg_id": user["tg_id"],
        "mode": req.mode,
        "case_id": case["id"],
        "price": price,
        "reward_type": reward["type"],
        "reward_name": reward["name"],
        "reward_value": int(reward.get("value", 0) or reward.get("amount", 0)),
        "reward_image": reward["image"],
        "created_at": utc_now_iso(),
    })

    # Add to live drops (real mode only feed, but include demo too with anon flag)
    drop = {
        "id": str(uuid.uuid4()),
        "name": reward["name"],
        "value": reward["value"],
        "image": reward["image"],
        "case_id": case["id"],
        "mode": req.mode,
        "created_at": utc_now_iso(),
    }
    await db.live_drops.insert_one(drop.copy())

    updated_user = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"reward": reward, "user": updated_user}


@api_router.get("/inventory")
async def inventory(mode: str = "demo", x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    items = await db.inventory.find(
        {"tg_id": user["tg_id"], "mode": mode, "status": "owned"}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"items": items}


@api_router.post("/inventory/sell")
async def sell_item(req: SellReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    item = await db.inventory.find_one({"id": req.item_id, "tg_id": user["tg_id"], "status": "owned"}, {"_id": 0})
    if not item:
        raise HTTPException(404, "item not found or locked")
    sell_value = int(round(item["value"] * 1.05))
    bal_field = _balance_field(item["mode"])
    new_balance = user[bal_field] + sell_value
    await db.users.update_one({"tg_id": user["tg_id"]}, {"$set": {bal_field: new_balance}})
    await db.inventory.update_one({"id": req.item_id}, {"$set": {"status": "sold", "sold_at": utc_now_iso()}})
    updated_user = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"sell_value": sell_value, "user": updated_user}


@api_router.post("/inventory/withdraw")
async def withdraw_item(req: WithdrawReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    item = await db.inventory.find_one({"id": req.item_id, "tg_id": user["tg_id"]}, {"_id": 0})
    if not item:
        raise HTTPException(404, "item not found")
    if item["status"] != "owned":
        raise HTTPException(400, "item not available for withdraw")
    if item["mode"] != "real":
        raise HTTPException(400, "Withdraw available only in Real Mode")

    # Verification checks (computed BEFORE locking so booleans reflect pre-state)
    co = await db.case_opens.find_one(
        {"tg_id": user["tg_id"], "mode": "real",
         "reward_name": item["name"], "reward_value": item["value"]},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    paid_invoices = await db.invoices.count_documents({"tg_id": user["tg_id"], "status": "paid"})
    total_deposits = 0
    async for inv in db.invoices.find({"tg_id": user["tg_id"], "status": "paid"}, {"_id": 0, "amount": 1}):
        total_deposits += int(inv.get("amount", 0) or 0)
    dup_req = await db.withdrawals.find_one(
        {"item_id": req.item_id, "status": {"$in": ["pending", "approved", "sent"]}}
    )
    inv_value = 0
    async for it in db.inventory.find({"tg_id": user["tg_id"], "mode": "real", "status": {"$in": ["owned", "locked"]}}, {"_id": 0, "value": 1}):
        inv_value += int(it.get("value", 0) or 0)

    item_exists = True  # already validated above
    item_was_won_from_case = co is not None
    case_opening_was_paid = paid_invoices > 0
    item_not_sold = item["status"] != "sold"
    item_not_already_withdrawn = item["status"] not in ("withdrawn", "locked")
    not_duplicate = dup_req is None

    fraud_flags = []
    if not item_was_won_from_case: fraud_flags.append("no_matching_case_open")
    if not case_opening_was_paid: fraud_flags.append("no_paid_topups")
    if dup_req: fraud_flags.append("duplicate_request")

    suspicious = bool(fraud_flags) or not all([
        item_exists, item_was_won_from_case, case_opening_was_paid,
        item_not_sold, item_not_already_withdrawn, not_duplicate,
    ])

    # Lock the item
    await db.inventory.update_one(
        {"id": req.item_id},
        {"$set": {"status": "locked", "withdraw_at": utc_now_iso()}},
    )

    # Resolve source case (item stores case_id for new opens; fall back to case_open lookup)
    src_case_id = item.get("case_id") or (co.get("case_id") if co else None)
    src_case_name = item.get("case_name")
    if not src_case_name and src_case_id and src_case_id in CASES:
        src_case_name = CASES[src_case_id]["name"]
    source_case_display = src_case_name or "Unknown — needs manual review"

    # Friendly request id
    suffix = uuid.uuid4().hex[:6].upper()
    request_short_id = f"WD-{suffix}"
    created_at_iso = utc_now_iso()
    created_at_human = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    wr = {
        "id": str(uuid.uuid4()),
        "short_id": request_short_id,
        "tg_id": user["tg_id"],
        "username": user.get("username", ""),
        "first_name": user.get("first_name", ""),
        "item_id": req.item_id,
        "gift_name": item["name"],
        "gift_value": item["value"],
        "gift_image": item["image"],
        "source_case_id": src_case_id,
        "source_case_name": source_case_display,
        "status": "pending",
        "fraud_flags": fraud_flags,
        "user_balance": user.get("balance", 0),
        "total_deposits": total_deposits,
        "inventory_value": inv_value,
        "verification": {
            "item_exists": item_exists,
            "item_was_won_from_case": item_was_won_from_case,
            "case_opening_was_paid": case_opening_was_paid,
            "item_not_sold": item_not_sold,
            "item_not_already_withdrawn": item_not_already_withdrawn,
            "not_duplicate": not_duplicate,
        },
        "suspicious": suspicious,
        "created_at": created_at_iso,
    }
    await db.withdrawals.insert_one(wr.copy())
    # Queue admin notification
    await db.admin_notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "withdrawal_request",
        "withdrawal_id": wr["id"],
        "tg_id": user["tg_id"],
        "gift_name": item["name"],
        "gift_value": item["value"],
        "fraud_flags": fraud_flags,
        "read": False,
        "created_at": created_at_iso,
    })

    # Send admin email — Real Mode only, on initial create (never on status change), never on dup
    # `dup_req` already enforces "not duplicate". If RESEND_API_KEY missing, log and continue.
    if item["mode"] == "real" and not dup_req:
        asyncio.create_task(
            _send_withdrawal_email(wr, user, source_case_display, created_at_human)
        )

    return {"ok": True, "withdrawal_id": wr["id"], "status": "pending"}


def _yn(v: bool) -> str:
    return "yes" if v else "no"


async def _send_withdrawal_email(
    wr: Dict[str, Any], user: Dict[str, Any], source_case: str, created_at_human: str
) -> None:
    """Send Resend email for a real-mode withdrawal request. Failures are logged, never raised."""
    if not RESEND_API_KEY:
        logger.warning("Email skipped: RESEND_API_KEY not configured")
        return
    try:
        v = wr.get("verification", {})
        username = user.get("username") or "Not available yet"
        if username and not username.startswith("@") and username != "Not available yet":
            username = f"@{username}"
        tg_id = user.get("tg_id") or "Not available yet"

        lines = [
            "Cherry Case — New Withdrawal Request",
            "",
            f"Telegram username: {username}",
            f"Telegram ID: {tg_id}",
            "",
            "Gift withdrawn:",
            f"  • Name: {wr['gift_name']}",
            f"  • Value: {wr['gift_value']} Stars",
            f"  • Image: {wr['gift_image']}",
            "",
            f"Source case: {source_case}",
            f"Total deposits: {wr.get('total_deposits', 0)} Stars",
            f"Current balance: {wr.get('user_balance', 0)} Stars",
            f"Inventory value: {wr.get('inventory_value', 0)} Stars",
            "",
            f"Request ID: {wr.get('short_id', wr['id'])}",
            f"Created at: {created_at_human}",
            "",
            "Verification:",
            f"  • Item exists in real inventory: {_yn(v.get('item_exists', False))}",
            f"  • Item was won from a valid case: {_yn(v.get('item_was_won_from_case', False))}",
            f"  • Case opening was paid: {_yn(v.get('case_opening_was_paid', False))}",
            f"  • Item was not already sold: {_yn(v.get('item_not_sold', False))}",
            f"  • Item was not already withdrawn: {_yn(v.get('item_not_already_withdrawn', False))}",
            f"  • Request is not duplicate: {_yn(v.get('not_duplicate', False))}",
        ]
        if wr.get("suspicious"):
            lines += ["", "WARNING: Suspicious withdrawal request. Manual review required."]

        text_body = "\n".join(lines)
        html_body = (
            "<pre style=\"font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"
            "white-space:pre-wrap;line-height:1.45;font-size:14px;"
            "background:#fff;color:#111;padding:16px;border-radius:8px;"
            "border:1px solid #eee;\">"
            f"{text_body}"
            "</pre>"
        )

        params = {
            "from": SENDER_EMAIL,
            "to": [WITHDRAWAL_NOTIFY_EMAIL],
            "subject": "Cherry Case Withdrawal Request",
            "html": html_body,
            "text": text_body,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        await db.withdrawals.update_one(
            {"id": wr["id"]},
            {"$set": {"email_sent": True, "email_id": (result or {}).get("id")}},
        )
        logger.info(f"[email] withdrawal {wr.get('short_id')} -> {WITHDRAWAL_NOTIFY_EMAIL}")
    except Exception as e:
        logger.error(f"Failed to send withdrawal email for {wr.get('id')}: {e}")
        await db.withdrawals.update_one(
            {"id": wr["id"]},
            {"$set": {"email_sent": False, "email_error": str(e)[:500]}},
        )


# ---------------- ADMIN ----------------
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")

def _check_admin(x_admin: Optional[str]):
    if not ADMIN_SECRET or not x_admin or not hmac.compare_digest(x_admin, ADMIN_SECRET):
        raise HTTPException(401, "admin only")


@api_router.post("/admin/login")
async def admin_login(payload: Dict[str, Any]):
    secret = payload.get("secret", "")
    if not ADMIN_SECRET or not hmac.compare_digest(secret, ADMIN_SECRET):
        raise HTTPException(401, "invalid secret")
    return {"ok": True}


@api_router.post("/admin/verify")
async def admin_verify(payload: Dict[str, Any]):
    """Validate ADMIN_SECRET from the hidden promo-code modal."""
    secret = payload.get("secret", "")
    if not ADMIN_SECRET or not hmac.compare_digest(secret, ADMIN_SECRET):
        raise HTTPException(401, "invalid secret")
    return {"ok": True}


class AdminAddStarsReq(BaseModel):
    amount: int


@api_router.post("/admin/users/{tg_id}/add-stars")
async def admin_add_stars(
    tg_id: str,
    req: AdminAddStarsReq,
    x_admin: Optional[str] = Header(None, alias="X-ADMIN"),
):
    _check_admin(x_admin)
    if req.amount is None or req.amount <= 0:
        raise HTTPException(400, "amount must be positive")
    user = await db.users.find_one({"tg_id": tg_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "user not found")
    await db.users.update_one({"tg_id": tg_id}, {"$inc": {"balance": req.amount}})
    updated = await db.users.find_one({"tg_id": tg_id}, {"_id": 0})
    # Log admin action
    await db.admin_actions.insert_one({
        "id": str(uuid.uuid4()),
        "action": "add_stars",
        "tg_id": tg_id,
        "username": user.get("username", ""),
        "amount": req.amount,
        "balance_after": updated.get("balance", 0),
        "created_at": utc_now_iso(),
    })
    logger.info(f"[admin] +{req.amount} stars -> tg_id={tg_id} new_balance={updated.get('balance')}")
    return {"ok": True, "user": updated, "added": req.amount}


@api_router.get("/admin/withdrawals")
async def admin_list_withdrawals(status: Optional[str] = None, x_admin: Optional[str] = Header(None, alias="X-ADMIN")):
    _check_admin(x_admin)
    q = {} if not status else {"status": status}
    rows = await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"withdrawals": rows}


class AdminWithdrawAction(BaseModel):
    withdrawal_id: str
    action: str  # approve | sent | reject


@api_router.post("/admin/withdrawals/action")
async def admin_withdraw_action(req: AdminWithdrawAction, x_admin: Optional[str] = Header(None, alias="X-ADMIN")):
    _check_admin(x_admin)
    wr = await db.withdrawals.find_one({"id": req.withdrawal_id}, {"_id": 0})
    if not wr:
        raise HTTPException(404, "not found")
    new_status = {"approve": "approved", "sent": "sent", "reject": "rejected"}.get(req.action)
    if not new_status:
        raise HTTPException(400, "bad action")
    await db.withdrawals.update_one({"id": req.withdrawal_id}, {"$set": {"status": new_status, "updated_at": utc_now_iso()}})
    if new_status == "sent":
        await db.inventory.update_one({"id": wr["item_id"]}, {"$set": {"status": "withdrawn"}})
    elif new_status == "rejected":
        # return item to inventory
        await db.inventory.update_one({"id": wr["item_id"]}, {"$set": {"status": "owned"}})
    return {"ok": True, "status": new_status}


@api_router.get("/admin/player/{tg_id}")
async def admin_player(tg_id: str, x_admin: Optional[str] = Header(None, alias="X-ADMIN")):
    _check_admin(x_admin)
    u = await db.users.find_one({"tg_id": tg_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "user not found")
    inv = await db.inventory.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    wds = await db.withdrawals.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    opens = await db.case_opens.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    invoices = await db.invoices.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    crash = await db.crash_games.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    mines = await db.mines_games.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    slots = await db.slots_games.find({"tg_id": tg_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Fraud signals
    paid = [i for i in invoices if i.get("status") == "paid"]
    flags = []
    if wds and not paid: flags.append("withdrawals_without_topups")
    rare_wins = [o for o in opens if o.get("reward_value", 0) >= 1000]
    if len(rare_wins) >= 3:
        flags.append("many_rare_wins")
    # Derive bonus balance
    dep = int(u.get("deposited_balance", 0) or 0)
    total = int(u.get("balance", 0) or 0)
    u["bonus_balance"] = max(0, total - dep)
    return {
        "user": u,
        "inventory": inv,
        "withdrawals": wds,
        "case_opens": opens,
        "invoices": invoices,
        "crash": crash,
        "mines": mines,
        "slots": slots,
        "fraud_flags": flags,
    }


@api_router.get("/admin/users")
async def admin_users(x_admin: Optional[str] = Header(None, alias="X-ADMIN")):
    _check_admin(x_admin)
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for u in users:
        dep = int(u.get("deposited_balance", 0) or 0)
        u["deposited_balance"] = dep
        total = int(u.get("balance", 0) or 0)
        u["bonus_balance"] = max(0, total - dep)
    return {"users": users}


# ---------------- User withdrawal status (for client UI) ----------------
@api_router.get("/withdrawals/mine")
async def my_withdrawals(x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    rows = await db.withdrawals.find({"tg_id": user["tg_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"withdrawals": rows}


@api_router.get("/live-drops")
async def get_live_drops():
    drops = await db.live_drops.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"drops": drops}


# ---------------- Payments (Telegram Stars) ----------------
@api_router.post("/payments/create-invoice")
async def create_invoice(req: TopUpReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    if req.amount <= 0:
        raise HTTPException(400, "amount must be positive")
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(503, "Payments not configured. Set TELEGRAM_BOT_TOKEN in backend/.env")
    payload_token = f"{user['tg_id']}:{req.amount}:{pysecrets.token_hex(6)}"
    await db.invoices.insert_one({
        "id": str(uuid.uuid4()),
        "tg_id": user["tg_id"],
        "amount": req.amount,
        "payload": payload_token,
        "status": "created",
        "created_at": utc_now_iso(),
    })
    async with httpx.AsyncClient(timeout=20) as cli:
        r = await cli.post(f"{TELEGRAM_API_URL}/createInvoiceLink", json={
            "title": "Cherry Case Top-up",
            "description": f"{req.amount} Telegram Stars",
            "payload": payload_token,
            "currency": "XTR",
            "prices": [{"label": "Stars", "amount": req.amount}],
        })
    data = r.json()
    if not data.get("ok"):
        raise HTTPException(502, f"telegram error: {data}")
    return {"invoice_link": data["result"]}


@api_router.post("/payments/webhook")
async def payments_webhook(payload: Dict[str, Any]):
    """Telegram webhook receiver — handles successful_payment events."""
    msg = payload.get("message") or {}
    sp = msg.get("successful_payment")
    if not sp:
        return {"ok": True}
    invoice_payload = sp.get("invoice_payload", "")
    try:
        tg_id, amount_str, _ = invoice_payload.split(":")
        amount = int(amount_str)
    except Exception:
        return {"ok": True}
    user = await db.users.find_one({"tg_id": tg_id})
    if not user:
        return {"ok": True}
    await db.users.update_one(
        {"tg_id": tg_id},
        {"$inc": {"balance": amount, "deposited_balance": amount}},
    )
    await db.invoices.update_one({"payload": invoice_payload}, {"$set": {"status": "paid", "paid_at": utc_now_iso()}})
    return {"ok": True}


# ---------------- CRASH GAME (stateless rounds; client provides bet+mode) ----------------
_last_crash_multiplier: Optional[float] = None


def _sample_crash_multiplier() -> float:
    """Continuous-range crash distribution.

    1.01x-1.20x = 20%
    1.21x-1.50x = 25%
    1.51x-2.00x = 25%
    2.01x-3.00x = 18%
    3.01x-5.00x = 8%
    5.01x-10.00x = 3.9%
    10x+ (10.01-50.0) = 0.1%
    """
    r = random.random() * 100
    if r < 20:
        val = random.uniform(1.01, 1.20)
    elif r < 45:
        val = random.uniform(1.21, 1.50)
    elif r < 70:
        val = random.uniform(1.51, 2.00)
    elif r < 88:
        val = random.uniform(2.01, 3.00)
    elif r < 96:
        val = random.uniform(3.01, 5.00)
    elif r < 99.9:
        val = random.uniform(5.01, 10.00)
    else:
        val = random.uniform(10.01, 50.00)
    return round(val, 2)


def generate_crash_multiplier(last: Optional[float] = None) -> float:
    """Generate next crash multiplier; avoid exact repeats vs ``last`` and never return 0."""
    global _last_crash_multiplier
    prev = last if last is not None else _last_crash_multiplier
    val = 1.01
    for _ in range(5):
        val = _sample_crash_multiplier()
        if val <= 0:
            continue
        if val != prev:
            _last_crash_multiplier = val
            return val
    # If repeated 5 times in a row (extremely unlikely), nudge it slightly.
    val = round(max(1.01, val + 0.01), 2)
    _last_crash_multiplier = val
    return val


@api_router.post("/games/crash/start")
async def crash_start(req: CrashBetReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    if req.bet <= 0:
        raise HTTPException(400, "bet must be positive")
    bal_field = _balance_field(req.mode)
    if user[bal_field] < req.bet:
        raise HTTPException(400, "insufficient balance")
    # Per-user no-repeat: fetch this user's previous crash_at
    prev_game = await db.crash_games.find_one(
        {"tg_id": user["tg_id"]}, {"_id": 0, "crash_at": 1}, sort=[("created_at", -1)]
    )
    prev_val = prev_game.get("crash_at") if prev_game else None
    crash_at = generate_crash_multiplier(prev_val)
    await spend_balance(user["tg_id"], req.mode, req.bet)
    game = {
        "id": str(uuid.uuid4()),
        "tg_id": user["tg_id"],
        "bet": req.bet,
        "mode": req.mode,
        "crash_at": crash_at,
        "status": "running",
        "created_at": utc_now_iso(),
    }
    await db.crash_games.insert_one(game.copy())
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"game_id": game["id"], "crash_at": crash_at, "user": updated}


@api_router.post("/games/crash/cashout")
async def crash_cashout(payload: Dict[str, Any], x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    game_id = payload.get("game_id")
    multiplier = float(payload.get("multiplier", 0))
    game = await db.crash_games.find_one({"id": game_id, "tg_id": user["tg_id"]}, {"_id": 0})
    if not game:
        raise HTTPException(400, "game not found")
    # Idempotent: if already cashed, return last result without altering balance
    if game["status"] == "cashed":
        updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
        return {"win": int(game.get("win", 0)), "lost": False, "user": updated, "already_cashed": True}
    if game["status"] != "running":
        raise HTTPException(400, "no running game")
    if multiplier >= game["crash_at"]:
        await db.crash_games.update_one({"id": game_id}, {"$set": {"status": "lost"}})
        updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
        return {"win": 0, "lost": True, "user": updated}
    win = int(game["bet"] * multiplier)
    bal_field = _balance_field(game["mode"])
    await db.users.update_one({"tg_id": user["tg_id"]}, {"$inc": {bal_field: win}})
    await db.crash_games.update_one({"id": game_id}, {"$set": {"status": "cashed", "cashout_mult": multiplier, "win": win}})
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"win": win, "lost": False, "user": updated}


# ---------------- SLOTS ----------------
SLOT_SYMBOLS = ["star", "cherry", "diamond", "bell", "seven", "heart"]


@api_router.post("/games/slots/spin")
async def slots_spin(req: SlotsReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    if req.bet <= 0:
        raise HTTPException(400, "bet must be positive")
    bal_field = _balance_field(req.mode)
    if user[bal_field] < req.bet:
        raise HTTPException(400, "insufficient balance")
    await spend_balance(user["tg_id"], req.mode, req.bet)

    r = random.random() * 100
    # Slots RTP ≈ 90%:
    # Lose 55% / 0.5x 18% / 1x 12% / 2x 9% / 5x 4.5% / 20x 1.49% / 100x 0.01%
    if r < 55:
        outcome = "nothing"; mult_f = 0
        a, b, c = random.sample(SLOT_SYMBOLS, 3)
    elif r < 73:
        outcome = "small"; mult_f = 0.5
        a = b = random.choice(SLOT_SYMBOLS); c = random.choice([s for s in SLOT_SYMBOLS if s != a])
    elif r < 85:
        outcome = "refund"; mult_f = 1
        sym = random.choice(SLOT_SYMBOLS); a = b = c = sym
    elif r < 94:
        outcome = "medium"; mult_f = 2
        sym = random.choice(SLOT_SYMBOLS); a = b = c = sym
    elif r < 98.5:
        outcome = "big"; mult_f = 5
        sym = random.choice(SLOT_SYMBOLS); a = b = c = sym
    elif r < 99.99:
        outcome = "huge"; mult_f = 20
        a = b = c = "seven"
    else:
        outcome = "jackpot"; mult_f = 100
        a = b = c = "seven"

    win = int(req.bet * mult_f)
    if win:
        await db.users.update_one({"tg_id": user["tg_id"]}, {"$inc": {bal_field: win}})
    await db.slots_games.insert_one({
        "id": str(uuid.uuid4()),
        "tg_id": user["tg_id"],
        "mode": req.mode,
        "bet": req.bet,
        "win": win,
        "outcome": outcome,
        "created_at": utc_now_iso(),
    })
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"reels": [a, b, c], "outcome": outcome, "win": win, "user": updated}


# ---------------- WHEEL ----------------
WHEEL_SEGMENTS = [
    {"label": "0x",   "mult": 0,    "chance": 75.0},
    {"label": "1.5x", "mult": 1.5,  "chance": 15.0},
    {"label": "2x",   "mult": 2,    "chance": 6.0},
    {"label": "3x",   "mult": 3,    "chance": 2.5},
    {"label": "5x",   "mult": 5,    "chance": 1.0},
    {"label": "10x",  "mult": 10,   "chance": 0.45},
    {"label": "25x",  "mult": 25,   "chance": 0.05},
]


@api_router.get("/games/wheel/segments")
async def wheel_segments():
    return {"segments": [{"label": s["label"], "mult": s["mult"]} for s in WHEEL_SEGMENTS]}


@api_router.post("/games/wheel/spin")
async def wheel_spin(req: WheelReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    if req.bet <= 0:
        raise HTTPException(400, "bet must be positive")
    bal_field = _balance_field(req.mode)
    if user[bal_field] < req.bet:
        raise HTTPException(400, "insufficient balance")
    await spend_balance(user["tg_id"], req.mode, req.bet)

    r = random.random() * 100
    cum = 0
    pick_idx = 0
    for i, seg in enumerate(WHEEL_SEGMENTS):
        cum += seg["chance"]
        if r <= cum:
            pick_idx = i; break
    seg = WHEEL_SEGMENTS[pick_idx]
    win = int(req.bet * seg["mult"])
    if win:
        await db.users.update_one({"tg_id": user["tg_id"]}, {"$inc": {bal_field: win}})
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"segment_index": pick_idx, "label": seg["label"], "mult": seg["mult"], "win": win, "user": updated}


# ---------------- MINES ----------------
def mines_multiplier(size: int, mines: int, picks: int) -> float:
    total = size * size
    safe = total - mines
    if picks <= 0:
        return 1.0
    if picks > safe:
        return 1.0
    # Survival probability = product(safe-i / total-i) for i in [0, picks-1]
    p = 1.0
    for i in range(picks):
        p *= (safe - i) / (total - i)
    # Target RTP ≈ 77% (between 75–80% per spec). High-mine setups still pay strong
    # via `fair`; low-mine setups are clamped by a quadratic floor that grows slowly
    # at first then gently accelerates, so players can never farm a low-risk strategy.
    RTP = 0.77
    fair = RTP / p
    # Quadratic floor — tiny growth on the first few tiles, ramps up later.
    # Scaled inversely by board size so bigger boards grow slower (lower mine density).
    size_norm = size / 5.0  # 5x5 = 1.0, 7x7 = 1.4, 3x3 = 0.6
    floor = 1.0 + (0.005 * picks + 0.003 * picks * picks * (mines ** 0.5)) / size_norm
    return round(max(fair, floor), 2)


@api_router.post("/games/mines/start")
async def mines_start(req: MinesStartReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    if req.size not in (3, 5, 7):
        raise HTTPException(400, "invalid size")
    rules = {3: (1, 8), 5: (1, 24), 7: (1, 48)}
    mn, mx = rules[req.size]
    if req.mines < mn or req.mines > mx:
        raise HTTPException(400, f"mines must be {mn}-{mx}")
    if req.bet <= 0:
        raise HTTPException(400, "bet must be positive")
    bal_field = _balance_field(req.mode)
    if user[bal_field] < req.bet:
        raise HTTPException(400, "insufficient balance")
    total = req.size * req.size
    bombs = random.sample(range(total), req.mines)
    await spend_balance(user["tg_id"], req.mode, req.bet)
    game = {
        "id": str(uuid.uuid4()),
        "tg_id": user["tg_id"],
        "bet": req.bet,
        "mode": req.mode,
        "size": req.size,
        "mines": req.mines,
        "bombs": bombs,
        "revealed": [],
        "status": "running",
        "created_at": utc_now_iso(),
    }
    await db.mines_games.insert_one(game.copy())
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"game_id": game["id"], "size": req.size, "mines": req.mines, "user": updated}


@api_router.post("/games/mines/reveal")
async def mines_reveal(req: MinesRevealReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    game = await db.mines_games.find_one({"id": req.game_id, "tg_id": user["tg_id"]}, {"_id": 0})
    if not game or game["status"] != "running":
        raise HTTPException(400, "no active game")
    if req.index in game["revealed"]:
        raise HTTPException(400, "already revealed")
    if req.index < 0 or req.index >= game["size"] * game["size"]:
        raise HTTPException(400, "invalid index")
    if req.index in game["bombs"]:
        await db.mines_games.update_one({"id": req.game_id}, {"$set": {"status": "lost"}})
        return {"hit_bomb": True, "bombs": game["bombs"], "win": 0}
    revealed = game["revealed"] + [req.index]
    mult = mines_multiplier(game["size"], game["mines"], len(revealed))
    await db.mines_games.update_one({"id": req.game_id}, {"$set": {"revealed": revealed, "mult": mult}})
    return {"hit_bomb": False, "multiplier": mult, "potential_win": int(game["bet"] * mult), "revealed": revealed}


@api_router.post("/games/mines/cashout")
async def mines_cashout(req: MinesCashoutReq, x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    game = await db.mines_games.find_one({"id": req.game_id, "tg_id": user["tg_id"]}, {"_id": 0})
    if not game or game["status"] != "running":
        raise HTTPException(400, "no active game")
    revealed = game.get("revealed", [])
    if not revealed:
        raise HTTPException(400, "reveal at least one cell")
    mult = mines_multiplier(game["size"], game["mines"], len(revealed))
    win = int(game["bet"] * mult)
    bal_field = _balance_field(game["mode"])
    await db.users.update_one({"tg_id": user["tg_id"]}, {"$inc": {bal_field: win}})
    await db.mines_games.update_one({"id": req.game_id}, {"$set": {"status": "cashed", "win": win, "final_mult": mult}})
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"win": win, "multiplier": mult, "bombs": game["bombs"], "user": updated}


# ---------------- Stats / Profile ----------------
@api_router.get("/stats")
async def stats(mode: str = "demo", x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    tg = user["tg_id"]
    # Cases
    opens = await db.case_opens.find({"tg_id": tg, "mode": mode}, {"_id": 0}).to_list(5000)
    total_cases_opened = len(opens)
    stars_spent_cases = sum(o.get("price", 0) for o in opens)
    stars_won_cases = sum(o.get("reward_value", 0) for o in opens if o.get("reward_type") == "stars")
    biggest_gift = max([o for o in opens if o.get("reward_type") == "gift"], key=lambda o: o.get("reward_value", 0), default=None)
    # Crash
    crash = await db.crash_games.find({"tg_id": tg, "mode": mode}, {"_id": 0}).to_list(5000)
    crash_spent = sum(g["bet"] for g in crash)
    crash_won = sum(g.get("win", 0) for g in crash if g.get("status") == "cashed")
    biggest_crash = max(crash, key=lambda g: g.get("win", 0), default=None)
    # Mines
    mines = await db.mines_games.find({"tg_id": tg, "mode": mode}, {"_id": 0}).to_list(5000)
    mines_spent = sum(g["bet"] for g in mines)
    mines_won = sum(g.get("win", 0) for g in mines if g.get("status") == "cashed")
    # Slots
    slots = await db.slots_games.find({"tg_id": tg, "mode": mode}, {"_id": 0}).to_list(5000)
    slots_spent = sum(g["bet"] for g in slots)
    slots_won = sum(g.get("win", 0) for g in slots)
    biggest_slots = max(slots, key=lambda g: g.get("win", 0), default=None)
    # Inventory value (currently owned)
    inv = await db.inventory.find({"tg_id": tg, "mode": mode, "status": "owned"}, {"_id": 0}).to_list(2000)
    inventory_value = sum(it["value"] for it in inv)
    # Sold history
    sold = await db.inventory.find({"tg_id": tg, "mode": mode, "status": "sold"}, {"_id": 0}).sort("sold_at", -1).to_list(50)
    # Withdrawals
    wds = await db.withdrawals.find({"tg_id": tg}, {"_id": 0}).sort("created_at", -1).to_list(50)

    return {
        "mode": mode,
        "total_cases_opened": total_cases_opened,
        "total_stars_spent": int(stars_spent_cases + crash_spent + mines_spent + slots_spent),
        "total_stars_won": int(stars_won_cases + crash_won + mines_won + slots_won),
        "inventory_value": int(inventory_value),
        "biggest_gift": biggest_gift and {
            "name": biggest_gift["reward_name"],
            "value": biggest_gift["reward_value"],
            "image": biggest_gift["reward_image"],
        },
        "biggest_crash": biggest_crash and {
            "win": biggest_crash.get("win", 0),
            "multiplier": biggest_crash.get("cashout_mult", 0),
            "bet": biggest_crash.get("bet", 0),
        },
        "biggest_slots": biggest_slots and {
            "win": biggest_slots.get("win", 0),
            "outcome": biggest_slots.get("outcome", ""),
            "bet": biggest_slots.get("bet", 0),
        },
        "sold_history": sold,
        "withdrawal_history": wds,
    }


# ---------------- Demo Reset (Profile) ----------------
@api_router.post("/profile/reset-demo")
async def reset_demo(x_tg_id: Optional[str] = Header(None, alias="X-TG-ID")):
    user = await get_user_from_header(x_tg_id)
    await db.users.update_one({"tg_id": user["tg_id"]}, {"$set": {"demo_balance": 1_000_000, "demo_daily_cooldown": None}})
    await db.inventory.delete_many({"tg_id": user["tg_id"], "mode": "demo"})
    updated = await db.users.find_one({"tg_id": user["tg_id"]}, {"_id": 0})
    return {"user": updated}


# ---------------- Simulated drops generator ----------------
@api_router.post("/internal/simulate-drop")
async def simulate_drop():
    """Generate one simulated drop. Called by frontend periodically when needed."""
    case_id = random.choice(CASE_ORDER)
    case = CASES[case_id]
    reward_def = weighted_pick(case["rewards"])
    reward = materialize_reward(reward_def)
    drop = {
        "id": str(uuid.uuid4()),
        "name": reward["name"],
        "value": reward["value"],
        "image": reward["image"],
        "case_id": case_id,
        "mode": "sim",
        "created_at": utc_now_iso(),
    }
    await db.live_drops.insert_one(drop.copy())
    # prune
    cnt = await db.live_drops.count_documents({})
    if cnt > 60:
        oldest = await db.live_drops.find({}, {"_id": 1}).sort("created_at", 1).to_list(cnt - 60)
        if oldest:
            await db.live_drops.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})
    return {"drop": drop}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
