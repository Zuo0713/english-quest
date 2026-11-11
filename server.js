/* ============================================================
   English Quest 多益冒險島 — 後端伺服器（零相依，Node.js ≥ 18）
   ------------------------------------------------------------
   功能：
   1. 註冊 / 登入 / 登出（密碼以 scrypt 雜湊 + 隨機 salt 儲存，
      資料庫內絕不保存明碼密碼，也不會外流）
   2. 遊戲進度雲端同步（換裝置登入即可繼續）
   3. 靜態檔案伺服（index.html / manifest / 圖示 / sw.js）
   安全：
   - scrypt (N=16384,r=8,p=1) + 每帳號獨立 16 bytes salt
   - timingSafeEqual 防時序攻擊
   - 登入/註冊頻率限制（每 IP 10 分鐘 15 次）
   - API 一律 no-store、防跨站 frame、禁止路徑穿越
   啟動：node server.js   （或 npm start）
   ============================================================ */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_BODY = 512 * 1024;      // 請求體上限 512KB
const MAX_STATE = 400 * 1024;     // 遊戲存檔上限 400KB
const SESSION_DAYS = 30;          // 記住登入 30 天

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markpoint; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};
MIME[".md"] = "text/markdown; charset=utf-8";

/* ---------------- 資料儲存（JSON 檔，原子寫入） ---------------- */
let db = { users: {}, states: {}, sessions: {}, uidx: {}, social: {} };
let dirty = false;
let saveTimer = null;

const UID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 去掉容易看錯的 I/L/O/0/1
function newUid() {
  let s = "";
  const b = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += UID_CHARS[b[i] % UID_CHARS.length];
  return s;
}
/* 為每個帳號補上 UID（舊帳號升級用）並建立 UID 索引 */
function ensureUids() {
  db.uidx = db.uidx || {};
  db.social = db.social || {};
  let changed = false;
  Object.keys(db.users).forEach(function (name) {
    const rec = db.users[name];
    if (!rec.uid || db.uidx[rec.uid] !== name) {
      let u = newUid();
      while (db.uidx[u] && db.uidx[u] !== name) u = newUid();
      rec.uid = u;
      db.uidx[u] = name;
      changed = true;
    }
    if (!db.social[name] || !Array.isArray(db.social[name].friends)) {
      db.social[name] = { friends: [] };
      changed = true;
    }
  });
  Object.keys(db.uidx).forEach(function (u) {
    if (!db.users[db.uidx[u]]) { delete db.uidx[u]; changed = true; }
  });
  if (changed) saveDB();
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      db = Object.assign({ users: {}, states: {}, sessions: {}, uidx: {}, social: {} }, raw);
      ensureUids();
      console.log("[DB] 已載入 " + Object.keys(db.users).length + " 個帳號");
    }
  } catch (e) {
    console.error("[DB] 載入失敗，將使用空白資料：" + e.message);
    db = { users: {}, states: {}, sessions: {}, uidx: {}, social: {} };
  }
}
function flushDB() {
  saveTimer = null;
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE); // 原子取代，避免寫到一半損毀
  } catch (e) {
    console.error("[DB] 寫入失敗：" + e.message);
  }
}
function saveDB() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(flushDB, 300);
}
process.on("exit", flushDB);
process.on("SIGINT", function () { flushDB(); process.exit(0); });
process.on("SIGTERM", function () { flushDB(); process.exit(0); });

/* ---------------- 密碼與 session ---------------- */
function hashPw(pw, salt) {
  // scrypt：慢雜湊，暴力破解成本極高
  return crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
}
function makeUser(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt: salt, hash: hashPw(pw, salt), created: Date.now() };
}
function checkPw(name, pw) {
  const rec = db.users[name];
  if (!rec) return false;
  let a, b;
  try {
    a = Buffer.from(hashPw(pw, rec.salt), "hex");
    b = Buffer.from(rec.hash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b); // 防時序攻擊
  } catch (e) { return false; }
}
function newToken() { return crypto.randomBytes(32).toString("hex"); }
function sessionUser(token) {
  if (!token || typeof token !== "string") return null;
  const s = db.sessions[token];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[token]; saveDB(); return null; }
  s.exp = Date.now() + SESSION_DAYS * 864e5; // 滑動延長
  return s.user;
}

/* ---------------- 頻率限制（每 IP） ---------------- */
const rl = {};
function rateLimited(ip) {
  const now = Date.now();
  const arr = (rl[ip] || []).filter(function (t) { return now - t < 10 * 60 * 1000; });
  arr.push(now);
  rl[ip] = arr;
  return arr.length > 15;
}

/* ---------------- HTTP 工具 ---------------- */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer"
  });
  res.end(body);
}
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on("data", function (c) {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (e) { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}
function clientIP(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket.remoteAddress || "?";
}
const NAME_RE = /^[A-Za-z0-9_一-鿿]+$/;

/* ---------------- 好友系統（UID） ---------------- */
function publicProfile(name) {
  const s = (db.states && db.states[name]) || {};
  const rec = (db.users && db.users[name]) || {};
  if (!rec || !rec.uid) return null;
  const lg = Array.isArray(s.logins) && s.logins.length ? s.logins[s.logins.length - 1] : "";
  return {
    uid: rec.uid, name: name,
    xp: s.xp || 0, streak: s.streak || 0, lastClaim: s.lastClaim || "",
    lastLogin: lg || s.lastClaim || "",
    correct: s.correct || 0, total: s.total || 0, words: s.words || 0,
    wins: s.wins || 0, battles: s.battles || 0, created: rec.created || 0
  };
}
function findUserByUid(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,8}$/.test(c)) return null;
  const name = db.uidx && db.uidx[c];
  return name && db.users[name] ? name : null;
}

/* ---------------- API ---------------- */
async function handleAPI(req, res, pathname) {
  const ip = clientIP(req);

  if (pathname === "/api/register" && req.method === "POST") {
    if (rateLimited(ip)) return json(res, 429, { err: "嘗試次數太多，請 10 分鐘後再試" });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: "請求格式錯誤" }); }
    const u = String(b.user || "").trim();
    const p = String(b.pass || "");
    if (u.length < 3 || u.length > 16) return json(res, 400, { err: "使用者名稱需 3-16 個字元" });
    if (!NAME_RE.test(u)) return json(res, 400, { err: "只能使用中英文、數字或底線" });
    if (p.length < 4) return json(res, 400, { err: "密碼至少 4 碼" });
    if (db.users[u]) return json(res, 409, { err: "這個使用者名稱已被註冊" });
    const rec = makeUser(p);
    let uid = newUid();
    while (db.uidx[uid]) uid = newUid();
    rec.uid = uid;
    db.uidx[uid] = u;
    db.social[u] = { friends: [] };
    db.users[u] = rec;
    const token = newToken();
    db.sessions[token] = { user: u, exp: Date.now() + SESSION_DAYS * 864e5 };
    saveDB();
    console.log("[AUTH] 註冊：" + u + "（UID " + uid + "，來自 " + ip + "）");
    return json(res, 201, { token: token, user: u, uid: uid, state: db.states[u] || null });
  }

  if (pathname === "/api/login" && req.method === "POST") {
    if (rateLimited(ip)) return json(res, 429, { err: "嘗試次數太多，請 10 分鐘後再試" });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: "請求格式錯誤" }); }
    const u = String(b.user || "").trim();
    const p = String(b.pass || "");
    if (!db.users[u]) return json(res, 404, { err: "找不到這個使用者名稱" });
    if (!checkPw(u, p)) return json(res, 401, { err: "密碼錯誤" });
    const token = newToken();
    db.sessions[token] = { user: u, exp: Date.now() + SESSION_DAYS * 864e5 };
    saveDB();
    console.log("[AUTH] 登入：" + u + "（來自 " + ip + "）");
    return json(res, 200, { token: token, user: u, state: db.states[u] || null });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: "bad" }); }
    if (b.token && db.sessions[b.token]) { delete db.sessions[b.token]; saveDB(); }
    return json(res, 200, { ok: true });
  }

  // 以下需登入
  const token = (req.headers["x-token"] || "") || new URL(req.url, "http://x").searchParams.get("token") || "";
  const user = sessionUser(token);
  if (!user) return json(res, 401, { err: "登入已過期，請重新登入" });

  if (pathname === "/api/me" && req.method === "GET") {
    return json(res, 200, { user: user, uid: (db.users[user] && db.users[user].uid) || "" });
  }
  /* ---- 好友 ---- */
  if (pathname === "/api/social" && req.method === "GET") {
    if (!db.social[user]) db.social[user] = { friends: [] };
    const myUid = (db.users[user] && db.users[user].uid) || "";
    const friends = db.social[user].friends.map(publicProfile).filter(Boolean);
    return json(res, 200, { uid: myUid, friends: friends });
  }
  if (pathname === "/api/social/add" && req.method === "POST") {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: "請求格式錯誤" }); }
    const target = findUserByUid(b.code);
    if (!target) return json(res, 404, { err: "找不到這個 UID（請確認 6 碼代號）" });
    if (target === user) return json(res, 400, { err: "不能把自己加為好友" });
    if (!db.social[user]) db.social[user] = { friends: [] };
    const list = db.social[user].friends;
    if (list.indexOf(target) >= 0) return json(res, 409, { err: "這位已經是好友了" });
    if (list.length >= 100) return json(res, 400, { err: "好友上限 100 位" });
    list.push(target);
    saveDB();
    console.log("[SOCIAL] " + user + " 加好友 " + target);
    return json(res, 200, { ok: true, friend: publicProfile(target) });
  }
  if (pathname === "/api/social/remove" && req.method === "POST") {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: "請求格式錯誤" }); }
    const target = findUserByUid(b.code);
    const list = (db.social[user] && db.social[user].friends) || [];
    const i = target ? list.indexOf(target) : -1;
    if (i < 0) return json(res, 404, { err: "這位不是你的好友" });
    list.splice(i, 1);
    saveDB();
    return json(res, 200, { ok: true });
  }
  if (pathname === "/api/state" && req.method === "GET") {
    return json(res, 200, { state: db.states[user] || null });
  }
  if (pathname === "/api/state" && req.method === "POST") {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: "請求格式錯誤" }); }
    const s = b.state;
    if (!s || typeof s !== "object") return json(res, 400, { err: "缺少存檔" });
    const raw = JSON.stringify(s);
    if (raw.length > MAX_STATE) return json(res, 413, { err: "存檔過大" });
    db.states[user] = s;
    saveDB();
    return json(res, 200, { ok: true, len: raw.length });
  }

  return json(res, 404, { err: "not found" });
}

/* ---------------- 靜態檔案（防路徑穿越） ---------------- */
function serveStatic(req, res, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { p = pathname; }
  if (p === "/" || p === "") p = "/index.html";
  const fp = path.normalize(path.join(ROOT, p));
  if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) {
    return json(res, 403, { err: "forbidden" });
  }
  fs.stat(fp, function (err, st) {
    if (err || !st.isFile()) {
      // SPA 之外的一律 404
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      return res.end("404 Not Found");
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer"
    });
    fs.createReadStream(fp).pipe(res);
  });
}

/* ---------------- 主伺服器 ---------------- */
loadDB();
const server = http.createServer(async function (req, res) {
  let pathname;
  try { pathname = new URL(req.url, "http://localhost").pathname; }
  catch (e) { pathname = "/"; }

  if (pathname.indexOf("/api/") === 0) {
    try { await handleAPI(req, res, pathname); }
    catch (e) { json(res, 500, { err: "伺服器錯誤" }); }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return json(res, 405, { err: "method not allowed" });
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("==========================================");
  console.log("  English Quest 伺服器已啟動");
  console.log("  本機：  http://localhost:" + PORT);
  console.log("  資料庫：" + DB_FILE);
  console.log("  按 Ctrl+C 結束");
  console.log("==========================================");
});
