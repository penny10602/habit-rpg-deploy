/**
 * ═══════════════════════════════════════════════════
 *  Daily RPG — Google Apps Script 後端
 *  貼到 Google Apps Script 編輯器並部署為「網路應用程式」
 * ═══════════════════════════════════════════════════
 *
 *  Sheet 欄位（第一列 header）：
 *  id | username | email | passwordHash | avatarPreset | avatarUrl |
 *  bio | activeTitle | level | coins | habits | friendIds |
 *  unlockedTitles | claimedChallenges | createdAt | updatedAt | pendingFriendRequests
 *
 *  帳號規則：
 *  - email 與 username 都必須唯一（不分大小寫），由後端統一檢查
 *  - 註冊 / 登入皆由後端驗證密碼，前端不再用 localStorage 當作帳號來源
 */

const SHEET_NAME = "users";

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = setupSheet();
  return sheet;
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.insertSheet(SHEET_NAME);
  const headers = [
    "id", "username", "email", "passwordHash",
    "avatarPreset", "avatarUrl", "bio", "activeTitle",
    "level", "coins", "habits", "friendIds",
    "unlockedTitles", "claimedChallenges", "pendingFriendRequests",
    "characterId", "unlockedCharacters",
    "createdAt", "updatedAt"
  ];
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function objToRow(headers, obj) {
  return headers.map(h => obj[h] !== undefined ? obj[h] : "");
}

function norm(s) { return (s || "").toString().trim().toLowerCase(); }

function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function findRowIndex(data, headers, col, value) {
  const idx = headers.indexOf(col);
  if (idx === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (norm(data[i][idx]) === norm(value)) return i; // 0-based data index
  }
  return -1;
}

function publicUser(obj) {
  let habits = [];
  try { habits = JSON.parse(obj.habits || "[]"); } catch (e) {}
  let friendIds = [];
  try { friendIds = JSON.parse(obj.friendIds || "[]"); } catch (e) {}
  let unlockedTitles = ["rookie"];
  try { unlockedTitles = JSON.parse(obj.unlockedTitles || "[\"rookie\"]"); } catch (e) {}
    let claimedChallenges = [];
    try { claimedChallenges = JSON.parse(obj.claimedChallenges || "[]"); } catch (e) {}
    let pendingFriendRequests = [];
    try { pendingFriendRequests = JSON.parse(obj.pendingFriendRequests || "[]"); } catch (e) {}
    let unlockedCharacters = [];
    try { unlockedCharacters = JSON.parse(obj.unlockedCharacters || "[]"); } catch (e) {}

  return {
    id: obj.id,
    username: obj.username,
    email: obj.email,
    avatarPreset: obj.avatarPreset || "adventurer",
    avatarUrl: obj.avatarUrl || null,
    bio: obj.bio || "",
    activeTitle: obj.activeTitle || "rookie",
    level: parseInt(obj.level, 10) || 1,
    coins: parseInt(obj.coins, 10) || 0,
    habits: habits,
    friendIds: friendIds,
    unlockedTitles: unlockedTitles,
    claimedChallenges: claimedChallenges,
    pendingFriendRequests: pendingFriendRequests,
    characterId: obj.characterId || "",
    unlockedCharacters: unlockedCharacters,
    createdAt: obj.createdAt || "",
  };
}

// ── GET：搜尋使用者（僅供已知 email 的跨裝置資料拉取，不含密碼） ──
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "search") {
      const email = e.parameter.email || "";
      if (!email) return json({ found: false, error: "no email" });

      const sheet = getSheet();
      const headers = getHeaders(sheet);
      const data = sheet.getDataRange().getValues();
      const row = findRowIndex(data, headers, "email", email);
      if (row === -1) return json({ found: false });

      return json({ found: true, user: publicUser(rowToObj(headers, data[row])) });
    }

    if (action === "searchById") {
      const id = e.parameter.id || "";
      if (!id) return json({ found: false, error: "no id" });

      const sheet = getSheet();
      const headers = getHeaders(sheet);
      const data = sheet.getDataRange().getValues();
      const row = findRowIndex(data, headers, "id", id);
      if (row === -1) return json({ found: false });

      return json({ found: true, user: publicUser(rowToObj(headers, data[row])) });
    }

    return json({ error: "unknown action" });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── POST：註冊 / 登入 / 重設密碼 / 同步 ──────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();
    const headers = getHeaders(sheet);

    // ── 註冊 ──
    if (body.action === "register") {
      const username = (body.username || "").trim();
      const email = (body.email || "").trim();
      const password = body.password || "";

      if (!username || !email || !password) {
        return json({ ok: false, error: "請填寫所有欄位" });
      }
      if (password.length < 6) {
        return json({ ok: false, error: "密碼至少 6 個字元" });
      }

      const data = sheet.getDataRange().getValues();
      const emailTaken = findRowIndex(data, headers, "email", email) !== -1;
      const usernameTaken = findRowIndex(data, headers, "username", username) !== -1;

      if (emailTaken || usernameTaken) {
        // email 或 username 已存在 → 禁止建立新帳號
        return json({ ok: false, error: "此帳號已被註冊" });
      }

      const now = new Date().toISOString();
      const newUser = {
        id: "user_" + Utilities.getUuid().replace(/-/g, "").slice(0, 16),
        username: username,
        email: email,
        passwordHash: hashPassword(password),
        avatarPreset: "adventurer",
        avatarUrl: "",
        bio: "",
        activeTitle: "rookie",
        level: 1,
        coins: 0,
        habits: "[]",
        friendIds: "[]",
        unlockedTitles: JSON.stringify(["rookie"]),
        claimedChallenges: "[]",
        pendingFriendRequests: "[]",
        characterId: "",
        unlockedCharacters: "[]",
        createdAt: now,
        updatedAt: now,
      };

      sheet.appendRow(objToRow(headers, newUser));
      return json({ ok: true, user: publicUser(newUser) });
    }

    // ── 登入 ──
    if (body.action === "login") {
      const email = (body.email || "").trim();
      const password = body.password || "";
      if (!email || !password) return json({ ok: false, error: "請輸入 Email 與密碼" });

      const data = sheet.getDataRange().getValues();
      const row = findRowIndex(data, headers, "email", email);
      if (row === -1) return json({ ok: false, error: "Email 或密碼錯誤" });

      const obj = rowToObj(headers, data[row]);
      if (obj.passwordHash !== hashPassword(password)) {
        return json({ ok: false, error: "Email 或密碼錯誤" });
      }

      return json({ ok: true, user: publicUser(obj) });
    }

    // ── 忘記密碼：產生暫時密碼（示範用，正式環境請改為寄送重設信） ──
    if (body.action === "resetPassword") {
      const email = (body.email || "").trim();
      if (!email) return json({ ok: false, error: "請輸入 Email" });

      const data = sheet.getDataRange().getValues();
      const row = findRowIndex(data, headers, "email", email);
      if (row === -1) return json({ ok: false, error: "找不到此 Email 對應的帳號" });

      const tempPassword = Utilities.getUuid().slice(0, 8);
      const pwCol = headers.indexOf("passwordHash");
      sheet.getRange(row + 1, pwCol + 1).setValue(hashPassword(tempPassword));
      return json({ ok: true, tempPassword: tempPassword });
    }

    // ── 同步使用者資料（習慣 / 等級 / 金幣等，需已登入，不會更動密碼） ──
    if (body.action === "upsert") {
      const u = body.user;
      if (!u || !u.id || !u.email) return json({ ok: false, error: "missing fields" });

      const data = sheet.getDataRange().getValues();
      
      // 優先使用 email 進行比對，確保跨裝置登入時能正確鎖定同一行
      let existingRow = findRowIndex(data, headers, "email", u.email);
      
      // 如果 email 找不到，才退而求其次用 id 找（防呆機制）
      if (existingRow === -1) {
        const idCol = headers.indexOf("id");
        for (let i = 1; i < data.length; i++) {
          if (data[i][idCol] === u.id) { existingRow = i; break; }
        }
      }
      
      if (existingRow === -1) return json({ ok: false, error: "user not found" });

      const existing = rowToObj(headers, data[existingRow]);
      const usernameCol = headers.indexOf("username");

      // 若改了 username，需確認新名稱沒有被別人使用
      if (u.username && norm(u.username) !== norm(existing.username)) {
        const taken = data.some((r, i) => i !== existingRow && i > 0 && norm(r[usernameCol]) === norm(u.username));
        if (taken) return json({ ok: false, error: "此使用者名稱已被使用" });
      }

      const merged = Object.assign({}, existing, {
        username: u.username || existing.username,
        avatarPreset: u.avatarPreset || existing.avatarPreset,
        avatarUrl: u.avatarUrl != null ? u.avatarUrl : existing.avatarUrl,
        bio: u.bio != null ? u.bio : existing.bio,
        activeTitle: u.activeTitle || existing.activeTitle,
        level: u.level || existing.level,
        coins: u.coins != null ? u.coins : existing.coins,
        habits: typeof u.habits === "string" ? u.habits : JSON.stringify(u.habits || []),
        friendIds: typeof u.friendIds === "string" ? u.friendIds : JSON.stringify(u.friendIds || []),
        unlockedTitles: typeof u.unlockedTitles === "string" ? u.unlockedTitles : JSON.stringify(u.unlockedTitles || ["rookie"]),
        claimedChallenges: typeof u.claimedChallenges === "string" ? u.claimedChallenges : JSON.stringify(u.claimedChallenges || []),
        pendingFriendRequests: typeof u.pendingFriendRequests === "string" ? u.pendingFriendRequests : JSON.stringify(u.pendingFriendRequests || []),
        characterId: u.characterId != null ? u.characterId : existing.characterId,
        unlockedCharacters: typeof u.unlockedCharacters === "string" ? u.unlockedCharacters : JSON.stringify(u.unlockedCharacters || []),
        updatedAt: new Date().toISOString(),
        // passwordHash 永遠保留原值，upsert 不會更動密碼
      });

      sheet.getRange(existingRow + 1, 1, 1, headers.length).setValues([objToRow(headers, merged)]);
      return json({ ok: true });
    }

    // ── 發送好友邀請 ──
    if (body.action === "sendFriendRequest") {
      const senderId = body.senderId;
      const receiverIdentifier = (body.receiverEmailOrUsername || "").trim();

      if (!senderId || !receiverIdentifier) {
        return json({ ok: false, error: "缺少發送者 ID 或接收者資訊" });
      }

      const data = sheet.getDataRange().getValues();
      const headers = getHeaders(sheet);

      const senderRow = findRowIndex(data, headers, "id", senderId);
      if (senderRow === -1) return json({ ok: false, error: "發送者不存在" });
      const sender = rowToObj(headers, data[senderRow]);

      let receiverRow = findRowIndex(data, headers, "email", receiverIdentifier);
      if (receiverRow === -1) {
        receiverRow = findRowIndex(data, headers, "username", receiverIdentifier);
      }
      if (receiverRow === -1) return json({ ok: false, error: "找不到該使用者" });
      const receiver = rowToObj(headers, data[receiverRow]);

      if (sender.id === receiver.id) {
        return json({ ok: false, error: "不能向自己發送好友邀請" });
      }

      let senderFriendIds = JSON.parse(sender.friendIds || "[]");
      let receiverFriendIds = JSON.parse(receiver.friendIds || "[]");
      let receiverPendingRequests = JSON.parse(receiver.pendingFriendRequests || "[]");

      if (senderFriendIds.includes(receiver.id)) {
        return json({ ok: false, error: "你們已經是好友了" });
      }
      if (receiverPendingRequests.includes(sender.id)) {
        return json({ ok: false, error: "對方已有您的好友邀請待處理" });
      }

      // Add senderId to receiver's pendingFriendRequests
      receiverPendingRequests.push(sender.id);
      const mergedReceiver = Object.assign({}, receiver, {
        pendingFriendRequests: JSON.stringify(receiverPendingRequests),
        updatedAt: new Date().toISOString(),
      });
      sheet.getRange(receiverRow + 1, 1, 1, headers.length).setValues([objToRow(headers, mergedReceiver)]);

      return json({ ok: true, message: "好友邀請已發送" });
    }

    // ── 接受好友邀請 ──
    if (body.action === "acceptFriendRequest") {
      const userId = body.userId;
      const senderId = body.senderId;

      if (!userId || !senderId) {
        return json({ ok: false, error: "缺少使用者 ID 或發送者 ID" });
      }

      const data = sheet.getDataRange().getValues();
      const headers = getHeaders(sheet);

      const userRow = findRowIndex(data, headers, "id", userId);
      const senderRow = findRowIndex(data, headers, "id", senderId);

      if (userRow === -1 || senderRow === -1) {
        return json({ ok: false, error: "使用者或發送者不存在" });
      }

      const user = rowToObj(headers, data[userRow]);
      const sender = rowToObj(headers, data[senderRow]);

      let userFriendIds = JSON.parse(user.friendIds || "[]");
      let senderFriendIds = JSON.parse(sender.friendIds || "[]");
      let userPendingRequests = JSON.parse(user.pendingFriendRequests || "[]");

      if (!userPendingRequests.includes(senderId)) {
        return json({ ok: false, error: "沒有此好友邀請" });
      }

      // Add each other to friendIds
      if (!userFriendIds.includes(senderId)) userFriendIds.push(senderId);
      if (!senderFriendIds.includes(userId)) senderFriendIds.push(userId);

      // Remove from pending requests
      userPendingRequests = userPendingRequests.filter(id => id !== senderId);

      const mergedUser = Object.assign({}, user, {
        friendIds: JSON.stringify(userFriendIds),
        pendingFriendRequests: JSON.stringify(userPendingRequests),
        updatedAt: new Date().toISOString(),
      });
      const mergedSender = Object.assign({}, sender, {
        friendIds: JSON.stringify(senderFriendIds),
        updatedAt: new Date().toISOString(),
      });

      sheet.getRange(userRow + 1, 1, 1, headers.length).setValues([objToRow(headers, mergedUser)]);
      sheet.getRange(senderRow + 1, 1, 1, headers.length).setValues([objToRow(headers, mergedSender)]);

      return json({ ok: true, message: "好友邀請已接受" });
    }

    // ── 拒絕好友邀請 ──
    if (body.action === "rejectFriendRequest") {
      const userId = body.userId;
      const senderId = body.senderId;

      if (!userId || !senderId) {
        return json({ ok: false, error: "缺少使用者 ID 或發送者 ID" });
      }

      const data = sheet.getDataRange().getValues();
      const headers = getHeaders(sheet);

      const userRow = findRowIndex(data, headers, "id", userId);
      if (userRow === -1) {
        return json({ ok: false, error: "使用者不存在" });
      }

      const user = rowToObj(headers, data[userRow]);
      let userPendingRequests = JSON.parse(user.pendingFriendRequests || "[]");

      if (!userPendingRequests.includes(senderId)) {
        return json({ ok: false, error: "沒有此好友邀請" });
      }

      // Remove from pending requests
      userPendingRequests = userPendingRequests.filter(id => id !== senderId);

      const mergedUser = Object.assign({}, user, {
        pendingFriendRequests: JSON.stringify(userPendingRequests),
        updatedAt: new Date().toISOString(),
      });
      sheet.getRange(userRow + 1, 1, 1, headers.length).setValues([objToRow(headers, mergedUser)]);

      return json({ ok: true, message: "好友邀請已拒絕" });
    }

    return json({ error: "unknown action" });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── JSON 輸出輔助函數 ──
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
