import React, { useEffect, useState } from "react";
import axios from "axios";
import { Star, Shield, CheckCircle2, XCircle, Send, AlertTriangle, User, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const adminApi = axios.create({ baseURL: API });
adminApi.interceptors.request.use((cfg) => {
  const s = localStorage.getItem("cc_admin_secret");
  if (s) cfg.headers["X-ADMIN"] = s;
  return cfg;
});

const STATUSES = ["pending", "approved", "sent", "rejected"];

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("cc_admin_secret"));
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [player, setPlayer] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersOpen, setUsersOpen] = useState(false);
  const [addTgId, setAddTgId] = useState("");
  const [addAmount, setAddAmount] = useState(100);
  const [addBusy, setAddBusy] = useState(false);

  const login = async () => {
    try {
      await adminApi.post("/admin/login", { secret });
      localStorage.setItem("cc_admin_secret", secret);
      setAuthed(true);
    } catch (e) { toast.error("Invalid secret"); }
  };

  const logout = () => { localStorage.removeItem("cc_admin_secret"); setAuthed(false); setRows([]); setPlayer(null); };

  const load = async () => {
    try { const r = await adminApi.get(`/admin/withdrawals?status=${status}`); setRows(r.data.withdrawals); }
    catch (e) { if (e?.response?.status === 401) { setAuthed(false); localStorage.removeItem("cc_admin_secret"); } }
  };
  useEffect(() => { if (authed) load(); }, [authed, status]);

  const loadUsers = async () => {
    try { const r = await adminApi.get("/admin/users"); setUsers(r.data.users || []); }
    catch (e) { toast.error("failed to load users"); }
  };

  useEffect(() => { if (authed && usersOpen) loadUsers(); }, [authed, usersOpen]);

  const addStars = async () => {
    const tg = addTgId.trim();
    const amt = parseInt(addAmount, 10);
    if (!tg) { toast.error("Select a user"); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Amount must be positive"); return; }
    setAddBusy(true);
    try {
      const r = await adminApi.post(`/admin/users/${encodeURIComponent(tg)}/add-stars`, { amount: amt });
      toast.success(`+${r.data.added} ⭐ → ${tg}`);
      if (usersOpen) loadUsers();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "failed");
    } finally {
      setAddBusy(false);
    }
  };

  const act = async (id, action) => {
    try { await adminApi.post("/admin/withdrawals/action", { withdrawal_id: id, action }); toast.success(action); load(); setSelected(null); }
    catch (e) { toast.error("failed"); }
  };

  const openPlayer = async (tgId) => {
    try { const r = await adminApi.get(`/admin/player/${tgId}`); setPlayer(r.data); }
    catch (e) { toast.error("failed"); }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-6 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-3"><Shield className="w-6 h-6 text-pink-400" /><h2 className="font-display text-xl">Admin Access</h2></div>
          <input
            type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter admin secret" data-testid="admin-secret-input"
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 mb-3 outline-none"
          />
          <button onClick={login} data-testid="admin-login-btn" className="btn-cherry w-full">Open Admin Panel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-20" data-testid="admin-page">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-2xl flex items-center gap-2"><Shield className="w-6 h-6 text-pink-400" />Cherry Admin</div>
        <button onClick={logout} className="btn-ghost text-xs">Logout</button>
      </div>

      {/* Add Stars panel */}
      <div className="glass rounded-2xl p-3 mb-3" data-testid="add-stars-panel">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-pink-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add Stars</div>
          <button onClick={() => setUsersOpen((v) => !v)} className="btn-ghost text-xs" data-testid="toggle-users-btn">
            {usersOpen ? "Hide users" : "Browse users"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={addTgId}
            onChange={(e) => setAddTgId(e.target.value)}
            placeholder="tg_id"
            data-testid="add-stars-tgid"
            className="flex-1 min-w-[120px] bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="number"
            min={1}
            value={addAmount}
            onChange={(e) => setAddAmount(Math.max(1, parseInt(e.target.value || "1", 10)))}
            data-testid="add-stars-amount"
            className="w-28 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"
          />
          <button
            onClick={addStars}
            disabled={addBusy}
            data-testid="add-stars-btn"
            className="btn-cherry !py-2 !px-3 text-xs"
          >
            <Star className="w-3.5 h-3.5 inline mr-1" fill="currentColor" />Add Stars
          </button>
        </div>
        {usersOpen && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1" data-testid="users-list">
            {users.length === 0 && <div className="text-xs text-white/50 text-center py-2">No users</div>}
            {users.map((u) => (
              <button
                key={u.tg_id}
                onClick={() => setAddTgId(u.tg_id)}
                className={`w-full text-left text-xs bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 flex justify-between gap-2 ${addTgId === u.tg_id ? "ring-1 ring-pink-400" : ""}`}
                data-testid={`user-row-${u.tg_id}`}
              >
                <span className="truncate">@{u.username || "—"} <span className="text-white/40">({u.tg_id})</span></span>
                <span className="text-gold flex items-center gap-1 whitespace-nowrap"><Star className="w-3 h-3" fill="currentColor" />{u.balance ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`btn-ghost text-xs whitespace-nowrap ${status === s ? "ring-2 ring-pink-400" : ""}`}>{s}</button>
        ))}
        <button onClick={load} className="btn-ghost text-xs"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <div className="glass rounded-2xl p-4 text-center text-white/60 text-sm">No requests</div>}
        {rows.map((w) => (
          <div key={w.id} className="glass rounded-2xl p-3 flex gap-3 items-center" data-testid="wd-card">
            <img src={w.gift_image} alt="" className="w-14 h-14 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{w.gift_name}</div>
              <div className="text-[11px] text-white/70 flex items-center gap-1"><User className="w-3 h-3" />@{w.username || "—"} (id {w.tg_id})</div>
              <div className="flex items-center gap-2 text-[11px] mt-1">
                <span className="text-gold flex items-center gap-1"><Star className="w-3 h-3" fill="currentColor" />{w.gift_value}</span>
                <span className="text-white/50">{new Date(w.created_at).toLocaleString()}</span>
                {w.fraud_flags?.length > 0 && <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{w.fraud_flags.length}</span>}
              </div>
            </div>
            <button onClick={() => openPlayer(w.tg_id)} className="btn-ghost !py-1 !px-2 text-xs">Player</button>
            {w.status === "pending" && (
              <div className="flex flex-col gap-1">
                <button onClick={() => act(w.id, "approve")} className="btn-cherry !py-1 !px-2 text-[11px]"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => act(w.id, "reject")} className="btn-ghost !py-1 !px-2 text-[11px] text-red-300"><XCircle className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {w.status === "approved" && (
              <button onClick={() => act(w.id, "sent")} className="btn-cherry !py-1 !px-2 text-[11px]"><Send className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>

      {player && (
        <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-3" onClick={() => setPlayer(null)}>
          <div className="glass rounded-2xl p-4 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg mb-2">Player @{player.user.username || "—"}</div>
            <div className="text-xs text-white/70 mb-2">ID {player.user.tg_id}</div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>Real bal: <b>{player.user.balance}</b></div>
              <div>Demo bal: <b>{player.user.demo_balance}</b></div>
              <div>Cases: <b>{player.case_opens.length}</b></div>
              <div>Invoices: <b>{player.invoices.length}</b></div>
              <div>Withdrawals: <b>{player.withdrawals.length}</b></div>
              <div>Inventory: <b>{player.inventory.length}</b></div>
            </div>
            {player.fraud_flags.length > 0 && (
              <div className="mb-3 text-xs text-red-300">⚠ {player.fraud_flags.join(", ")}</div>
            )}
            <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Recent opens</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {player.case_opens.slice(0, 20).map((o) => (
                <div key={o.id} className="text-[11px] bg-white/5 rounded p-1 flex justify-between">
                  <span>{o.case_id} → {o.reward_name}</span><span>{o.reward_value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setPlayer(null)} className="btn-ghost w-full mt-3 text-xs">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
