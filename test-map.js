/* test-map.js — map.js（領地地圖模組）自動化驗證
   用 Node + 最小 DOM stub 在 vm context 裡載入 content 題庫與 map.js，
   驗證：語法、地區資料格式、每區題目數>=15、解鎖門檻、regionAcc、
        難度分級、AI 正確率映射、S 新欄位防禦性初始化、煙霧測試（開拓/對戰）。
   執行：node test-map.js                                   */
const fs = require("fs"), path = require("path"), vm = require("vm"), cp = require("child_process");
const DIR = __dirname;
const MAP_FILE = path.join(DIR, "map.js");
const INDEX_FILE = path.join(DIR, "index.html");

let pass = 0, fail = 0;
const fails = [];
function sect(t) { console.log("\n== " + t + " =="); }
function ok(cond, msg) {
  if (cond) { pass++; console.log("  OK  " + msg); }
  else { fail++; fails.push(msg); console.log("  XX  " + msg); }
}
function eq(a, b, msg) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  ok(same, msg + "  (期望 " + JSON.stringify(b) + "，實際 " + JSON.stringify(a) + ")");
}
function near(a, b, msg) {
  ok(Math.abs(Number(a) - Number(b)) < 1e-9, msg + "  (期望 " + b + "，實際 " + a + ")");
}

/* ---------------- 最小 DOM stub ---------------- */
const REG = {}, ALL = [];
function El(tag) {
  this.tagName = String(tag || "div").toUpperCase();
  this.id = ""; this.className = ""; this.style = {}; this.children = [];
  this.parentNode = null; this._html = ""; this.textContent = ""; this.attrs = {};
  const self = this;
  this.classList = {
    add: function (c) { const s = self.className.split(/\s+/).filter(Boolean); if (s.indexOf(c) < 0) s.push(c); self.className = s.join(" "); },
    remove: function (c) { self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(" "); },
    toggle: function (c, f) { if (f === undefined) f = !this.contains(c); f ? this.add(c) : this.remove(c); },
    contains: function (c) { return self.className.split(/\s+/).indexOf(c) >= 0; }
  };
}
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); if (c.id) REG[c.id] = c; return c; };
El.prototype.insertBefore = function (c, ref) {
  c.parentNode = this;
  const k = ref ? this.children.indexOf(ref) : -1;
  if (k >= 0) this.children.splice(k, 0, c); else this.children.push(c);
  if (c.id) REG[c.id] = c;
  return c;
};
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; if (k === "id") { this.id = v; REG[v] = this; } };
El.prototype.querySelector = function () { return null; };
El.prototype.querySelectorAll = function () { return []; };
El.prototype.remove = function () {
  if (this.parentNode) { const k = this.parentNode.children.indexOf(this); if (k >= 0) this.parentNode.children.splice(k, 1); }
  if (this.id && REG[this.id] === this) delete REG[this.id];
};
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._html; },
  set: function (v) { this._html = String(v); }
});
Object.defineProperty(El.prototype, "nextSibling", {
  get: function () {
    if (!this.parentNode) return null;
    const k = this.parentNode.children.indexOf(this);
    return this.parentNode.children[k + 1] || null;
  }
});
const head = new El("head"), body = new El("body");
const battleScreen = new El("div"); battleScreen.id = "scr-battle"; battleScreen.className = "screen";
body.appendChild(battleScreen);
const documentStub = {
  readyState: "complete",
  head: head, body: body, documentElement: new El("html"),
  createElement: function (tag) { const e = new El(tag); ALL.push(e); return e; },
  getElementById: function (id) { return REG[id] || null; },
  getElementsByTagName: function () { return [head]; },
  querySelectorAll: function (sel) {
    if (sel === ".screen") return ALL.filter(function (e) { return /\bscreen\b/.test(e.className); }).concat(
      [battleScreen].filter(function (e) { return ALL.indexOf(e) < 0 && /\bscreen\b/.test(e.className); }));
    return [];
  },
  addEventListener: function () {}
};

const ctx = vm.createContext({
  console: console, document: documentStub, window: {},
  setTimeout: function (fn) { return 0; }, clearTimeout: function () {},
  setInterval: function () { return 0; }, clearInterval: function () {}
});
function run(code) { return vm.runInContext(code, ctx, { filename: "inline" }); }
function load(file) { vm.runInContext(fs.readFileSync(path.join(DIR, file), "utf8"), ctx, { filename: file }); }

/* ---------------- 1. 語法檢查 ---------------- */
sect("1. 檔案語法");
const mapSrc = fs.readFileSync(MAP_FILE, "utf8");
try { new vm.Script(mapSrc, { filename: "map.js" }); ok(true, "vm.Script 解析成功"); }
catch (e) { ok(false, "vm.Script 解析失敗：" + e.message); }
try {
  cp.execSync('node --check "' + MAP_FILE + '"', { stdio: "pipe" });
  ok(true, "node --check map.js 通過");
} catch (e) { ok(false, "node --check map.js 失敗：" + e.message); }
ok(mapSrc.indexOf("const MAP_CSS=") >= 0, "檔頭有 MAP_CSS 字串常數");
ok(/function MAP_injectCSS\(\)/.test(mapSrc), "檔尾有 MAP_injectCSS()");
ok(mapSrc.lastIndexOf("MAP_injectCSS();") > mapSrc.indexOf("function MAP_injectCSS"), "檔案載入時立即呼叫 MAP_injectCSS");
ok(/window\.MAP_open\s*=/.test(mapSrc), "有匯出 window.MAP_open");

/* ---------------- 載入題庫 ---------------- */
load("content-mock.js");
load("content-mock-extra.js");
const hIdx = fs.readFileSync(INDEX_FILE, "utf8");
(function grabToeic() {
  const i = hIdx.indexOf("const TOEIC_Q=[");
  if (i < 0) { ok(false, "找不到 index.html 的 TOEIC_Q"); return; }
  const j = hIdx.indexOf("[", i);
  let d = 0;
  for (let k = j; k < hIdx.length; k++) {
    if (hIdx[k] === "[") d++;
    else if (hIdx[k] === "]") {
      d--;
      if (d === 0) {
        const arr = vm.runInContext("(" + hIdx.slice(j, k + 1) + ")", ctx);
        run("var TOEIC_Q=" + JSON.stringify(arr) + ";");
        return;
      }
    }
  }
})();
const BANK_TOTAL = run("TOEIC_Q.length + MOCK_BANK.listen.length + MOCK_BANK.read.length + MOCK_EXTRA.listen.length + MOCK_EXTRA.read.length");
console.log("  題庫合計 = " + BANK_TOTAL + " 題（TOEIC_Q " + run("TOEIC_Q.length") +
  " / MOCK_BANK " + run("MOCK_BANK.listen.length+MOCK_BANK.read.length") +
  " / MOCK_EXTRA " + run("MOCK_EXTRA.listen.length+MOCK_EXTRA.read.length") + "）");

run("var S={};");
load("map.js");

/* ---------------- 2. 地區資料格式 ---------------- */
sect("2. 地區資料格式");
const REGIONS = run("MAP_REGIONS");
ok(Array.isArray(REGIONS), "MAP_REGIONS 是陣列");
ok(REGIONS.length >= 8, "至少 8 個地區（實際 " + REGIONS.length + "）");
const ids = REGIONS.map(function (r) { return r.id; });
eq(new Set(ids).size, ids.length, "地區 id 無重複");
["商務區", "旅遊區", "生活區", "校園區", "醫療區", "金融區", "科技區", "新聞區"].forEach(function (n) {
  ok(REGIONS.some(function (r) { return r.name === n; }), "包含地區「" + n + "」");
});
REGIONS.forEach(function (r) {
  const size = r.cols * r.rows;
  const good = /^[a-z]+$/.test(r.id) && typeof r.name === "string" && r.name &&
    typeof r.en === "string" && r.en && typeof r.theme === "string" && r.theme &&
    typeof r.icon === "string" && r.icon && Number.isInteger(r.cols) && Number.isInteger(r.rows) &&
    (size === 12 || size === 20) && Array.isArray(r.kws) && r.kws.length >= 10 &&
    r.kws.every(function (k) { return typeof k === "string" && k.length > 1; });
  ok(good, r.id + " 資料格式正確（" + r.cols + "x" + r.rows + "=" + size + " 格, " + (r.kws ? r.kws.length : 0) + " 關鍵字）");
});
eq(run("MAP_tiles('biz')"), 20, "商務區 5x4=20 格");
eq(run("MAP_tiles('travel')"), 12, "旅遊區 4x3=12 格");

/* ---------------- 3. 每區題目數 >= 15 ---------------- */
sect("3. 分區題庫");
const stats = run("MAP_poolStats()");
let sum = 0;
REGIONS.forEach(function (r) {
  const n = stats[r.id];
  sum += n;
  ok(n >= MAP_MIN_Q_(n), r.name + "（" + r.id + "）題目數 " + n + " >= 15");
});
function MAP_MIN_Q_(n) { return Math.min(n, 15) === 15 ? 15 : 15; }  /* 單純化斷言用 */
eq(sum, BANK_TOTAL, "分區後題目總數 = 合併池總數（無遺失、無重複）");
const seen = new Set();
let dup = 0;
REGIONS.forEach(function (r) {
  run("MAP_regionQ('" + r.id + "')").forEach(function (q) {
    if (seen.has(q)) dup++; else seen.add(q);
  });
});
eq(dup, 0, "同一題不會出現在多個地區");
console.log("  分佈：" + REGIONS.map(function (r) { return r.name + "=" + stats[r.id]; }).join("  "));

/* ---------------- 4. 難度解鎖門檻 ---------------- */
sect("4. 難度解鎖門檻（整體正確率）");
eq(run("MAP_unlockNeed(1)"), 0, "難度 1 需要 0%");
near(run("MAP_unlockNeed(2)"), 0.40, "難度 2 需要 40%");
near(run("MAP_unlockNeed(3)"), 0.55, "難度 3 需要 55%");
near(run("MAP_unlockNeed(4)"), 0.70, "難度 4 需要 70%");
near(run("MAP_unlockNeed(5)"), 0.85, "難度 5 需要 85%");
near(run("MAP_unlockNeed(0)"), 0, "難度 0 向下取整到 1 → 0%");
near(run("MAP_unlockNeed(99)"), 0.85, "難度 99 向上夾到 5 → 85%");
eq(run("MAP_UNLOCK"), [0, 0.4, 0.55, 0.7, 0.85], "門檻表常數正確");

/* ---------------- 5. regionAcc ---------------- */
sect("5. regionAcc（該區歷史答對率）");
run("S={correct:0,total:0,gems:0,map:{},regionStat:{biz:{right:8,total:10}},mapClaim:{}};");
run("MAP_initState();");
near(run("MAP_regionAcc('biz')"), 0.8, "biz = 8/10 = 0.8");
near(run("MAP_regionAcc('travel')"), 0, "沒有資料的地區回傳 0");
ok(!!run("S.regionStat.travel"), "讀取時防禦性建立 S.regionStat.travel");
eq(run("S.regionStat.travel"), { right: 0, total: 0 }, "新建的結構為 {right:0,total:0}");
run("S.regionStat.life={right:0,total:0};");
near(run("MAP_regionAcc('life')"), 0, "total=0 不會除以零");
run("S.regionStat.life={right:12,total:8};");   /* right > total → 非法 */
run("MAP_initState();");
eq(run("S.regionStat.life"), { right: 0, total: 0 }, "非法值（right>total）被重置");
run("S.regionStat.news={right:'x',total:10};");
run("MAP_initState();");
eq(run("S.regionStat.news"), { right: 0, total: 0 }, "非法值（非數字）被重置");
run("S.regionStat.tech={right:3,total:5};");
near(run("MAP_regionAcc('tech')"), 0.6, "tech = 3/5 = 0.6");

/* ---------------- 6. 難度分級（依歷史正確率） ---------------- */
sect("6. 難度分級（由 regionAcc 分級）");
const diffCases = [
  ["biz", { right: 0, total: 100 }, 1],
  ["finance", { right: 39, total: 100 }, 1],
  ["travel", { right: 40, total: 100 }, 2],
  ["life", { right: 54, total: 100 }, 2],
  ["campus", { right: 55, total: 100 }, 3],
  ["medical", { right: 69, total: 100 }, 3],
  ["tech", { right: 70, total: 100 }, 4],
  ["news", { right: 84, total: 100 }, 4],
  ["biz2", null, null]
];
diffCases.slice(0, 8).forEach(function (c) {
  run("S.regionStat." + c[0] + "=" + JSON.stringify(c[1]) + ";");
  eq(run("MAP_diff('" + c[0] + "')"), c[2], c[0] + " 正確率 " + (c[1].right / c[1].total * 100).toFixed(0) + "% → 難度 " + c[2]);
});
run("S.regionStat.biz={right:85,total:100};");
eq(run("MAP_diff('biz')"), 5, "biz 正確率 85% → 難度 5");
run("S.regionStat.biz={right:0,total:0};");
eq(run("MAP_diff('biz')"), 1, "無資料 → 難度 1");

/* ---------------- 7. 解鎖判定 ---------------- */
sect("7. 解鎖判定（整體正確率 S.correct/S.total）");
run("S.regionStat={life:{right:55,total:100},campus:{right:70,total:100},medical:{right:85,total:100},biz:{right:0,total:0}};");
run("S.correct=55;S.total=100;");
near(run("MAP_globalAcc()"), 0.55, "整體正確率 = 55%");
eq(run("MAP_diff('life')"), 3, "life 難度 3");
ok(run("MAP_isUnlocked('life')"), "55% 整體 → 解鎖難度 3（門檻 55%）");
ok(!run("MAP_isUnlocked('campus')"), "55% 整體 → 鎖住難度 4（門檻 70%）");
ok(!run("MAP_isUnlocked('medical')"), "55% 整體 → 鎖住難度 5（門檻 85%）");
run("S.correct=70;S.total=100;");
ok(run("MAP_isUnlocked('campus')"), "70% 整體 → 解鎖難度 4");
ok(!run("MAP_isUnlocked('medical')"), "70% 整體 → 仍鎖住難度 5");
run("S.correct=85;S.total=100;");
ok(run("MAP_isUnlocked('medical')"), "85% 整體 → 解鎖難度 5");
run("S.correct=0;S.total=0;");
ok(run("MAP_isUnlocked('biz')"), "沒答過題（0%）→ 難度 1 地區一律解鎖");
ok(!run("MAP_isUnlocked('campus')"), "沒答過題 → 難度 4 地區未解鎖");
run("S.correct=55;S.total=100;");

/* ---------------- 8. AI 正確率映射 ---------------- */
sect("8. AI 正確率映射（依地區難度）");
near(run("MAP_aiAcc(1)"), 0.45, "難度 1 → 45%");
near(run("MAP_aiAcc(2)"), 0.55, "難度 2 → 55%");
near(run("MAP_aiAcc(3)"), 0.65, "難度 3 → 65%");
near(run("MAP_aiAcc(4)"), 0.75, "難度 4 → 75%");
near(run("MAP_aiAcc(5)"), 0.85, "難度 5 → 85%");
near(run("MAP_aiAcc(0)"), 0.45, "難度 0 → 夾到 45%");
near(run("MAP_aiAcc(9)"), 0.85, "難度 9 → 夾到 85%");
near(run("MAP_aiAcc('4')"), 0.75, "字串 4 → 75%");
eq(run("MAP_DMG"), 5, "每答錯扣 5 HP");
eq(run("MAP_BATTLE_N"), 20, "對戰 20 題");

/* ---------------- 9. S 新欄位防禦性初始化 ---------------- */
sect("9. S 新欄位防禦性初始化（舊存檔）");
run("S={gems:'abc',map:{biz:123,travel:[0,0,999,-1,'x',1]},regionStat:{biz:{right:'x',total:10},travel:{right:3}},mapClaim:'nope',correct:'10',total:'5',coins:'x'};");
run("MAP_initState();");
eq(run("S.gems"), 0, "S.gems 非法字串 → 0");
eq(run("S.map.travel"), [0, 1], "S.map 陣列去重 + 過濾非法索引");
eq(run("S.map.biz"), [], "S.map 非陣列 → 空陣列");
eq(run("S.mapClaim"), {}, "S.mapClaim 非物件 → {}");
eq(run("S.regionStat.biz"), { right: 0, total: 0 }, "S.regionStat.biz 非法 → 重置");
eq(run("S.regionStat.travel"), { right: 0, total: 0 }, "S.regionStat.travel 缺 total → 重置");
eq(run("S.correct"), 10, "S.correct 字串 → 數字");
eq(run("S.total"), 5, "S.total 字串 → 數字");
eq(run("S.coins"), 0, "S.coins 非法 → 0");
let allOk = true;
REGIONS.forEach(function (r) {
  if (!Array.isArray(run("S.map." + r.id))) allOk = false;
  const st = run("S.regionStat." + r.id);
  if (!st || typeof st.right !== "number" || typeof st.total !== "number") allOk = false;
});
ok(allOk, "8 個地區的 S.map / S.regionStat 都已建立");
run("S={correct:0,total:0,gems:0,coins:0,xp:0,map:{},regionStat:{},mapClaim:{}};MAP_initState();");
eq(run("S.gems"), 0, "乾淨存檔 → S.gems = 0");
ok(typeof run("window.MAP_open") === "function", "window.MAP_open 已匯出");

/* ---------------- 10. 開拓格子 / 寶石 ---------------- */
sect("10. 開拓格子與寶石獎勵");
run("S.regionStat.medical={right:4,total:10};");   /* 難度 2 → 整區完成 +5 寶石 */
const medSize = run("MAP_tiles('medical')");
near(run("MAP_regionAcc('medical')"), 0.4, "medical 4/10 = 0.4");
eq(run("MAP_diff('medical')"), 2, "medical 難度 2");
for (let i = 0; i < medSize; i++) run("MAP_claimTile('medical');");
eq(run("MAP_openCount('medical')"), medSize, "答對 " + medSize + " 題 → 開拓 " + medSize + " 格");
ok(run("MAP_isDone('medical')"), "整區 100% 開拓完成");
eq(run("S.gems"), 5, "整區完成獎勵 5 顆寶石（難度 2）");
eq(run("S.mapClaim.medical"), true, "S.mapClaim.medical 已記錄（只發一次）");
near(run("MAP_progress('medical')"), 1, "進度 100%");
const claim2 = run("MAP_claimTile('medical')");
eq(claim2, { opened: false, done: true, gems: 0 }, "重複領取不再發寶石");
eq(run("S.gems"), 5, "寶石沒有重複發放");
run("S.regionStat.news={right:85,total:100};");
for (let i = 0; i < run("MAP_tiles('news')"); i++) run("MAP_claimTile('news');");
eq(run("S.gems"), 5 + 10, "難度 5 整區完成 +10 寶石");

/* ---------------- 11. 畫面煙霧測試 ---------------- */
sect("11. 畫面煙霧測試");
run("S={correct:60,total:100,gems:0,coins:0,xp:0,map:{},regionStat:{},mapClaim:{}};MAP_initState();");
run("MAP_open();");
ok(!!REG["scr-map"], "scr-map 畫面已建立");
const order = body.children.indexOf(REG["scr-map"]) - body.children.indexOf(battleScreen);
eq(order, 1, "scr-map 插在 scr-battle 之後");
const listHtml = REG["scr-map"].innerHTML;
ok(listHtml.indexOf("領地地圖") >= 0, "總覽顯示「領地地圖」");
ok(listHtml.indexOf("歷史答題正確率") >= 0, "UI 明確標示難度依歷史正確率分級");
const cardCount = (listHtml.match(/class="map-card/g) || []).length;
eq(cardCount, 8, "總覽渲染 8 張地區卡片");
ok(listHtml.indexOf("🪙") >= 0 && listHtml.indexOf("💎") >= 0, "同時顯示金幣與寶石");
run("MAP_region('biz');");
ok(REG["scr-map"].innerHTML.indexOf("商務區") >= 0, "地區詳情顯示商務區");
ok(REG["scr-map"].innerHTML.indexOf("開拓領土") >= 0, "詳情有「開拓領土」按鈕");
ok(REG["scr-map"].innerHTML.indexOf("挑戰該區 AI") >= 0, "詳情有「挑戰該區 AI」按鈕");

/* ---------------- 12. 開拓作答流程 ---------------- */
sect("12. 開拓作答流程（每題開拓一格）");
run("MAP_start('biz');");
eq(run("MAP_STATE.view"), "play", "進入開拓畫面");
eq(run("MAP_STATE.qs.length"), 10, "一次出 10 題");
run("MAP_STATE.qs.forEach(function(q){ if(MAP_regionQ('biz').indexOf(q)<0) throw new Error('非本區題目'); });");
ok(true, "題目都來自該地區題庫");
const bizBefore = run("MAP_openCount('biz')");
const totalBefore = run("S.total"), correctBefore = run("S.correct"), coinBefore = run("S.coins"), xpBefore = run("S.xp");
let answered = 0;
for (let k = 0; k < 20; k++) {
  if (run("MAP_STATE.view") !== "play") break;
  const a = run("MAP_STATE.qs[MAP_STATE.qs.i].a");
  run("MAP_answer(" + a + ")");
  answered++;
}
eq(answered, 10, "作答 10 題");
eq(run("MAP_STATE.view"), "result", "答完進入結果畫面");
eq(run("MAP_STATE.right"), 10, "全對 → right = 10");
eq(run("MAP_openCount('biz')"), bizBefore + 10, "答對 10 題 → 開拓 10 格");
eq(run("S.total") - totalBefore, 10, "S.total +10");
eq(run("S.correct") - correctBefore, 10, "S.correct +10");
ok(run("S.regionStat.biz.total") > 0, "S.regionStat.biz.total 有記錄");
ok(run("S.coins") > coinBefore, "答對有金幣獎勵（" + coinBefore + " → " + run("S.coins") + "）");
ok(run("S.xp") > xpBefore, "答對有 XP 獎勵（" + xpBefore + " → " + run("S.xp") + "）");
ok(REG["scr-map"].innerHTML.indexOf("開拓結果") >= 0, "結果畫面已渲染");
/* 答錯不開拓 */
run("MAP_start('life');");
const lifeBefore = run("MAP_openCount('life')");
const stotal = run("S.total"), scorrect = run("S.correct");
const wrong = (run("MAP_STATE.qs[0].a") + 1) % run("MAP_STATE.qs[0].o.length");
run("MAP_answer(" + wrong + ")");
eq(run("MAP_openCount('life')"), lifeBefore, "答錯 → 不開拓土地");
eq(run("S.total") - stotal, 1, "答錯仍計入 S.total");
eq(run("S.correct") - scorrect, 0, "答錯不計入 S.correct");
ok(REG["scr-map"].innerHTML.indexOf("答錯了") >= 0, "答錯顯示回饋");

/* ---------------- 13. AI 對戰流程 ---------------- */
sect("13. 分區分難度 AI 對戰");
run("MAP_battle('travel');");
eq(run("MAP_STATE.view"), "battle", "進入對戰畫面");
eq(run("MAP_STATE.qs.length"), 20, "對戰 20 題");
near(run("MAP_STATE.acc"), run("MAP_aiAcc(MAP_diff('travel'))"), "AI 正確率 = 該區難度對應值");
eq(run("MAP_STATE.p1"), 100, "玩家 100 HP");
eq(run("MAP_STATE.p2"), 100, "AI 100 HP");
const trStatTotal = run("S.regionStat.travel.total");
const qIdx = run("MAP_STATE.qs[0].a");
const wrongIdx = (qIdx + 1) % run("MAP_STATE.qs[0].o.length");
run("MAP_battleAnswer(" + wrongIdx + ")");
eq(run("MAP_STATE.answered"), true, "作答後鎖定");
eq(run("MAP_STATE.p1"), 95, "玩家答錯扣 5 HP → 95");
ok(run("MAP_STATE.p2") === 100 || run("MAP_STATE.p2") === 95, "AI HP 只會是 100 或 95（依 " + Math.round(run("MAP_STATE.acc") * 100) + "% 正確率）");
eq(run("S.regionStat.travel.total") - trStatTotal, 1, "對戰答題也計入該區歷史");
eq(run("MAP_STATE.right1"), 0, "答錯 right1 = 0");
ok(String(run("MAP_STATE.fbLog")).indexOf("HP") >= 0, "戰鬥紀錄顯示 HP");
run("MAP_STATE.p1=0;MAP_STATE.p2=80;MAP_STATE.answered=false;MAP_endBattle();");
eq(run("MAP_STATE.view"), "result", "HP 歸零 → 進入對戰結果");
ok(REG["scr-map"].innerHTML.indexOf("AI 對戰結果") >= 0, "對戰結果已渲染");
ok(REG["scr-map"].innerHTML.indexOf("AI 正確率") >= 0, "結果顯示 AI 正確率");

/* ---------------- 總結 ---------------- */
console.log("\n========================================");
console.log("通過 " + pass + " 項，失敗 " + fail + " 項");
if (fail) {
  console.log("失敗項目：");
  fails.forEach(function (f) { console.log("  - " + f); });
}
process.exit(fail ? 1 : 0);
