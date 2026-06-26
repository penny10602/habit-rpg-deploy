import { useState, useEffect, useRef } from "react";

/* ─── Design tokens ─── */
const CLAY = "#C1644B", CLAY_DEEP = "#9C4A35";
const SAGE = "#6E8763";
const GOLD = "#C99A3E", AMETHYST = "#8B6A9E";
const COIN = "#D4A72C";

const LIGHT = {
  bg: "linear-gradient(160deg, #FBF1E9 0%, #F3E3DD 45%, #ECD9DE 100%)",
  card: "#FFFCFA", cardAlt: "#FBF6F3", ink: "#3A2E2C",
  muted: "#9C8A85", mutedSoft: "#B4A39E",
  border: "rgba(58,46,44,0.08)", borderStrong: "rgba(58,46,44,0.16)",
  chip: "rgba(58,46,44,0.06)", overlay: "rgba(58,46,44,0.4)",
};
const DARK = {
  bg: "linear-gradient(160deg, #241B19 0%, #2B2020 45%, #2F2228 100%)",
  card: "#332726", cardAlt: "#3B2E2C", ink: "#F3E9E4",
  muted: "#B8A39C", mutedSoft: "#8C7972",
  border: "rgba(255,245,240,0.08)", borderStrong: "rgba(255,245,240,0.16)",
  chip: "rgba(255,245,240,0.07)", overlay: "rgba(10,6,5,0.55)",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&display=swap');`;

const CATEGORIES = [
  { key: "health",  label: "健康",   emoji: "🏃", color: SAGE },
  { key: "study",   label: "學習",   emoji: "📚", color: AMETHYST },
  { key: "work",    label: "工作",   emoji: "💼", color: "#5C7A93" },
  { key: "finance", label: "財務",   emoji: "💰", color: GOLD },
  { key: "growth",  label: "個人成長", emoji: "🎯", color: CLAY },
];

const LEVEL_STEP = 150;
const XP_PER_COMPLETION = 10;
const COINS_PER_CHECKIN = 5;
const COINS_CHALLENGE_COMPLETE = 30;

const PLANT_STAGES = [
  { level: 15, emoji: "🌸", label: "盛開" },
  { level: 10, emoji: "🌳", label: "大樹" },
  { level: 6,  emoji: "🪴", label: "小樹" },
  { level: 3,  emoji: "🌿", label: "幼苗" },
  { level: 1,  emoji: "🌱", label: "種子" },
];

/* ─── 角色圖鑑（男生 / 女生 各 16 個） ─── */
const CHAR_PRICE = 200; // 除第一次免費選擇外，其餘角色解鎖統一價格
const CHARACTERS = [
  ...Array.from({length:16}, (_,i)=>({ id:`f${String(i+1).padStart(2,"0")}`, gender:"female", name:`女生角色 ${i+1}`, img:`/characters/female/f${String(i+1).padStart(2,"0")}.${[7,16].includes(i+1)?"png":"jpg"}` })),
  ...Array.from({length:16}, (_,i)=>({ id:`m${String(i+1).padStart(2,"0")}`, gender:"male", name:`男生角色 ${i+1}`, img:`/characters/male/m${String(i+1).padStart(2,"0")}.${[7,8,9,16].includes(i+1)?"png":"jpg"}` })),
];
function getCharacter(id) { return CHARACTERS.find(c => c.id === id) || null; }

/* ─── 角色健康狀態（衍生計算，不另外存可變狀態，避免漏算離線期間）
   規則：當天沒完成 1 個習慣 → 不舒服；沒完成 3 個（含）以上 → 生病；
   本週挑戰沒達成 → 直接生病；連續完成 2 天習慣才能恢復健康。 ─── */
function characterStatusMeta(status) {
  if (status === "sick") return { label: "生病了", emoji: "🤒", color: CLAY_DEEP };
  if (status === "unwell") return { label: "不舒服", emoji: "😕", color: GOLD };
  return { label: "健康", emoji: "💚", color: SAGE };
}
function computeCharacterStatus(user, today) {
  const habits = user.habits || [];
  if (!habits.length || !user.characterId) return { health: 100, status: "healthy", recoveryStreak: 0 };

  const earliest = habits.reduce((min,h) => {
    if (!h.createdAt) return min;
    const c = new Date(h.createdAt);
    return c < min ? c : min;
  }, today);
  const windowStart = new Date(Math.max(addDays(today, -30).getTime(), new Date(toKey(earliest)).getTime()));

  let health = 100, status = "healthy", recoveryStreak = 0;
  let cursor = new Date(windowStart);
  const yesterday = addDays(today, -1);

  while (cursor <= yesterday) {
    const dayKey = toKey(cursor);
    const scheduled = habits.filter(h => !h.createdAt || new Date(h.createdAt) <= cursor);
    if (scheduled.length > 0) {
      const doneCount = scheduled.filter(h => (h.completions||[]).includes(dayKey)).length;
      const missedCount = scheduled.length - doneCount;
      if (missedCount === 0) {
        health = Math.min(100, health + 10);
        if (status !== "healthy") {
          recoveryStreak++;
          if (recoveryStreak >= 2) { status = "healthy"; health = Math.max(health, 60); recoveryStreak = 0; }
        }
      } else if (missedCount >= 3) {
        health = Math.max(0, health - 25);
        status = "sick";
        recoveryStreak = 0;
      } else {
        health = Math.max(0, health - 12);
        if (status !== "sick") status = "unwell";
        recoveryStreak = 0;
      }
    }
    // 每週一檢查上一週的「本週挑戰」是否完成，沒完成直接變生病
    if (cursor.getDay() === 1) {
      const lastWeekEnd = addDays(cursor, -1);
      const wc = getWeekChallenge(habits, lastWeekEnd);
      if (wc) {
        const claimed = (user.claimedChallenges||[]).includes(wc.wsKey);
        if (!claimed && !wc.complete) {
          health = Math.max(0, health - 25);
          status = "sick";
          recoveryStreak = 0;
        }
      }
    }
    cursor = addDays(cursor, 1);
  }
  return { health, status, recoveryStreak };
}

const ALL_TITLES = [
  { id: "rookie",     label: "新人冒險者", cost: 0,    desc: "剛開始旅程（預設）",    emoji: "🌱" },
  { id: "apprentice", label: "習慣學徒",  cost: 50,   desc: "連續打卡 7 天後可解鎖", emoji: "📖" },
  { id: "focused",    label: "專注者",    cost: 150,  desc: "30 天挑戰老手",         emoji: "🎯" },
  { id: "disciplined",label: "自律達人",  cost: 300,  desc: "金幣收藏家的榮耀",      emoji: "⚔️" },
  { id: "master",     label: "習慣大師",  cost: 600,  desc: "傳奇等級的意志力",      emoji: "🏆" },
  { id: "legend",     label: "傳說冒險者", cost: 1200, desc: "最高榮耀稱號",          emoji: "👑" },
];

const DEFAULT_AVATARS = [
  { id: "male",       emoji: "🧑", label: "男生角色" },
  { id: "female",     emoji: "👩", label: "女生角色" },
  { id: "adventurer", emoji: "🧙", label: "冒險家" },
  { id: "student",    emoji: "🎓", label: "學生" },
  { id: "athlete",    emoji: "🏋️", label: "運動員" },
];

const EMOJI_CHOICES = ["💧","🏃","📖","🧘","🍎","😴","✍️","🎨","💪","🦷","🌞","🎯","🧹","🥗","🚴","🛏️","📵","🙏","🎵","🐶","🧺","☕","🚭","🌱"];

/* ══════════════════════════════════════════
   寵物扭蛋系統
   ══════════════════════════════════════════ */
const GACHA_COST = 50;
const GACHA_PROBABILITIES = { common: 0.60, legend: 0.30, ssr: 0.10 };
const HIDDEN_CHANCE = 0.02; // 隱藏款彩蛋機率（在主要稀有度之外額外判定）

const RARITY_META = {
  common: { label: "普通", color: SAGE },
  legend: { label: "傳說", color: AMETHYST },
  ssr:    { label: "SSR",  color: GOLD },
  hidden: { label: "🔐 隱藏", color: "#FF1493" },
};

const PET_COLORS = ["白", "黑", "灰", "奶茶色", "咖啡色"];
const PET_PATTERNS = ["虎斑🐯", "乳牛🐄", "漸層🌈", "小圓點⚪"];
const LEGEND_LOOKS = ["金色邊框✨", "發光眼睛👀✨", "半透明靈體👻", "漸變光影🌈"];
const LEGEND_PATTERNS = ["星星紋⭐", "雲霧紋☁", "火焰紋🔥", "閃電紋⚡"];
const SSR_COLORS = ["銀河深藍", "極光綠", "玫瑰金", "冰晶藍❄", "紫羅蘭"];
const PERSONALITIES = ["活潑🏃‍♂️", "傲嬌😼", "愛睡😴", "黏人💕", "守護型🛡", "搗蛋鬼😈"];

const COMMON_PETS = [
  { name: "兔兔", emoji: "🐰" },
  { name: "狗狗", emoji: "🐕" },
  { name: "貓貓", emoji: "🐱" },
  { name: "倉鼠", emoji: "🐹" },
  { name: "小狐狸", emoji: "🦊" },
  { name: "小熊", emoji: "🐻" },
];

const LEGEND_PETS = [
  { name: "傳說兔兔", emoji: "🐇" },
  { name: "傳說狗狗", emoji: "🦮" },
  { name: "傳說貓貓", emoji: "😸" },
  { name: "靈狐", emoji: "🦊" },
  { name: "小龍", emoji: "🐉" },
  { name: "獨角獸", emoji: "🦄" },
];

const SSR_PETS = [
  { name: "SSR閃耀兔兔", emoji: "✨🐰" },
  { name: "SSR閃耀狗狗", emoji: "✨🐕" },
  { name: "SSR閃耀貓貓", emoji: "✨🐱" },
  { name: "星光狐狸", emoji: "✨🦊" },
  { name: "銀河小龍", emoji: "✨🐉" },
  { name: "彩虹獨角獸", emoji: "✨🦄" },
];

const HIDDEN_PETS = [
  { name: "王冠貓", emoji: "👑🐱", look: "極低機率掉落" },
  { name: "暗黑兔", emoji: "🖤🐰", look: "黑霧特效" },
  { name: "冰晶狗", emoji: "🧊🐕", look: "透明質感" },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function performGacha() {
  const personality = pick(PERSONALITIES);
  const instanceId = `pet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const obtainedAt = new Date().toISOString();

  // 先判定隱藏款彩蛋
  if (Math.random() < HIDDEN_CHANCE) {
    const base = pick(HIDDEN_PETS);
    return { ...base, rarity: "hidden", personality, instanceId, obtainedAt };
  }

  const rand = Math.random();
  if (rand < GACHA_PROBABILITIES.common) {
    const base = pick(COMMON_PETS);
    const color = pick(PET_COLORS);
    const pattern = Math.random() < 0.4 ? pick(PET_PATTERNS) : null;
    return { ...base, rarity: "common", color, pattern, personality, instanceId, obtainedAt };
  } else if (rand < GACHA_PROBABILITIES.common + GACHA_PROBABILITIES.legend) {
    const base = pick(LEGEND_PETS);
    const look = pick(LEGEND_LOOKS);
    const pattern = pick(LEGEND_PATTERNS);
    return { ...base, rarity: "legend", look, pattern, personality, instanceId, obtainedAt };
  } else {
    const base = pick(SSR_PETS);
    const color = pick(SSR_COLORS);
    return { ...base, rarity: "ssr", color, personality, instanceId, obtainedAt };
  }
}

/* ══════════════════════════════════════════
   Google Apps Script 後端設定
   把你的 GAS 網址貼在這裡
   ══════════════════════════════════════════ */
const GAS_URL = "https://script.google.com/macros/s/AKfycbzyvINZnlQikDllSOu-8gnDFGs73wimB2RsthOSQ2WeR1Jzie3EmIT-Ho2SHxuH2kbfxA/exec";
const GAS_CONFIGURED = !GAS_URL.includes("YOUR_SCRIPT_ID");

/* ══════════════════════════════════════════
   GAS API helpers — 帳號全部由後端 (Google Sheet) 驗證
   ══════════════════════════════════════════ */
async function gasPost(action, payload) {
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // avoid CORS preflight
    body: JSON.stringify({ action, ...payload }),
  });
  return r.json();
}

// 註冊：後端會檢查 email / username 是否已被使用，重複則回傳 ok:false
async function gasRegister(username, email, password) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL，無法跨裝置註冊" };
  try { return await gasPost("register", { username, email, password }); }
  catch { return { ok: false, error: "連線後端失敗，請檢查網路" }; }
}

// 登入：後端驗證密碼是否正確，正確才回傳完整使用者資料
async function gasLogin(email, password) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL，無法跨裝置登入" };
  try { return await gasPost("login", { email, password }); }
  catch { return { ok: false, error: "連線後端失敗，請檢查網路" }; }
}

async function gasResetPassword(email) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try { return await gasPost("resetPassword", { email }); }
  catch { return { ok: false, error: "連線後端失敗，請檢查網路" }; }
}

// 依 email 從後端拉取最新資料（換裝置時用來補齊本機快取）
async function gasFetchByEmail(email) {
  if (!GAS_CONFIGURED) return null;
  try {
    const url = `${GAS_URL}?action=search&email=${encodeURIComponent(email)}`;
    const r = await fetch(url);
    const data = await r.json();
    return data.found ? data.user : null;
  } catch { return null; }
}

// 依 id 從後端拉取資料（跨裝置加好友時，本機完全沒有對方 email 的備援查詢）
async function gasFetchById(id) {
  if (!GAS_CONFIGURED || !id) return null;
  try {
    const url = `${GAS_URL}?action=searchById&id=${encodeURIComponent(id)}`;
    const r = await fetch(url);
    const data = await r.json();
    return data.found ? data.user : null;
  } catch { return null; }
}

// 同步使用者資料（習慣 / 等級 / 金幣等）到後端；不會更動密碼
async function gasSyncUser(user) {
  if (!GAS_CONFIGURED) return { ok: false };
  try {
    return await gasPost("upsert", {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarPreset: user.avatarPreset,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        activeTitle: user.activeTitle,
        level: levelInfo(computeUserXP(user)).level,
        coins: user.coins || 0,
        habits: JSON.stringify(user.habits || []),
        friendIds: JSON.stringify(user.friendIds || []),
        unlockedTitles: JSON.stringify(user.unlockedTitles || ["rookie"]),
        claimedChallenges: JSON.stringify(user.claimedChallenges || []),
        pendingFriendRequests: JSON.stringify(user.pendingFriendRequests || []),
        characterId: user.characterId || "",
        unlockedCharacters: JSON.stringify(user.unlockedCharacters || []),
      },
    });
  } catch { return { ok: false }; }
}

/* ─── 新增好友邀請相關的 API Helper ─── */
async function gasSendFriendRequest(senderId, receiverEmailOrUsername) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try {
    return await gasPost("sendFriendRequest", { senderId, receiverEmailOrUsername });
  } catch {
    return { ok: false, error: "連線後端失敗，請檢查網路" };
  }
}

async function gasAcceptFriendRequest(userId, senderId) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try {
    return await gasPost("acceptFriendRequest", { userId, senderId });
  } catch {
    return { ok: false, error: "連線後端失敗，請檢查網路" };
  }
}

async function gasRejectFriendRequest(userId, senderId) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try {
    return await gasPost("rejectFriendRequest", { userId, senderId });
  } catch {
    return { ok: false, error: "連線後端失敗，請檢查網路" };
  }
}

/* ─── Helpers ─── */
function pad(n) { return String(n).padStart(2, "0"); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function startOfWeek(d) {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r;
}
function loadJSON(key, def) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; }
}
function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (err) { console.warn("saveJSON failed", key, err); return false; } }

function computeStreak(completions, today) {
  let streak = 0, cursor = new Date(today);
  if (!completions.includes(toKey(today))) cursor = addDays(cursor, -1);
  while (completions.includes(toKey(cursor))) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}
function rateForDays(habits, today, days) {
  if (!habits.length) return 0;
  let total = 0;
  habits.forEach(h => {
    let count = 0;
    for (let i = 0; i < days; i++) {
      if ((h.completions||[]).includes(toKey(addDays(today, -i)))) count++;
    }
    total += Math.round((count / days) * 100);
  });
  return Math.round(total / habits.length);
}
function plantStage(level) { return PLANT_STAGES.find(p => level >= p.level) || PLANT_STAGES[PLANT_STAGES.length-1]; }
function levelInfo(xp) {
  const level = 1 + Math.floor(xp / LEVEL_STEP);
  const within = xp % LEVEL_STEP;
  return { level, within, pct: Math.round((within / LEVEL_STEP) * 100) };
}
function getWeekChallenge(habits, today) {
  if (!habits.length) return null;
  const ws = startOfWeek(today);
  const wsKey = toKey(ws);
  const seed = wsKey.replace(/-/g,"");
  const idx = parseInt(seed.slice(-2), 10) % habits.length;
  const habit = habits[idx];
  const days = Array.from({length:7}).map((_,i) => addDays(ws, i));
  const countDone = days.filter(d => d <= today && (habit.completions||[]).includes(toKey(d))).length;
  const complete = countDone === 7;
  return { habit, days, wsKey, countDone, complete };
}

/* ─── Local storage backend ─── */
const USERS_KEY = "rpg:users";
const SESSION_KEY = "rpg:session";
const REMINDERS_KEY = "rpg:reminders";

function getAllUsers() { return loadJSON(USERS_KEY, []); }
function saveAllUsers(u) { return saveJSON(USERS_KEY, u); }
function getCurrentSession() { return loadJSON(SESSION_KEY, null); }
function saveSession(uid) { saveJSON(SESSION_KEY, uid); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getUserById(uid) { return getAllUsers().find(u => u.id === uid) || null; }
function updateUser(uid, patch) {
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === uid);
  if (idx === -1) return false;
  users[idx] = { ...users[idx], ...patch };
  return saveAllUsers(users);
}
function computeUserXP(user) {
  return (user.habits||[]).reduce((s,h) => {
    const uniqueDays = new Set(h.completions||[]).size;
    return s + uniqueDays * XP_PER_COMPLETION;
  }, 0);
}

/* ══════════════════════════════════════════
   小元件
   ══════════════════════════════════════════ */
function ProgressBar({ value, color, t, height = 8 }) {
  return (
    <div style={{ width:"100%", height, borderRadius:height, background:t.chip, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(100,value)}%`, height:"100%", borderRadius:height, background:color, transition:"width 0.5s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
}

function Avatar({ user, size = 44 }) {
  if (user?.avatarUrl) return <img src={user.avatarUrl} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />;
  const preset = DEFAULT_AVATARS.find(a => a.id === user?.avatarPreset) || DEFAULT_AVATARS[0];
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`${CLAY}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.48, flexShrink:0 }}>
      {preset.emoji}
    </div>
  );
}

function CoinBadge({ coins, style={} }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:`${COIN}20`, border:`1px solid ${COIN}55`, borderRadius:10, padding:"3px 9px", fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13.5, color:COIN, ...style }}>
      🪙 {coins}
    </span>
  );
}

function StatCard({ label, value, color, t }) {
  return (
    <div style={{ background:t.cardAlt, borderRadius:14, padding:"12px 8px", textAlign:"center", flex:1 }}>
      <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:20, color:color||t.ink }}>{value}</div>
      <div style={{ fontSize:10.5, color:t.muted, fontFamily:"Inter, sans-serif", marginTop:3 }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════
   今日進度橫幅
   ══════════════════════════════════════════ */
function TodayProgressBanner({ habits, todayKey, t }) {
  const total = habits.length;
  if (total === 0) return null;
  const done = habits.filter(h => (h.completions||[]).includes(todayKey)).length;
  const pct = Math.round((done / total) * 100);
  const BLOCKS = 10;
  const filled = Math.round((done / total) * BLOCKS);
  const bar = "█".repeat(filled) + "░".repeat(BLOCKS - filled);
  const color = pct >= 80 ? SAGE : pct >= 50 ? AMETHYST : CLAY;
  return (
    <div style={{ background:t.card, border:`1px solid ${color}33`, borderRadius:18, padding:"14px 16px", marginBottom:12, borderLeft:`4px solid ${color}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontFamily:"Inter, sans-serif", fontWeight:700, fontSize:13.5, color:t.ink }}>
          今天完成 <span style={{ color, fontFamily:"Fraunces, serif", fontSize:16 }}>{done}</span>
          <span style={{ color:t.muted }}> / {total}</span> 個習慣
        </span>
        <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:15, color }}>{pct}%</span>
      </div>
      <div style={{ fontFamily:"monospace", fontSize:13, letterSpacing:1.5, color, marginBottom:6 }}>{bar}</div>
      <ProgressBar value={pct} color={color} t={t} height={5} />
      {done === total && <div style={{ marginTop:8, fontSize:12, color:SAGE, fontWeight:700, fontFamily:"Inter, sans-serif" }}>🎉 今日所有習慣完成！太棒了！</div>}
    </div>
  );
}

/* ══════════════════════════════════════════
   月曆熱力圖
   ══════════════════════════════════════════ */
function MonthHeatmap({ habits, t }) {
      const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalHabits = habits.length;
  const dayData = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const key = toKey(d);
    const done = habits.filter(h => (h.completions||[]).includes(key)).length;
    const pct = totalHabits > 0 ? done / totalHabits : 0;
    return { day: i+1, done, pct, isFuture: d > today, isToday: toKey(d) === toKey(today) };
  });
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  function cellColor(pct, isFuture) {
    if (isFuture) return t.chip;
    if (pct === 0) return t.borderStrong;
    if (pct <= 0.33) return `${CLAY}55`;
    if (pct <= 0.66) return `${CLAY}99`;
    return CLAY;
  }
  const WEEKDAYS = ["一","二","三","四","五","六","日"];
  const monthNames = ["一","二","三","四","五","六","七","八","九","十","十一","十二"];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"18px 16px" }}>
        <div style={{ fontFamily:"Fraunces, serif", fontSize:15, fontWeight:700, color:t.ink, marginBottom:14 }}>
          {year} 年 {monthNames[month]} 月　習慣熱力圖
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6 }}>
          {WEEKDAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:11, color:t.muted, fontWeight:600, marginBottom:6 }}>{d}</div>)}
          {Array(offset).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
          {dayData.map(d => (
            <div key={d.day} style={{ aspectRatio:"1", borderRadius:8, background:cellColor(d.pct, d.isFuture), display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, color:d.isFuture||d.pct===0?t.muted:t.card, border:d.isToday?`2px solid ${CLAY}`:"none" }}>
              {d.day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Auth Screen
   ══════════════════════════════════════════ */
function AuthScreen({ onLogin, t }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [username, setUsername] = useState("");
  const [error, setError] = useState(""); const [forgotMode, setForgotMode] = useState(false); const [forgotMsg, setForgotMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle = { width:"100%", padding:"12px 14px", borderRadius:12, border:`1px solid ${t.borderStrong}`, background:t.cardAlt, color:t.ink, fontSize:14, fontFamily:"Inter, sans-serif", outline:"none", boxSizing:"border-box" };
  const btnStyle = { width:"100%", height:56, padding:"0 13px", borderRadius:12, border:"none", background:busy?t.mutedSoft:`linear-gradient(135deg, ${CLAY}, ${CLAY_DEEP})`, color:"#FFFCFA", fontWeight:700, fontSize:14.5, cursor:busy?"default":"pointer", fontFamily:"Inter, sans-serif", marginTop:4 };

  // ✅ 改進：登入後立即從 Google Sheet 重新讀取資料
    async function handleLogin() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("請輸入 Email 與密碼"); return; }
    setBusy(true);
    const res = await gasLogin(email.trim(), password);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Email 或密碼錯誤"); return; }
    
    let finalUser = res.user;
    if (GAS_CONFIGURED && res.user.email) {
      try {
        const freshData = await gasFetchByEmail(res.user.email);
        if (freshData && freshData.id === res.user.id) {
          finalUser = freshData;
        }
      } catch (err) {
        console.warn("無法從 Google Sheet 重新讀取資料，使用登入回傳的資料", err);
      }
    }
    
    const users = getAllUsers();
    const idx = users.findIndex(u => u.id === finalUser.id);
    if (idx === -1) users.push(finalUser); else users[idx] = { ...users[idx], ...finalUser };
    saveAllUsers(users);
    saveSession(finalUser.id);
    onLogin(finalUser.id);
  }

  // 註冊：後端會檢查 email / username 是否已被使用（任一重複都禁止建立新帳號）
  async function handleRegister() {
    setError("");
    if (!username.trim() || !email.trim() || !password.trim()) { setError("請填寫所有欄位"); return; }
    if (password.length < 6) { setError("密碼至少 6 個字元"); return; }
    setBusy(true);
    const res = await gasRegister(username.trim(), email.trim(), password);
    setBusy(false);
    if (!res.ok) { setError(res.error || "此帳號已被註冊"); return; }
    const users = getAllUsers();
    users.push(res.user);
    saveAllUsers(users);
    saveSession(res.user.id);
    onLogin(res.user.id);
  }

  async function handleForgot() {
    setBusy(true);
    const res = await gasResetPassword(email.trim());
    setBusy(false);
    setForgotMsg(res.ok ? `✅ 已重設，暫時密碼為：${res.tempPassword}（請登入後盡快至個人檔案修改）` : (res.error || "找不到此 Email 對應的帳號"));
  }

  if (forgotMode) return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <p style={{ color:t.ink, fontSize:14, fontFamily:"Inter, sans-serif", margin:0 }}>輸入你的 Email，找回密碼。</p>
      <input style={inputStyle} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
      {forgotMsg && <p style={{ color:SAGE, fontSize:13, margin:0, fontFamily:"Inter, sans-serif" }}>{forgotMsg}</p>}
      <button style={btnStyle} disabled={busy} onClick={handleForgot}>{busy?"處理中…":"送出"}</button>
      <button onClick={()=>{setForgotMode(false);setForgotMsg("");}} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回登入</button>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {!GAS_CONFIGURED && (
        <p style={{ color:CLAY_DEEP, fontSize:12, margin:0, fontFamily:"Inter, sans-serif", lineHeight:1.5 }}>
          ⚠️ 尚未連接後端資料庫，帳號僅會存在本機，換裝置將無法登入。請設定 GAS_URL。
        </p>
      )}
      <div style={{ display:"flex", background:t.chip, borderRadius:12, padding:3, marginBottom:4 }}>
        {[["login","登入"],["register","註冊"]].map(([k,l]) => (
          <button key={k} onClick={()=>{setTab(k);setError("");}} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", background:tab===k?t.card:"transparent", color:tab===k?t.ink:t.muted, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", boxShadow:tab===k?"0 2px 8px rgba(0,0,0,0.10)":"none" }}>{l}</button>
        ))}
      </div>
      {tab==="register" && <input style={inputStyle} placeholder="使用者名稱" value={username} onChange={e=>setUsername(e.target.value)} />}
      <input style={inputStyle} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
      <input style={inputStyle} placeholder="密碼" value={password} onChange={e=>setPassword(e.target.value)} type="password" />
      {error && <p style={{ color:CLAY_DEEP, fontSize:13, margin:0, fontFamily:"Inter, sans-serif" }}>{error}</p>}
      <button style={btnStyle} disabled={busy} onClick={tab==="login"?handleLogin:handleRegister}>{busy?"處理中…":(tab==="login"?"登入":"建立帳號")}</button>
      {tab==="login" && <button onClick={()=>setForgotMode(true)} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>忘記密碼？</button>}
    </div>
  );
}

/* ══════════════════════════════════════════
   Profile Screen
   ══════════════════════════════════════════ */
function ProfileScreen({ user, onBack, onSave, t }) {
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio||"");
  const [avatarPreset, setAvatarPreset] = useState(user.avatarPreset||"adventurer");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl||null);
  const fileRef = useRef(null);
  const inputStyle = { width:"100%", padding:"11px 13px", borderRadius:12, border:`1px solid ${t.borderStrong}`, background:t.cardAlt, color:t.ink, fontSize:14, fontFamily:"Inter, sans-serif", outline:"none", boxSizing:"border-box" };

  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ""; // 允許重新選同一張檔案
    setUploadError(""); setUploading(true);
    const MAX_SIZE = 256;

    function finish(dataUrl) { setAvatarUrl(dataUrl); setUploading(false); }
    function fail(msg) { setUploadError(msg); setUploading(false); }

    try {
      if (typeof window.createImageBitmap === "function") {
        // 優先用瀏覽器原生解碼＋縮放，比較省記憶體，手機高畫質照片（千萬像素以上）也能正常處理
        let bitmap;
        try {
          bitmap = await createImageBitmap(file);
        } catch (err) {
          throw new Error("decode-failed");
        }
        let { width, height } = bitmap;
        if (width > height) { if (width > MAX_SIZE) { height = Math.round(height * (MAX_SIZE / width)); width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width = Math.round(width * (MAX_SIZE / height)); height = MAX_SIZE; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close && bitmap.close();
        const compressed = canvas.toDataURL("image/jpeg", 0.75);
        if (!compressed || compressed === "data:,") { fail("圖片太大，無法處理，請換一張較小的照片"); return; }
        finish(compressed);
        return;
      }
      throw new Error("no-bitmap-support");
    } catch (err) {
      // 退回傳統方式：用 FileReader + Image 解碼（部分舊版瀏覽器或不支援 createImageBitmap 時）
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > height) { if (width > MAX_SIZE) { height = Math.round(height * (MAX_SIZE / width)); width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width = Math.round(width * (MAX_SIZE / height)); height = MAX_SIZE; } }
            const canvas = document.createElement("canvas");
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.75);
            if (!compressed || compressed === "data:,") { fail("圖片太大，無法處理，請換一張較小的照片"); return; }
            finish(compressed);
          } catch (e2) {
            fail("圖片處理失敗，請換一張較小的照片再試一次");
          }
        };
        img.onerror = () => fail("圖片格式無法讀取，請換一張 JPG 或 PNG 照片試試");
        img.src = ev.target.result;
      };
      reader.onerror = () => fail("圖片讀取失敗，請換一張試試");
      reader.readAsDataURL(file);
    }
  }
  function handleSave() {
    const ok = onSave({ username, bio, avatarPreset, avatarUrl });
    if (ok === false) { setUploadError("儲存失敗，請換一張較小的照片再試一次"); return; }
    onBack();
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
        <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>個人資料</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
        <Avatar user={{ ...user, username, bio, avatarPreset, avatarUrl }} size={72} />
        <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{ fontSize:12, color:CLAY, background:"none", border:"none", cursor:uploading?"default":"pointer", fontFamily:"Inter, sans-serif", fontWeight:600, opacity:uploading?0.6:1 }}>{uploading?"處理中…":"上傳自訂頭像"}</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display:"none" }} />
        {uploadError&&(<div style={{ fontSize:11.5, color:CLAY_DEEP, fontFamily:"Inter, sans-serif", textAlign:"center" }}>{uploadError}</div>)}
      </div>
      <div>
        <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:8, fontWeight:600 }}>預設角色</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {DEFAULT_AVATARS.map(a => (
            <button key={a.id} onClick={()=>{setAvatarPreset(a.id);setAvatarUrl(null);}} style={{ padding:"6px 10px", borderRadius:10, border:`1.5px solid ${avatarPreset===a.id&&!avatarUrl?CLAY:t.border}`, background:avatarPreset===a.id&&!avatarUrl?`${CLAY}15`:t.chip, cursor:"pointer", fontSize:20 }}>{a.emoji}</button>
          ))}
        </div>
      </div>
      <div><div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:6, fontWeight:600 }}>使用者名稱</div><input style={inputStyle} value={username} onChange={e=>setUsername(e.target.value)} /></div>
      <div><div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:6, fontWeight:600 }}>Email（唯讀）</div><input style={{ ...inputStyle, opacity:0.6 }} value={user.email} readOnly /></div>
      <div><div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:6, fontWeight:600 }}>個人簡介</div><textarea style={{ ...inputStyle, height:72, resize:"none" }} value={bio} onChange={e=>setBio(e.target.value)} placeholder="簡單介紹一下自己…" /></div>
      <button onClick={handleSave} style={{ padding:"13px", borderRadius:14, border:"none", background:`linear-gradient(135deg, ${CLAY}, ${CLAY_DEEP})`, color:"#FFFCFA", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>儲存</button>
    </div>
  );
}

/* ══════════════════════════════════════════
   Titles Screen
   ══════════════════════════════════════════ */
function TitlesScreen({ user, onBack, onUpdate, t }) {
  const coins = user.coins || 0;
  const unlocked = user.unlockedTitles || ["rookie"];
  const activeTitle = user.activeTitle || "rookie";
  const [, forceUpdate] = useState(0);

  function unlock(titleId) {
    const title = ALL_TITLES.find(t => t.id === titleId);
    if (!title || coins < title.cost || unlocked.includes(titleId)) return;
    onUpdate({ coins: coins - title.cost, unlockedTitles: [...unlocked, titleId] });
    forceUpdate(n=>n+1);
  }
  function activate(titleId) { onUpdate({ activeTitle: titleId }); forceUpdate(n=>n+1); }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
          <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>稱號商店</span>
        </div>
        <CoinBadge coins={coins} />
      </div>
      <p style={{ fontSize:13, color:t.muted, fontFamily:"Inter, sans-serif", margin:0 }}>用金幣解鎖稱號，然後點選啟用顯示在你的個人資料。</p>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {ALL_TITLES.map(title => {
          const isUnlocked = unlocked.includes(title.id);
          const isActive = activeTitle === title.id;
          const canAfford = coins >= title.cost;
          return (
            <div key={title.id} style={{ background:t.card, border:`1.5px solid ${isActive?CLAY:isUnlocked?`${SAGE}55`:t.border}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ fontSize:28, flexShrink:0 }}>{title.emoji}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:15, color:isUnlocked?t.ink:t.muted }}>{title.label}</div>
                <div style={{ fontSize:11.5, color:t.muted, fontFamily:"Inter, sans-serif", marginTop:2 }}>{title.desc}</div>
              </div>
              <div style={{ flexShrink:0 }}>
                {isUnlocked || title.cost===0 ? (
                  <button onClick={()=>activate(title.id)} disabled={isActive} style={{ padding:"6px 12px", borderRadius:10, border:"none", background:isActive?`${CLAY}18`:`${SAGE}18`, color:isActive?CLAY:SAGE, fontWeight:700, fontSize:12, cursor:isActive?"default":"pointer", fontFamily:"Inter, sans-serif" }}>{isActive?"✓ 使用中":"啟用"}</button>
                ) : (
                  <button onClick={()=>unlock(title.id)} disabled={!canAfford} style={{ padding:"6px 12px", borderRadius:10, border:"none", background:canAfford?`${COIN}20`:t.chip, color:canAfford?COIN:t.mutedSoft, fontWeight:700, fontSize:12, cursor:canAfford?"pointer":"not-allowed", fontFamily:"Inter, sans-serif" }}>🪙 {title.cost}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   角色圖鑑（男生 / 女生 各 16 個，第一次免費，之後統一價格解鎖）
   ══════════════════════════════════════════ */
function CharacterDexScreen({ user, onBack, onUpdate, t }) {
  const coins = user.coins || 0;
  const unlocked = user.unlockedCharacters || [];
  const equippedId = user.characterId || "";
  const hasFreePick = unlocked.length === 0;
  const [genderTab, setGenderTab] = useState("female");
  const [, forceUpdate] = useState(0);
  const [toast, setToast] = useState("");
  const [previewChar, setPreviewChar] = useState(null); // 點縮圖要先預覽再確認
  const [viewEquipped, setViewEquipped] = useState(false); // 放大查看目前裝備角色

  const today = new Date();
  const status = computeCharacterStatus(user, today);
  const equipped = getCharacter(equippedId);

  function confirmPick(charId) {
    const isUnlocked = unlocked.includes(charId);
    if (isUnlocked) {
      onUpdate({ characterId: charId });
      forceUpdate(n=>n+1);
      setPreviewChar(null);
      return;
    }
    if (hasFreePick) {
      onUpdate({ characterId: charId, unlockedCharacters: [...unlocked, charId] });
      setToast("🎉 已免費獲得這個角色！");
      forceUpdate(n=>n+1);
      setPreviewChar(null);
      setTimeout(()=>setToast(""), 2200);
      return;
    }
    if (coins < CHAR_PRICE) { setToast("金幣不足，再多完成幾個習慣吧！"); setTimeout(()=>setToast(""), 2200); return; }
    onUpdate({ coins: coins - CHAR_PRICE, characterId: charId, unlockedCharacters: [...unlocked, charId] });
    setToast("✅ 解鎖成功並已換上新角色！");
    forceUpdate(n=>n+1);
    setPreviewChar(null);
    setTimeout(()=>setToast(""), 2200);
  }

  const list = CHARACTERS.filter(c => c.gender === genderTab);
  const previewIsUnlocked = previewChar && unlocked.includes(previewChar.id);
  const previewIsEquipped = previewChar && equippedId === previewChar.id;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
          <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>角色圖鑑</span>
        </div>
        <CoinBadge coins={coins} />
      </div>

      {equipped && (
        <button onClick={()=>setViewEquipped(true)} style={{ background:t.card, border:`1.5px solid ${status.status==="sick"?`${CLAY_DEEP}55`:`${SAGE}55`}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", textAlign:"left" }}>
          <div style={{ position:"relative", width:64, height:96, borderRadius:14, overflow:"hidden", background:t.chip, flexShrink:0 }}>
            <img src={equipped.img} alt={equipped.name} style={{ width:"100%", height:"100%", objectFit:"contain", filter:status.status==="sick"?"saturate(0.4) brightness(0.85)":"none" }} />
            {status.status==="sick" && (<div style={{ position:"absolute", top:2, right:2, fontSize:16 }}>🤒</div>)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:14, color:t.ink, marginBottom:4 }}>目前裝備：{equipped.name}<span style={{ fontSize:10.5, color:t.muted, fontWeight:400, marginLeft:6 }}>🔍 點擊放大</span></div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <span style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif" }}>{status.status==="sick"?"🤒 生病了":"💚 健康"}</span>
            </div>
            <ProgressBar value={status.health} color={status.status==="sick"?CLAY_DEEP:SAGE} t={t} height={6} />
            {status.status==="sick" && (<div style={{ fontSize:10.5, color:t.muted, fontFamily:"Inter, sans-serif", marginTop:4 }}>連續完成 2 天習慣即可恢復健康（目前 {status.recoveryStreak}/2）</div>)}
          </div>
        </button>
      )}

      <p style={{ fontSize:12.5, color:t.muted, fontFamily:"Inter, sans-serif", margin:0 }}>
        {hasFreePick ? "第一次可以免費選一個角色當作起始角色！之後的角色都需要花金幣解鎖。" : `每個角色解鎖價格統一為 🪙 ${CHAR_PRICE}，解鎖後可以隨時免費切換已擁有的角色。`}
        若忘記完成習慣或本週挑戰，角色會扣血、甚至生病；連續完成 2 天習慣即可恢復健康。
      </p>

      <div style={{ display:"flex", gap:8 }}>
        {[["female","👩 女生"],["male","🧑 男生"]].map(([key,label])=>(
          <button key={key} onClick={()=>setGenderTab(key)} style={{ flex:1, padding:"9px 0", borderRadius:12, border:"none", background:genderTab===key?CLAY:t.chip, color:genderTab===key?"#fff":t.muted, fontWeight:700, fontSize:13, fontFamily:"Inter, sans-serif", cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {toast && (<div style={{ textAlign:"center", fontSize:12.5, color:CLAY, fontFamily:"Inter, sans-serif", fontWeight:700 }}>{toast}</div>)}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
        {list.map(c => {
          const isUnlocked = unlocked.includes(c.id);
          const isEquipped = equippedId === c.id;
          return (
            <button key={c.id} onClick={()=>setPreviewChar(c)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 6px 8px", borderRadius:14, border:`1.5px solid ${isEquipped?CLAY:isUnlocked?`${SAGE}55`:t.border}`, background:t.card, cursor:"pointer", position:"relative" }}>
              <div style={{ width:"100%", aspectRatio:"3/5", borderRadius:10, overflow:"hidden", background:t.chip, position:"relative" }}>
                <img src={c.img} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"contain", filter:isUnlocked?"none":"grayscale(0.85) brightness(0.8)" }} />
                {!isUnlocked && (<div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, background:"rgba(0,0,0,0.08)" }}>🔒</div>)}
                {isEquipped && (<div style={{ position:"absolute", top:3, right:3, background:CLAY, color:"#fff", fontSize:9, fontWeight:700, borderRadius:6, padding:"1px 5px" }}>使用中</div>)}
              </div>
              <div style={{ fontSize:10, color:isUnlocked?t.ink:t.mutedSoft, fontFamily:"Inter, sans-serif", fontWeight:600 }}>
                {isUnlocked ? (isEquipped ? "✓ 使用中" : "點擊查看") : hasFreePick ? "🎁 免費" : `🪙 ${CHAR_PRICE}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* 角色預覽／確認購買 Modal */}
      {previewChar && (
        <div onClick={()=>setPreviewChar(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:t.card, borderRadius:20, padding:18, width:"100%", maxWidth:300, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ width:"100%", aspectRatio:"3/5", borderRadius:14, overflow:"hidden", background:t.chip }}>
              <img src={previewChar.img} alt={previewChar.name} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:16, color:t.ink, marginBottom:4 }}>{previewChar.name}</div>
              <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif" }}>
                {previewIsUnlocked ? (previewIsEquipped ? "目前正在使用這個角色" : "已擁有，可直接裝備") : hasFreePick ? "🎁 第一次免費選擇起始角色" : `解鎖價格：🪙 ${CHAR_PRICE}`}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setPreviewChar(null)} style={{ flex:1, padding:"10px 0", borderRadius:12, border:`1px solid ${t.border}`, background:"none", color:t.muted, fontWeight:700, fontSize:13, fontFamily:"Inter, sans-serif", cursor:"pointer" }}>取消</button>
              {previewIsEquipped ? (
                <button disabled style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:t.chip, color:t.mutedSoft, fontWeight:700, fontSize:13, fontFamily:"Inter, sans-serif" }}>✓ 使用中</button>
              ) : (
                <button onClick={()=>confirmPick(previewChar.id)} disabled={!previewIsUnlocked && !hasFreePick && coins < CHAR_PRICE} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:(!previewIsUnlocked && !hasFreePick && coins < CHAR_PRICE)?t.chip:CLAY, color:(!previewIsUnlocked && !hasFreePick && coins < CHAR_PRICE)?t.mutedSoft:"#fff", fontWeight:700, fontSize:13, fontFamily:"Inter, sans-serif", cursor:"pointer" }}>
                  {previewIsUnlocked ? "裝備這個角色" : hasFreePick ? "確認免費解鎖" : `確認購買 🪙 ${CHAR_PRICE}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 目前裝備角色放大檢視 */}
      {viewEquipped && equipped && (
        <div onClick={()=>setViewEquipped(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:320, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ width:"100%", aspectRatio:"3/5", borderRadius:18, overflow:"hidden", background:t.card }}>
              <img src={equipped.img} alt={equipped.name} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
            </div>
            <div style={{ textAlign:"center", color:"#fff", fontFamily:"Fraunces, serif", fontWeight:700, fontSize:15 }}>{equipped.name}</div>
            <button onClick={()=>setViewEquipped(false)} style={{ alignSelf:"center", padding:"8px 20px", borderRadius:12, border:"none", background:"rgba(255,255,255,0.16)", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"Inter, sans-serif", cursor:"pointer" }}>關閉</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   Friends Screen（Google Sheet 搜尋 + 好友邀請）
   ══════════════════════════════════════════ */
function FriendsScreen({ user, onBack, t }) {
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [tab, setTab] = useState("friends");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [friendCache, setFriendCache] = useState({});
  const [loadingFriend, setLoadingFriend] = useState(null);
  const [, forceUpdate] = useState(0);
      const today = new Date();
  const [selfSyncing, setSelfSyncing] = useState(false);

  // 重新從後端拉自己最新的資料（friendIds / pendingFriendRequests）。
  // 對方在「他自己的」裝置上同意好友邀請，只會更新後端的 Sheet，不會主動推給我；
  // 所以打開好友頁面時要自己去後端問一次「我現在的好友名單是什麼」，否則本機快取的舊資料永遠不會更新。
  async function refreshSelfFromGAS() {
    if (!GAS_CONFIGURED || !user.email) return;
    setSelfSyncing(true);
    try {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) { updateUser(user.id, freshData); forceUpdate(n => n + 1); }
    } finally { setSelfSyncing(false); }
  }

  useEffect(() => { refreshSelfFromGAS(); }, []);


  useEffect(() => {
    if (tab === "friends" || tab === "pending") {
      const ids = tab === "friends" ? getLocalFriendIds() : getPendingRequests();
      ids.forEach(id => {
        const cached = getFriendData(id);
        const local = getUserById(id);
        const email = (cached && cached.email) || (local && local.email);
        if (email) {
          // 每次打開頁面都重新抓一次最新資料，這樣好友剛打卡完不用手動按同步就能看到
          fetchFriendFromGAS(id, email);
        } else if (GAS_CONFIGURED) {
          // 本地完全沒有這個 ID 的資料（跨裝置加的好友），改用 ID 查詢後端
          fetchFriendByIdFromGAS(id);
        }
      });
    }
  }, [tab]);

  function getLocalFriendIds() { return getUserById(user.id)?.friendIds || []; }
  function getPendingRequests() { return getUserById(user.id)?.pendingFriendRequests || []; }
  function getFriendData(id) { return friendCache[id] || getUserById(id) || null; }

  async function fetchFriendFromGAS(friendId, email) {
    if (!GAS_CONFIGURED || !email) return;
    setLoadingFriend(friendId);
    try {
      const data = await gasFetchByEmail(email);
      if (data && data.id !== user.id) {
        if (typeof data.habits === "string") {
          try { data.habits = JSON.parse(data.habits); } catch { data.habits = []; }
        }
        setFriendCache(prev => ({ ...prev, [friendId]: data }));
      }
    } finally {
      setLoadingFriend(null);
    }
  }

  // 用 ID 查詢後端（用於本機完全沒有該好友任何資料的跨裝置情況）
  async function fetchFriendByIdFromGAS(friendId) {
    if (!GAS_CONFIGURED) return;
    setLoadingFriend(friendId);
    try {
      const data = await gasFetchById(friendId);
      if (data && data.id !== user.id) {
        if (typeof data.habits === "string") {
          try { data.habits = JSON.parse(data.habits); } catch { data.habits = []; }
        }
        setFriendCache(prev => ({ ...prev, [friendId]: data }));
      }
    } finally {
      setLoadingFriend(null);
    }
  }

  async function handleSearch() {
    setSearchError(""); setSearchResult(null);
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      let found = null;
      if (GAS_CONFIGURED) {
        const u = await gasFetchByEmail(searchEmail.trim());
        found = (u && u.id !== user.id) ? u : null;
      }
      if (!found) {
        found = getAllUsers().find(u => u.email === searchEmail.trim() && u.id !== user.id) || null;
      }
      if (!found) { setSearchError("找不到此使用者"); }
      else { setSearchResult(found); }
    } finally { setSearching(false); }
  }

  // ✅ 新增：發送好友邀請
  async function sendFriendRequest(receiverEmailOrUsername) {
    if (!GAS_CONFIGURED) {
      alert("尚未連接 Google Sheet，無法發送邀請");
      return;
    }
    
    setSearching(true);
    const res = await gasSendFriendRequest(user.id, receiverEmailOrUsername);
    setSearching(false);
    
    if (!res.ok) {
      alert("❌ " + (res.error || "發送邀請失敗"));
      return;
    }
    
    alert("✅ 好友邀請已發送！");
    setSearchResult(null);
    setSearchEmail("");
    
    if (GAS_CONFIGURED && user.email) {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) {
        updateUser(user.id, freshData);
        forceUpdate(n => n + 1);
      }
    }
  }

  // ✅ 新增：接受好友邀請
  async function acceptRequest(senderId) {
    if (!GAS_CONFIGURED) {
      alert("尚未連接 Google Sheet，無法接受邀請");
      return;
    }
    
    const res = await gasAcceptFriendRequest(user.id, senderId);
    if (!res.ok) {
      alert("❌ " + (res.error || "接受邀請失敗"));
      return;
    }
    
    alert("✅ 已接受好友邀請！");
    
    if (GAS_CONFIGURED && user.email) {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) {
        updateUser(user.id, freshData);
        forceUpdate(n => n + 1);
      }
    }
  }

  // ✅ 新增：拒絕好友邀請
  async function rejectRequest(senderId) {
    if (!GAS_CONFIGURED) {
      alert("尚未連接 Google Sheet，無法拒絕邀請");
      return;
    }
    
    const res = await gasRejectFriendRequest(user.id, senderId);
    if (!res.ok) {
      alert("❌ " + (res.error || "拒絕邀請失敗"));
      return;
    }
    
    alert("✅ 已拒絕好友邀請");
    
    if (GAS_CONFIGURED && user.email) {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) {
        updateUser(user.id, freshData);
        forceUpdate(n => n + 1);
      }
    }
  }

  function removeFriend(friendId) {
    const u = getUserById(user.id); if (!u) return;
    updateUser(user.id, { friendIds: (u.friendIds||[]).filter(id => id !== friendId) });
    forceUpdate(n=>n+1);
  }

  function sendReminder(friendId) {
    const reminders = loadJSON(REMINDERS_KEY, {});
    const key = `${user.id}_${friendId}_${toKey(today)}`;
    const count = reminders[key] || 0;
    if (count >= 3) { alert("今天已達每日提醒上限（3次）"); return; }
    reminders[key] = count + 1; saveJSON(REMINDERS_KEY, reminders);
    forceUpdate(n=>n+1); alert(`✅ 已向好友發送提醒！（今日第 ${count+1}/3 次）`);
  }

  function getReminderCount(friendId) { return loadJSON(REMINDERS_KEY, {})[`${user.id}_${friendId}_${toKey(today)}`] || 0; }

  const friendIds = getLocalFriendIds();
  const pendingRequestIds = getPendingRequests();

  
  if (selectedFriendId) {
    const selectedFriend = getFriendData(selectedFriendId);
    if (selectedFriend) {
      return <FriendDetailView friend={selectedFriend} onBack={() => setSelectedFriendId(null)} t={t} onRefresh={()=>fetchFriendFromGAS(selectedFriendId, selectedFriend.email)} refreshing={loadingFriend===selectedFriendId} />;
    }
  }
  
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
        <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink, flex:1 }}>好友 · 監督</span>
        <button onClick={refreshSelfFromGAS} disabled={selfSyncing} style={{ border:"none", background:t.chip, borderRadius:10, padding:"6px 10px", cursor:selfSyncing?"default":"pointer", fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600, opacity:selfSyncing?0.6:1 }}>{selfSyncing?"同步中…":"🔄 重新整理"}</button>
      </div>

      <div style={{ background:GAS_CONFIGURED?`${SAGE}18`:`${GOLD}18`, border:`1px solid ${GAS_CONFIGURED?SAGE:GOLD}44`, borderRadius:10, padding:"8px 12px", fontSize:11.5, color:GAS_CONFIGURED?SAGE:GOLD, fontFamily:"Inter, sans-serif", fontWeight:600 }}>
        {GAS_CONFIGURED ? "✅ 已連線 Google Sheet，支援跨裝置邀請與習慣同步" : "⚠️ 本機模式：請設定 GAS_URL 以支援跨手機邀請"}
      </div>

      <div style={{ display:"flex", background:t.chip, borderRadius:12, padding:3, gap:3 }}>
        {[
          ["friends",`好友（${friendIds.length}/50）`],
          ["pending",`待處理（${pendingRequestIds.length}）`],
          ["add","發送邀請"]
        ].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:tab===k?t.card:"transparent", color:tab===k?t.ink:t.muted, fontWeight:700, fontSize:12.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>{l}</button>
        ))}
      </div>

      {/* ── 待處理邀請 tab ── */}
      {tab === "pending" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {pendingRequestIds.length === 0 && (
            <div style={{ textAlign:"center", color:t.muted, fontSize:13.5, padding:"30px 0", fontFamily:"Inter, sans-serif" }}>沒有待處理的邀請</div>
          )}
          {pendingRequestIds.map(senderId => {
            const senderData = getUserById(senderId);
            if (!senderData) return (
              <div key={senderId} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <div style={{ color:t.muted, fontSize:13, fontFamily:"Inter, sans-serif" }}>載入中…</div>
              </div>
            );
            return (
              <div key={senderId} style={{ background:t.card, border:`1.5px solid ${SAGE}55`, borderRadius:18, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                  <Avatar user={senderData} size={44} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:t.ink, fontFamily:"Fraunces, serif" }}>{senderData.username}</div>
                    <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{senderData.email}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>acceptRequest(senderId)}
                    style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:`${SAGE}22`, color:SAGE, fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                    ✓ 接受
                  </button>
                  <button onClick={()=>rejectRequest(senderId)}
                    style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:`${CLAY_DEEP}22`, color:CLAY_DEEP, fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                    ✕ 拒絕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 發送邀請 tab ── */}
      {tab === "add" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <p style={{ fontSize:13, color:t.muted, margin:0, fontFamily:"Inter, sans-serif" }}>
            輸入對方 Email 發送邀請。{GAS_CONFIGURED ? "支援跨裝置！" : "目前限同一裝置。"}
          </p>
          <input
            value={searchEmail} onChange={e=>setSearchEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSearch()}
            placeholder="對方的 Email" type="email"
            style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1px solid ${t.borderStrong}`, background:t.cardAlt, color:t.ink, fontSize:15, fontFamily:"Inter, sans-serif", outline:"none", boxSizing:"border-box" }}
          />
          <button onClick={handleSearch} disabled={searching}
            style={{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:searching?t.chip:`linear-gradient(135deg,${CLAY},${CLAY_DEEP})`, color:searching?t.muted:"#FFFCFA", fontWeight:700, fontSize:14, cursor:searching?"not-allowed":"pointer", fontFamily:"Inter, sans-serif" }}>
            {searching ? "搜尋中…" : "🔍 搜尋使用者"}
          </button>
          {searchError && <p style={{ color:CLAY_DEEP, fontSize:13, margin:0, fontFamily:"Inter, sans-serif", textAlign:"center" }}>{searchError}</p>}
          {searchResult && (
            <div style={{ background:t.card, border:`1.5px solid ${SAGE}55`, borderRadius:16, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <Avatar user={searchResult} size={44} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:t.ink, fontFamily:"Fraunces, serif" }}>{searchResult.username}</div>
                  <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{searchResult.email}</div>
                </div>
              </div>
              <button onClick={()=>sendFriendRequest(searchResult.email)}
                style={{ width:"100%", padding:"10px", borderRadius:10, border:"none", background:`${SAGE}22`, color:SAGE, fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                📨 發送邀請
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 好友列表 tab ── */}
      {tab === "friends" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {friendIds.length === 0 && (
            <div style={{ textAlign:"center", color:t.muted, fontSize:13.5, padding:"30px 0", fontFamily:"Inter, sans-serif" }}>還沒有好友，去發送邀請吧！</div>
          )}
          {friendIds.map(fid => {
            const fData = getFriendData(fid);
            const remCount = getReminderCount(fid);
            if (!fData) return (
              <div key={fid} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <div style={{ color:t.muted, fontSize:13, fontFamily:"Inter, sans-serif" }}>
                  {loadingFriend===fid ? "載入中…" : "⚠️ 找不到好友資料（可能在其他裝置）"}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {GAS_CONFIGURED && (
                    <button onClick={()=>fetchFriendByIdFromGAS(fid)} disabled={loadingFriend===fid}
                      style={{ padding:"5px 10px", borderRadius:9, border:"none", background:t.chip, color:t.muted, fontWeight:700, fontSize:11, cursor:"pointer" }}>🔄 重新查詢</button>
                  )}
                  <button onClick={()=>removeFriend(fid)}
                    style={{ padding:"5px 10px", borderRadius:9, border:"none", background:`${CLAY_DEEP}14`, color:CLAY_DEEP, fontWeight:700, fontSize:11, cursor:"pointer" }}>移除</button>
                </div>
              </div>
            );
            return (
              <div key={fid}>
                {GAS_CONFIGURED && fData.email && (
                  <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
                    <button onClick={()=>fetchFriendFromGAS(fid, fData.email)} disabled={loadingFriend===fid}
                      style={{ padding:"4px 10px", borderRadius:8, border:"none", background:t.chip, color:t.muted, fontSize:11, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                      {loadingFriend===fid ? "同步中…" : "🔄 同步最新習慣"}
                    </button>
                  </div>
                )}
                <div onClick={() => setSelectedFriendId(fid)} style={{ cursor:"pointer" }}>
                <FriendHabitCard
                  friend={fData}
                  t={t}
                  onRemind={() => sendReminder(fid)}
                  remCount={remCount}
                />
              </div>
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:4 }}>
                  <button onClick={()=>removeFriend(fid)}
                    style={{ padding:"4px 10px", borderRadius:8, border:"none", background:`${CLAY_DEEP}14`, color:CLAY_DEEP, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                    移除好友
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   排行榜 — 與好友比較經驗值排名
   ══════════════════════════════════════════ */
function LeaderboardScreen({ user, onBack, t }) {
  const [friendCache, setFriendCache] = useState({});
  const [loading, setLoading] = useState(true);

  const friendIds = getUserById(user.id)?.friendIds || [];

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const next = {};
      for (const id of friendIds) {
        let data = getUserById(id);
        if ((!data || !data.username) && GAS_CONFIGURED) {
          if (data && data.email) {
            data = await gasFetchByEmail(data.email);
          } else {
            data = await gasFetchById(id);
          }
        }
        if (data) {
          if (typeof data.habits === "string") {
            try { data.habits = JSON.parse(data.habits); } catch { data.habits = []; }
          }
          next[id] = data;
        }
      }
      if (mounted) { setFriendCache(next); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [friendIds.join(",")]);

  const freshSelf = getUserById(user.id) || user;
  const entries = [
    { ...freshSelf, isYou: true },
    ...friendIds.map(id => friendCache[id]).filter(Boolean),
  ];

  const ranked = entries
    .map(u => ({ ...u, xp: computeUserXP(u) }))
    .sort((a, b) => b.xp - a.xp)
    .map((u, idx) => ({ ...u, rank: idx + 1 }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
        <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>排行榜 · 經驗值</span>
      </div>

      {!GAS_CONFIGURED && (
        <div style={{ background:`${GOLD}18`, border:`1px solid ${GOLD}44`, borderRadius:10, padding:"8px 12px", fontSize:11.5, color:GOLD, fontFamily:"Inter, sans-serif", fontWeight:600 }}>
          ⚠️ 本機模式：排行榜僅顯示自己，請設定 GAS_URL 以比較好友排名
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", color:t.muted, fontSize:13.5, padding:"30px 0", fontFamily:"Inter, sans-serif" }}>載入排名中…</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {ranked.map(item => {
            const { level } = levelInfo(item.xp);
            const medal = item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : item.rank === 3 ? "🥉" : `#${item.rank}`;
            return (
              <div key={item.id} style={{
                display:"flex", alignItems:"center", gap:12,
                background: item.isYou ? `${GOLD}14` : t.card,
                border: item.isYou ? `1.5px solid ${GOLD}66` : `1px solid ${t.border}`,
                borderRadius:16, padding:"12px 14px",
              }}>
                <div style={{ width:32, textAlign:"center", fontSize: item.rank<=3 ? 20 : 14, fontWeight:700, color: item.rank<=3 ? GOLD : t.muted, fontFamily:"Fraunces, serif" }}>{medal}</div>
                <Avatar user={item} size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:t.ink, fontFamily:"Fraunces, serif", display:"flex", alignItems:"center", gap:6 }}>
                    {item.username}{item.isYou && <span style={{ fontSize:10, color:GOLD, fontWeight:700 }}>（你）</span>}
                  </div>
                  <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif" }}>Lv.{level}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:GOLD, fontFamily:"Fraunces, serif" }}>{item.xp}</div>
                  <div style={{ fontSize:10, color:t.muted, fontFamily:"Inter, sans-serif" }}>XP</div>
                </div>
              </div>
            );
          })}
          {friendIds.length === 0 && (
            <div style={{ textAlign:"center", color:t.muted, fontSize:13, padding:"10px 0", fontFamily:"Inter, sans-serif" }}>加幾個好友後就能看到排名比較囉！</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   寵物扭蛋商店
   ══════════════════════════════════════════ */
function PetCard({ pet, t, size = "medium" }) {
  const meta = RARITY_META[pet.rarity] || RARITY_META.common;
  const dims = size === "large" ? 72 : size === "small" ? 40 : 56;
  const fontSize = size === "large" ? 38 : size === "small" ? 22 : 30;
  const glow = pet.rarity === "ssr" || pet.rarity === "hidden"
    ? `0 0 14px ${meta.color}aa`
    : pet.rarity === "legend" ? `0 0 8px ${meta.color}77` : "none";
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
      background: `${meta.color}14`, border:`1.5px solid ${meta.color}55`,
      borderRadius:14, padding:"10px 6px", textAlign:"center",
    }}>
      <div style={{ width:dims, height:dims, display:"flex", alignItems:"center", justifyContent:"center", fontSize, boxShadow:glow, borderRadius:"50%" }}>
        {pet.emoji}
      </div>
      <div style={{ fontSize: size==="small"?10:11.5, fontWeight:700, color:t.ink, fontFamily:"Inter, sans-serif" }}>{pet.name}</div>
      <div style={{ fontSize:9.5, fontWeight:700, color:meta.color, fontFamily:"Inter, sans-serif" }}>{meta.label}</div>
      {pet.personality && <div style={{ fontSize:9, color:t.muted, fontFamily:"Inter, sans-serif" }}>{pet.personality}</div>}
    </div>
  );
}

function PetShopScreen({ user, onBack, onUpdateUser, t }) {
  const [gachaResult, setGachaResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const fresh = getUserById(user.id) || user;
  const coins = fresh.coins || 0;
  const pets = fresh.pets || [];
  const canGacha = coins >= GACHA_COST;

  function handleGacha() {
    if (!canGacha || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      const newPet = performGacha();
      const updatedPets = [...pets, newPet];
      const updatedCoins = coins - GACHA_COST;
      onUpdateUser({ pets: updatedPets, coins: updatedCoins });
      setGachaResult(newPet);
      setIsAnimating(false);
    }, 1200);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
        <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>寵物扭蛋商店</span>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:"14px 16px" }}>
        <div style={{ fontSize:13, color:t.muted, fontFamily:"Inter, sans-serif" }}>目前金幣</div>
        <CoinBadge coins={coins} />
      </div>

      <div style={{ background:t.cardAlt, borderRadius:14, padding:"12px 14px", fontSize:11.5, color:t.muted, fontFamily:"Inter, sans-serif", lineHeight:1.7 }}>
        🎰 扭蛋機率：普通 60% · 傳說 30% · SSR 10%（還有極低機率的隱藏款彩蛋！）
      </div>

      <button onClick={handleGacha} disabled={!canGacha || isAnimating} style={{
        padding:"16px", borderRadius:16, border:"none",
        background: (!canGacha||isAnimating) ? t.chip : `linear-gradient(135deg, ${AMETHYST}, ${CLAY_DEEP})`,
        color: (!canGacha||isAnimating) ? t.muted : "#FFFCFA",
        fontWeight:700, fontSize:15, cursor: (!canGacha||isAnimating) ? "not-allowed" : "pointer",
        fontFamily:"Inter, sans-serif",
      }}>
        {isAnimating ? "轉動中... ✨" : canGacha ? `🎰 扭蛋一次 (${GACHA_COST} 金幣)` : `金幣不足（需要 ${GACHA_COST}）`}
      </button>

      {gachaResult && (
        <div style={{ position:"fixed", inset:0, background:t.overlay, backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }} onClick={()=>setGachaResult(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:t.card, borderRadius:24, padding:"28px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:14, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", maxWidth:280 }}>
            <div style={{ fontFamily:"Fraunces, serif", fontSize:16, fontWeight:700, color:t.ink }}>
              {gachaResult.rarity === "hidden" ? "🎉 隱藏款！太幸運了！" : gachaResult.rarity === "ssr" ? "🌈 SSR！超稀有！" : gachaResult.rarity === "legend" ? "🌟 傳說等級！" : "獲得新寵物！"}
            </div>
            <PetCard pet={gachaResult} t={t} size="large" />
            {(gachaResult.color || gachaResult.pattern || gachaResult.look) && (
              <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif", textAlign:"center" }}>
                {[gachaResult.color, gachaResult.pattern, gachaResult.look].filter(Boolean).join(" · ")}
              </div>
            )}
            <button onClick={()=>setGachaResult(null)} style={{ width:"100%", padding:"10px", borderRadius:12, border:"none", background:`${CLAY}22`, color:CLAY_DEEP, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>太好了！</button>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600, marginBottom:10 }}>我的寵物收藏 ({pets.length})</div>
        {pets.length === 0 ? (
          <div style={{ textAlign:"center", color:t.muted, fontSize:12, padding:"20px 0", fontFamily:"Inter, sans-serif" }}>還沒有寵物，扭一次試試看吧！</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(80px, 1fr))", gap:8 }}>
            {pets.slice().reverse().map(pet => <PetCard key={pet.instanceId} pet={pet} t={t} size="small" />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Habit Form Sheet
   ══════════════════════════════════════════ */
function HabitFormSheet({ initial, onClose, onSave, t }) {
  const [name, setName] = useState(initial?.name||"");
  const [emoji, setEmoji] = useState(initial?.emoji||"🎯");
  const [category, setCategory] = useState(initial?.category||"growth");
  return (
    <div style={{ position:"fixed", inset:0, background:t.overlay, backdropFilter:"blur(2px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:55 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:"100vw", background:t.card, borderRadius:"24px 24px 0 0", padding:"20px 16px max(env(safe-area-inset-bottom,28px),28px)", boxShadow:"0 -10px 40px rgba(0,0,0,0.25)", maxHeight:"90dvh", overflowY:"auto", boxSizing:"border-box" }}>
        <div style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink, marginBottom:16 }}>{initial?"編輯習慣":"新增習慣"}</div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600, marginBottom:6 }}>習慣名稱</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="例：每天喝水 2 公升" style={{ width:"100%", padding:"11px 13px", borderRadius:12, border:`1px solid ${t.borderStrong}`, background:t.cardAlt, color:t.ink, fontSize:15, fontFamily:"Inter, sans-serif", outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600, marginBottom:8 }}>選擇 Emoji</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {EMOJI_CHOICES.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ width:40, height:40, borderRadius:10, border:`1.5px solid ${emoji===e?CLAY:t.border}`, background:emoji===e?`${CLAY}18`:t.chip, fontSize:20, cursor:"pointer" }}>{e}</button>)}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600, marginBottom:8 }}>分類</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {CATEGORIES.map(c=><button key={c.key} onClick={()=>setCategory(c.key)} style={{ padding:"6px 12px", borderRadius:10, border:`1.5px solid ${category===c.key?c.color:t.border}`, background:category===c.key?`${c.color}18`:t.chip, color:category===c.key?c.color:t.muted, fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>{c.emoji} {c.label}</button>)}
          </div>
        </div>
        <button onClick={()=>{if(!name.trim())return;onSave({name,emoji,category});onClose();}} style={{ width:"100%", padding:"13px", borderRadius:14, border:"none", background:`linear-gradient(135deg, ${CLAY}, ${CLAY_DEEP})`, color:"#FFFCFA", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>儲存</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Friend Detail View - 好友詳細進度視圖
   展示好友的每日習慣完成情況、每週進度、每月統計
   ══════════════════════════════════════════ */

function FriendDetailView({ friend, onBack, t }) {
  const today = new Date();
  const todayKey = toKey(today);
  const habits = friend.habits || [];
  
  // 計算每日進度
  const dailyCompleted = habits.filter(h => (h.completions||[]).includes(todayKey)).length;
  const dailyTotal = habits.length;
  const dailyPct = dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0;
  
  // 計算每週進度
  const weekStart = startOfWeek(today);
  const weekDays = Array.from({length:7}).map((_,i) => addDays(weekStart, i));
  const weekCompleted = habits.reduce((sum, h) => {
    const daysCompleted = weekDays.filter(d => (h.completions||[]).includes(toKey(d))).length;
    return sum + daysCompleted;
  }, 0);
  const weekTotal = habits.length * 7;
  const weekPct = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  
  // 計算每月進度
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthDays = (monthEnd.getDate());
  const monthCompleted = habits.reduce((sum, h) => {
    let count = 0;
    for (let i = 1; i <= monthDays; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), i);
      if (d <= today && (h.completions||[]).includes(toKey(d))) count++;
    }
    return sum + count;
  }, 0);
  const monthTotal = habits.length * monthDays;
  const monthPct = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;
  
  // 計算連續天數
  const streak = habits.length > 0 ? Math.max(...habits.map(h => computeStreak(h.completions||[], today))) : 0;
  
  // 計算等級
  const xp = computeUserXP(friend);
  const { level } = levelInfo(xp);
  const plant = plantStage(level);
  
  // 角色裝備與健康狀態
  const friendCharacter = getCharacter(friend.characterId);
  const friendCharStatus = computeCharacterStatus(friend, today);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* 頭部：返回按鈕 + 好友名稱 */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
        <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>
          {friend.username} 的進度
        </span>
      </div>
      
      {/* 好友卡片：頭像、等級、連續天數 */}
      <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"16px", display:"flex", gap:12 }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, flexShrink:0 }}>
          <Avatar user={friend} size={56} />
          <div style={{ fontSize:24 }}>{plant.emoji}</div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:15, color:t.ink, marginBottom:2 }}>
            {friend.username}
          </div>
          <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:8 }}>
            Lv.{level} · 🔥 {streak} 天連續
          </div>
          {friend.bio && (
            <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", fontStyle:"italic" }}>
              "{friend.bio}"
            </div>
          )}
        </div>
      </div>

      {/* 好友的角色裝備 */}
      {friendCharacter && (
        <div style={{ background:t.card, border:`1.5px solid ${friendCharStatus.status==="sick"?`${CLAY_DEEP}55`:`${SAGE}55`}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ position:"relative", width:54, height:54, borderRadius:12, overflow:"hidden", background:t.chip, flexShrink:0 }}>
            <img src={friendCharacter.img} alt={friendCharacter.name} style={{ width:"100%", height:"100%", objectFit:"cover", filter:friendCharStatus.status==="sick"?"saturate(0.4) brightness(0.85)":"none" }} />
            {friendCharStatus.status==="sick" && (<div style={{ position:"absolute", top:1, right:1, fontSize:14 }}>🤒</div>)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:2 }}>裝備角色</div>
            <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13, color:t.ink, marginBottom:4 }}>{friendCharacter.name} · {friendCharStatus.status==="sick"?"🤒 生病了":"💚 健康"}</div>
            <ProgressBar value={friendCharStatus.health} color={friendCharStatus.status==="sick"?CLAY_DEEP:SAGE} t={t} height={5} />
          </div>
        </div>
      )}
      
      {/* 進度統計卡片 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <StatCard label="今日進度" value={`${dailyPct}%`} color={SAGE} t={t} />
        <StatCard label="本週進度" value={`${weekPct}%`} color={AMETHYST} t={t} />
        <StatCard label="本月進度" value={`${monthPct}%`} color={GOLD} t={t} />
      </div>
      
      {/* 詳細進度條 */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {/* 每日進度 */}
        <div style={{ background:t.cardAlt, borderRadius:14, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontFamily:"Inter, sans-serif", fontWeight:700, fontSize:12, color:t.ink }}>今日習慣</span>
            <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13, color:SAGE }}>{dailyCompleted}/{dailyTotal}</span>
          </div>
          <ProgressBar value={dailyPct} color={SAGE} t={t} height={6} />
        </div>
        
        {/* 每週進度 */}
        <div style={{ background:t.cardAlt, borderRadius:14, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontFamily:"Inter, sans-serif", fontWeight:700, fontSize:12, color:t.ink }}>本週習慣</span>
            <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13, color:AMETHYST }}>{weekCompleted}/{weekTotal}</span>
          </div>
          <ProgressBar value={weekPct} color={AMETHYST} t={t} height={6} />
        </div>
        
        {/* 每月進度 */}
        <div style={{ background:t.cardAlt, borderRadius:14, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontFamily:"Inter, sans-serif", fontWeight:700, fontSize:12, color:t.ink }}>本月習慣</span>
            <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13, color:GOLD }}>{monthCompleted}/{monthTotal}</span>
          </div>
          <ProgressBar value={monthPct} color={GOLD} t={t} height={6} />
        </div>
      </div>
      
      {/* 習慣清單 */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ fontFamily:"Fraunces, serif", fontSize:14, fontWeight:600, color:t.ink }}>
          習慣清單 ({habits.length})
        </div>
        {habits.length === 0 ? (
          <div style={{ textAlign:"center", color:t.muted, fontSize:12, padding:"20px 0", fontFamily:"Inter, sans-serif" }}>
            還沒有習慣
          </div>
        ) : (
          habits.map(habit => {
            const streak = computeStreak(habit.completions||[], today);
            const completedDays = new Set(habit.completions||[]).size;
            const todayDone = (habit.completions||[]).includes(todayKey);
            const weekDone = weekDays.filter(d => (habit.completions||[]).includes(toKey(d))).length;
            
            return (
              <div key={habit.id} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:14, padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:20 }}>{habit.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"Inter, sans-serif", fontWeight:600, fontSize:13, color:t.ink }}>
                      {habit.name}
                    </div>
                    <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif" }}>
                      {completedDays} 天完成 · 🔥 {streak} 天連續
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:20 }}>{todayDone ? "✅" : "⭕"}</div>
                    <div style={{ fontSize:10, color:t.muted, fontFamily:"Inter, sans-serif" }}>今日</div>
                  </div>
                </div>
                
                {/* 本週日期進度 */}
                <div style={{ display:"flex", gap:4, marginTop:8 }}>
                  {weekDays.map((d, i) => {
                    const key = toKey(d);
                    const done = (habit.completions||[]).includes(key);
                    const isToday = d.toDateString() === today.toDateString();
                    const isFuture = d > today;
                    
                    return (
                      <div
                        key={i}
                        style={{
                          flex:1,
                          height:24,
                          borderRadius:6,
                          background: isFuture ? t.chip : done ? SAGE : `${SAGE}33`,
                          display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          fontSize:10,
                          fontWeight:700,
                          color: isFuture ? t.muted : done ? "#FFFCFA" : SAGE,
                          border: isToday ? `2px solid ${SAGE}` : "none",
                          boxSizing:"border-box",
                          cursor:"default",
                          title: `${["日","一","二","三","四","五","六"][d.getDay()]} ${d.getDate()}`
                        }}
                      >
                        {done ? "✓" : d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════
   Friend Habit Card
   ══════════════════════════════════════════ */
function FriendHabitCard({ friend, t, onRemind, remCount }) {
  const today = new Date();
  const todayKey = toKey(today);
  const habits = friend.habits || [];
  const completed = habits.filter(h => (h.completions||[]).includes(todayKey)).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const streak = habits.length > 0 ? Math.max(...habits.map(h => computeStreak(h.completions||[], today))) : 0;
  const xp = computeUserXP(friend);
  const { level } = levelInfo(xp);
  const plant = plantStage(level);
  const friendCharacter = getCharacter(friend.characterId);
  const friendCharStatus = computeCharacterStatus(friend, today);
  return (
    <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"16px", display:"flex", gap:12 }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ position:"relative" }}>
          <Avatar user={friend} size={56} />
          {friendCharacter && (
            <div style={{ position:"absolute", bottom:-4, right:-4, width:24, height:24, borderRadius:8, overflow:"hidden", border:`2px solid ${t.card}`, background:t.chip }}>
              <img src={friendCharacter.img} alt={friendCharacter.name} style={{ width:"100%", height:"100%", objectFit:"cover", filter:friendCharStatus.status==="sick"?"saturate(0.4) brightness(0.85)":"none" }} />
            </div>
          )}
          {friendCharacter && friendCharStatus.status==="sick" && (<div style={{ position:"absolute", top:-4, right:-6, fontSize:13 }}>🤒</div>)}
        </div>
        <div style={{ fontSize:28 }}>{plant.emoji}</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:15, color:t.ink, marginBottom:2 }}>{friend.username}</div>
        <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif", marginBottom:8 }}>Lv.{level} · 🔥 {streak} 天連續</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <ProgressBar value={pct} color={SAGE} t={t} height={6} />
          </div>
          <span style={{ fontSize:12, fontFamily:"Fraunces, serif", fontWeight:700, color:SAGE }}>{completed}/{total}</span>
        </div>
        <button onClick={onRemind} disabled={remCount>=3} style={{ width:"100%", padding:"6px", borderRadius:8, border:"none", background:remCount>=3?t.chip:`${AMETHYST}22`, color:remCount>=3?t.muted:AMETHYST, fontWeight:700, fontSize:12, cursor:remCount>=3?"not-allowed":"pointer", fontFamily:"Inter, sans-serif" }}>
          {remCount>=3?`已達提醒上限 (${remCount}/3)`:`📢 提醒 (${remCount}/3)`}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main App
   ══════════════════════════════════════════ */
export default function App() {
  const [darkMode, setDarkMode] = useState(()=>loadJSON("rpg:dark",false));
  const t = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState("auth");
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [subScreen, setSubScreen] = useState(null);
  const [view, setView] = useState("today");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [coinToast, setCoinToast] = useState(null);
  const [, forceUpdate] = useState(0);

  useEffect(()=>{
    const session=getCurrentSession();
    if(session){
      const u=getUserById(session);
      if(u){
        setUserId(session);setUser(u);setScreen("home");
        if (GAS_CONFIGURED && u.email) {
          gasFetchByEmail(u.email).then(remote=>{
            if(remote && remote.id===session){
              updateUser(session, remote);
              setUser(getUserById(session));
            }
          });
        }
      }
    }
  },[]);
  // ✅ 新增：當頁面獲得焦點時，自動從 Google Sheet 重新讀取最新資料
  useEffect(()=>{
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && userId && GAS_CONFIGURED) {
        const u = getUserById(userId);
        if (u && u.email) {
          gasFetchByEmail(u.email).then(remote=>{
            if(remote && remote.id===userId){
              updateUser(userId, remote);
              setUser(getUserById(userId));
            }
          });
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId]);
  
    // ✅ 新增：定期同步本機資料到後端（每 30 秒一次）
  useEffect(() => {
    if (!userId || !GAS_CONFIGURED) return;
    
    const syncInterval = setInterval(() => {
      const u = getUserById(userId);
      if (u) {
        gasSyncUser(u).catch(err => console.warn("背景同步失敗:", err));
      }
    }, 30000); // 每 30 秒同步一次
    
    return () => clearInterval(syncInterval);
  }, [userId]);

  // ✅ 新增：當應用程式重新獲得焦點時，立即同步一次（確保多裝置間的頭像更新）
  useEffect(() => {
    function handleFocus() {
      if (userId && GAS_CONFIGURED) {
        const u = getUserById(userId);
        if (u && u.email) {
          gasFetchByEmail(u.email).then(remote => {
            if (remote && remote.id === userId) {
              updateUser(userId, remote);
              setUser(getUserById(userId));
            }
          }).catch(err => console.warn("焦點同步失敗:", err));
        }
      }
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId]);

  useEffect(()=>{saveJSON("rpg:dark",darkMode);},[darkMode]);

  function refreshUser() { const u=getUserById(userId); if(u){setUser({...u});forceUpdate(n=>n+1);} }
  function showCoinGain(amount,reason) { setCoinToast({amount,reason,id:Date.now()}); setTimeout(()=>setCoinToast(null),2200); }
  function handleLogin(uid) { const u=getUserById(uid); setUserId(uid); setUser(u); setScreen("home"); }
  function handleLogout() { clearSession(); setUserId(null); setUser(null); setScreen("auth"); setSubScreen(null); setView("today"); }
  function handleSaveProfile(patch) {
    const ok = updateUser(userId,patch); refreshUser();
    const updated = getUserById(userId);
    if (updated) gasSyncUser(updated);
    return ok;
  }
  function handleUpdateUser(patch) { updateUser(userId,patch); refreshUser(); }

  function toggleHabit(habitId) {
    const u=getUserById(userId); if(!u) return;
    const today=toKey(new Date());
    let coinEarned=0;
    const habits=(u.habits||[]).map(h=>{
      if(h.id!==habitId) return h;
      const completions=h.completions||[];
      const rewardedDays=h.rewardedDays||[];
      const alreadyDone=completions.includes(today);
      if(alreadyDone){
        return {...h,completions:completions.filter(d=>d!==today)};
      } else {
        if(!rewardedDays.includes(today)){
          coinEarned=COINS_PER_CHECKIN;
          return {...h,completions:[...completions,today],rewardedDays:[...rewardedDays,today]};
        }
        return {...h,completions:[...completions,today]};
      }
    });
    updateUser(userId,{habits});
    if(coinEarned>0){ updateUser(userId,{coins:(u.coins||0)+coinEarned}); showCoinGain(coinEarned,"習慣打卡"); }
    const updatedU=getUserById(userId);
    const challenge=getWeekChallenge(updatedU?.habits||[],new Date());
    if(challenge?.complete){
      const claimed=(updatedU?.claimedChallenges||[]).includes(challenge.wsKey);
      if(!claimed){
        updateUser(userId,{coins:(updatedU?.coins||0)+COINS_CHALLENGE_COMPLETE,claimedChallenges:[...(updatedU?.claimedChallenges||[]),challenge.wsKey]});
        setTimeout(()=>showCoinGain(COINS_CHALLENGE_COMPLETE,"本週挑戰達成！"),400);
      }
    }
    refreshUser();
    const finalUser = getUserById(userId);
    if(finalUser) gasSyncUser(finalUser);
  }

  function addHabit(data) {
    const u=getUserById(userId); if(!u) return;
    const newHabit={id:`h_${Date.now()}`,...data,completions:[],rewardedDays:[],createdAt:new Date().toISOString()};
    updateUser(userId,{habits:[...(u.habits||[]),newHabit]}); refreshUser();
    const updated=getUserById(userId); if(updated) gasSyncUser(updated);
  }
  function saveEditHabit(habitId,data) {
    const u=getUserById(userId); if(!u) return;
    updateUser(userId,{habits:(u.habits||[]).map(h=>h.id===habitId?{...h,...data}:h)}); refreshUser();
    const updated=getUserById(userId); if(updated) gasSyncUser(updated);
  }
  function deleteHabit(habitId) {
    const u=getUserById(userId); if(!u) return;
    updateUser(userId,{habits:(u.habits||[]).filter(h=>h.id!==habitId)}); refreshUser();
    const updated=getUserById(userId); if(updated) gasSyncUser(updated);
  }

  if(screen==="auth") return (
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, fontFamily:"Inter, sans-serif", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{FONT_IMPORT+`* { box-sizing:border-box; } html,body,#root { margin:0; width:100%; min-height:100vh; }`}</style>
      <div style={{ width:"100%", maxWidth:480, padding:"clamp(24px,8vw,60px) clamp(16px,4vw,32px) 40px" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>🌱</div>
          <h1 style={{ fontFamily:"Fraunces, serif", fontSize:32, fontWeight:700, color:t.ink, margin:"0 0 6px" }}>Daily RPG</h1>
          <p style={{ color:t.muted, fontSize:14, margin:0 }}>習慣養成冒險旅程</p>
        </div>
        <div style={{ background:t.card, borderRadius:16, padding:"24px 22px", boxShadow:"0 8px 32px rgba(0,0,0,0.08)" }}>
          <AuthScreen onLogin={handleLogin} t={t} />
        </div>
      </div>
    </div>
  );

  if(!user) return null;

  const today=new Date(); const todayKey=toKey(today);
  const habits=user.habits||[];
  const xp=computeUserXP(user); const {level,pct:levelPct}=levelInfo(xp);
  const plant=plantStage(level); const coins=user.coins||0;
  const activeTitle=ALL_TITLES.find(tt=>tt.id===(user.activeTitle||"rookie"))||ALL_TITLES[0];
  const equippedCharacter=getCharacter(user.characterId);
  const characterStatus=computeCharacterStatus(user, new Date());
  const challenge=getWeekChallenge(habits,today);
  const challengeClaimed=challenge&&(user.claimedChallenges||[]).includes(challenge.wsKey);
  const completedToday=habits.filter(h=>(h.completions||[]).includes(todayKey)).length;
  const todayPct=habits.length>0?Math.round((completedToday/habits.length)*100):0;
  const weekPct=rateForDays(habits,today,7);
  const monthPct=rateForDays(habits,today,30);

  const subScreenWrapper=(child)=>(
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, display:"flex", justifyContent:"center" }}>
      <style>{FONT_IMPORT+`* { box-sizing:border-box; } html,body,#root { margin:0; width:100%; min-height:100vh; }`}</style>
      <div style={{ width:"100%", maxWidth:720, padding:"clamp(20px,5vw,32px) clamp(16px,4vw,32px) 80px" }}>{child}</div>
    </div>
  );

  if(subScreen==="profile") return subScreenWrapper(<ProfileScreen user={user} onBack={()=>setSubScreen(null)} onSave={handleSaveProfile} t={t} />);
  if(subScreen==="friends") return subScreenWrapper(<FriendsScreen user={user} onBack={()=>{setSubScreen(null);refreshUser();}} t={t} />);
  if(subScreen==="titles") return subScreenWrapper(<TitlesScreen user={user} onBack={()=>{setSubScreen(null);refreshUser();}} onUpdate={handleUpdateUser} t={t} />);
  if(subScreen==="chardex") return subScreenWrapper(<CharacterDexScreen user={user} onBack={()=>{setSubScreen(null);refreshUser();}} onUpdate={handleUpdateUser} t={t} />);
  if(subScreen==="leaderboard") return subScreenWrapper(<LeaderboardScreen user={user} onBack={()=>setSubScreen(null)} t={t} />);
  if(subScreen==="shop") return subScreenWrapper(<PetShopScreen user={user} onBack={()=>{setSubScreen(null);refreshUser();}} onUpdateUser={handleUpdateUser} t={t} />);

  const VIEWS=[["today","今天"],["week","本週"],["month","本月"],["stats","統計"]];

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, display:"flex", justifyContent:"center", fontFamily:"Inter, sans-serif" }}>
      <style>{FONT_IMPORT+`
        @keyframes fade-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes coin-pop{0%{opacity:0;transform:translateX(-50%) translateY(0);}15%{opacity:1;}80%{opacity:1;transform:translateX(-50%) translateY(-32px);}100%{opacity:0;transform:translateX(-50%) translateY(-40px);}}
        * { box-sizing:border-box; } html,body,#root { margin:0; width:100%; min-height:100vh; }
      `}</style>

      {coinToast&&(
        <div key={coinToast.id} style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", zIndex:99, background:`${COIN}ee`, color:"#fff", padding:"8px 18px", borderRadius:20, fontFamily:"Fraunces, serif", fontWeight:700, fontSize:14, whiteSpace:"nowrap", animation:"coin-pop 2.2s ease forwards", pointerEvents:"none" }}>
          🪙 +{coinToast.amount} {coinToast.reason}
        </div>
      )}

      <div style={{ width:"100%", maxWidth:960, padding:"clamp(20px,5vw,32px) clamp(16px,4vw,32px) 100px" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0, flex:1 }}>
            <button onClick={()=>setSubScreen("profile")} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}><Avatar user={user} size={42} /></button>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"Fraunces, serif", fontSize:17, fontWeight:600, color:t.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.username}</div>
              <div style={{ fontSize:11.5, color:t.muted, fontFamily:"Inter, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeTitle.emoji} {activeTitle.label} · Lv.{level}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
            <button onClick={()=>setSubScreen("titles")} style={{ display:"flex", alignItems:"center", gap:4, border:`1px solid ${COIN}55`, background:`${COIN}15`, borderRadius:10, padding:"5px 9px", cursor:"pointer" }}>
              <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13, color:COIN }}>🪙 {coins}</span>
            </button>
            <button onClick={()=>setSubScreen("chardex")} title="角色圖鑑" style={{ position:"relative", border:"none", background:t.chip, borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", padding:0 }}>
              {equippedCharacter ? <img src={equippedCharacter.img} alt={equippedCharacter.name} style={{ width:"100%", height:"100%", objectFit:"cover", filter:characterStatus.status==="sick"?"saturate(0.4) brightness(0.85)":"none" }} /> : <span style={{ fontSize:16 }}>🪪</span>}
              {equippedCharacter && characterStatus.status==="sick" && (<span style={{ position:"absolute", bottom:-2, right:-2, fontSize:12 }}>🤒</span>)}
            </button>
            <button onClick={()=>setShowMoreMenu(v=>!v)} style={{ border:"none", background:t.chip, borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, color:t.ink }}>⋯</button>
          </div>
          {showMoreMenu&&(
            <>
              <div onClick={()=>setShowMoreMenu(false)} style={{ position:"fixed", inset:0, zIndex:60 }} />
              <div style={{ position:"absolute", top:42, right:0, zIndex:61, background:t.card, border:`1px solid ${t.border}`, borderRadius:14, boxShadow:"0 10px 30px rgba(0,0,0,0.15)", padding:6, minWidth:160, display:"flex", flexDirection:"column", gap:2 }}>
                {[
                  ["🏆","排行榜","leaderboard"],
                  ["🎰","扭蛋商店","shop"],
                  ["👥","好友","friends"],
                ].map(([icon,label,key])=>(
                  <button key={key} onClick={()=>{setSubScreen(key);setShowMoreMenu(false);}} style={{ display:"flex", alignItems:"center", gap:10, border:"none", background:"none", borderRadius:10, padding:"9px 10px", cursor:"pointer", fontSize:13.5, color:t.ink, fontFamily:"Inter, sans-serif", fontWeight:600, textAlign:"left" }}>
                    <span style={{ fontSize:16 }}>{icon}</span>{label}
                  </button>
                ))}
                <button onClick={()=>{setDarkMode(v=>!v);setShowMoreMenu(false);}} style={{ display:"flex", alignItems:"center", gap:10, border:"none", background:"none", borderRadius:10, padding:"9px 10px", cursor:"pointer", fontSize:13.5, color:t.ink, fontFamily:"Inter, sans-serif", fontWeight:600, textAlign:"left" }}>
                  <span style={{ fontSize:16 }}>{darkMode?"☀️":"🌙"}</span>{darkMode?"淺色模式":"深色模式"}
                </button>
                <div style={{ height:1, background:t.border, margin:"4px 6px" }} />
                <button onClick={()=>{setShowMoreMenu(false);handleLogout();}} style={{ display:"flex", alignItems:"center", gap:10, border:"none", background:"none", borderRadius:10, padding:"9px 10px", cursor:"pointer", fontSize:13.5, color:CLAY_DEEP, fontFamily:"Inter, sans-serif", fontWeight:600, textAlign:"left" }}>
                  <span style={{ fontSize:16 }}>🚪</span>登出
                </button>
              </div>
            </>
          )}
        </div>

        {/* XP bar + 植物成長 */}
        <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:14, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:30, flexShrink:0, lineHeight:1 }}>{plant.emoji}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600 }}>經驗值 · {plant.label}</span>
              <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:12, color:t.ink }}>{xp} / {(level+1)*LEVEL_STEP}</span>
            </div>
            <ProgressBar value={levelPct} color={CLAY} t={t} height={6} />
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display:"flex", background:t.chip, borderRadius:12, padding:3, marginBottom:14 }}>
          {VIEWS.map(([k,l]) => (
            <button key={k} onClick={()=>setView(k)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:view===k?t.card:"transparent", color:view===k?t.ink:t.muted, fontWeight:700, fontSize:12.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>{l}</button>
          ))}
        </div>

        {/* Content */}
        {view==="today"&&(<div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <TodayProgressBanner habits={habits} todayKey={todayKey} t={t} />
          {challenge&&(<div style={{ background:t.card, border:`1.5px solid ${challengeClaimed?`${SAGE}55`:GOLD}55`, borderRadius:18, padding:"14px 16px" }}>
            <div style={{ fontFamily:"Fraunces, serif", fontSize:15, fontWeight:700, color:t.ink, marginBottom:8 }}>本週挑戰</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ fontSize:24 }}>{challenge.habit.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:14, color:t.ink }}>{challenge.habit.name}</div>
                <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif" }}>完成 {challenge.countDone} / 7 天</div>
              </div>
            </div>
            <ProgressBar value={(challenge.countDone/7)*100} color={challengeClaimed?SAGE:GOLD} t={t} height={6} />
            {challenge.complete&&!challengeClaimed&&(<div style={{ marginTop:10, padding:"8px 12px", borderRadius:10, background:`${GOLD}22`, color:GOLD, fontSize:12, fontFamily:"Inter, sans-serif", fontWeight:700, textAlign:"center" }}>🎉 本週挑戰達成！已獲得 {COINS_CHALLENGE_COMPLETE} 金幣</div>)}
            {challengeClaimed&&(<div style={{ marginTop:10, padding:"8px 12px", borderRadius:10, background:`${SAGE}22`, color:SAGE, fontSize:12, fontFamily:"Inter, sans-serif", fontWeight:700, textAlign:"center" }}>✅ 已領取獎勵</div>)}
          </div>)}
          {habits.length===0?(<div style={{ textAlign:"center", padding:"40px 20px", color:t.muted, fontSize:14, fontFamily:"Inter, sans-serif" }}>還沒有習慣，點下方「+ 新增習慣」開始吧！</div>):(<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {habits.map(h=>{
              const done=(h.completions||[]).includes(todayKey);
              const cat=CATEGORIES.find(c=>c.key===h.category)||CATEGORIES[0];
              return (
                <div key={h.id} style={{ background:t.card, border:`1.5px solid ${done?cat.color:t.border}`, borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, opacity:done?0.7:1 }}>
                  <div onClick={()=>toggleHabit(h.id)} style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0, cursor:"pointer" }}>
                    <div style={{ fontSize:24, flexShrink:0 }}>{h.emoji}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:14, color:t.ink, textDecoration:done?"line-through":"none" }}>{h.name}</div>
                      <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif" }}>{cat.emoji} {cat.label}</div>
                    </div>
                    <div style={{ fontSize:20, flexShrink:0 }}>{done?"✅":"⭕"}</div>
                  </div>
                  <button onClick={()=>setEditingHabit(h)} title="編輯習慣" style={{ border:"none", background:"none", cursor:"pointer", fontSize:15, padding:"4px 2px", flexShrink:0, opacity:0.6 }}>✏️</button>
                  <button onClick={()=>{ if(window.confirm(`確定要刪除「${h.name}」嗎？這會一併刪除這個習慣的所有紀錄。`)) deleteHabit(h.id); }} title="刪除習慣" style={{ border:"none", background:"none", cursor:"pointer", fontSize:15, padding:"4px 2px", flexShrink:0, opacity:0.6 }}>🗑️</button>
                </div>
              );
            })}
          </div>)}
        </div>)}

        {view==="week"&&(<div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"16px" }}>
            <div style={{ fontFamily:"Fraunces, serif", fontSize:15, fontWeight:700, color:t.ink, marginBottom:12 }}>本週完成率</div>
            <div style={{ display:"flex", gap:8, alignItems:"flex-end", justifyContent:"space-around", height:120 }}>
              {Array(7).fill(null).map((_,i)=>{
                const d=addDays(today,-6+i);
                const key=toKey(d);
                const done=habits.filter(h=>(h.completions||[]).includes(key)).length;
                const pct=habits.length>0?(done/habits.length)*100:0;
                const isToday=toKey(d)===todayKey;
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ width:"100%", height:`${Math.max(10,pct*0.8)}px`, borderRadius:6, background:pct>50?SAGE:pct>25?AMETHYST:CLAY, border:isToday?`2px solid ${t.ink}`:"none" }} />
                    <div style={{ fontSize:10, color:t.muted, fontFamily:"Inter, sans-serif", fontWeight:600 }}>{["日","一","二","三","四","五","六"][d.getDay()]}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"16px" }}>
            <div style={{ fontFamily:"Fraunces, serif", fontSize:15, fontWeight:700, color:t.ink, marginBottom:12 }}>本週習慣</div>
            {habits.length===0?(<div style={{ color:t.muted, fontSize:13, fontFamily:"Inter, sans-serif" }}>還沒有習慣</div>):(<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {habits.map(h=>{
                const streak=computeStreak(h.completions||[],today);
                const weekDone=Array.from({length:7}).filter((_,i)=>(h.completions||[]).includes(toKey(addDays(today,-i)))).length;
                return (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:20 }}>{h.emoji}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13, color:t.ink }}>{h.name}</div>
                      <div style={{ fontSize:11, color:t.muted, fontFamily:"Inter, sans-serif" }}>🔥 {streak} 天連續 · 本週 {weekDone}/7</div>
                    </div>
                  </div>
                );
              })}
            </div>)}
          </div>
        </div>)}

        {view==="month"&&(<MonthHeatmap habits={habits} t={t} />)}

        {view==="stats"&&(<div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:10 }}>
            <StatCard label="今天" value={`${todayPct}%`} color={CLAY} t={t} />
            <StatCard label="本週" value={`${weekPct}%`} color={AMETHYST} t={t} />
            <StatCard label="本月" value={`${monthPct}%`} color={SAGE} t={t} />
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"16px" }}>
            <div style={{ fontFamily:"Fraunces, serif", fontSize:14, fontWeight:600, color:t.ink, marginBottom:14 }}>分類概覽（近30天）</div>
            {CATEGORIES.map(c=>{
              const catHabits=habits.filter(h=>h.category===c.key);
              if(catHabits.length===0) return null;
              const rate=rateForDays(catHabits,today,30);
              return (
                <div key={c.key} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:12.5, color:t.muted, fontFamily:"Inter, sans-serif" }}>{c.emoji} {c.label} <span style={{ opacity:0.6 }}>({catHabits.length}個)</span></span>
                    <span style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13.5, color:c.color }}>{rate}%</span>
                  </div>
                  <ProgressBar value={rate} color={c.color} t={t} height={6} />
                </div>
              );
            })}
          </div>
        </div>)}

        {/* FAB */}
        <button onClick={()=>setShowAddHabit(true)} style={{ position:"fixed", bottom:30, right:30, display:"flex", alignItems:"center", gap:7, padding:"14px 20px", borderRadius:30, border:"none", background:`linear-gradient(135deg, ${CLAY}, ${CLAY_DEEP})`, color:"#fff", fontSize:14, fontWeight:700, fontFamily:"Inter, sans-serif", cursor:"pointer", boxShadow:"0 8px 24px rgba(0,0,0,0.18)", zIndex:50, whiteSpace:"nowrap" }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span> 新增習慣
        </button>

        {/* Modals */}
        {showAddHabit&&(<HabitFormSheet onClose={()=>setShowAddHabit(false)} onSave={data=>{addHabit(data);setShowAddHabit(false);}} t={t} />)}
        {editingHabit&&(<HabitFormSheet initial={editingHabit} onClose={()=>setEditingHabit(null)} onSave={data=>{saveEditHabit(editingHabit.id,data);setEditingHabit(null);}} t={t} />)}
      </div>
    </div>
  );
}
