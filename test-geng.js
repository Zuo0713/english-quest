/* test-geng.js — gen-grammar.js 產生器自動化驗證（node test-geng.js）
   驗證項目：
   1) node --check 語法無誤
   2) 每個 lessonId 生成 10 題全數通過 GENG_validate
   3) 答案索引 0-3、選項 4 個且無重複、題幹含空格、解析含中文
   4) 答案索引分布不固定（4 個索引都要出現）
   5) 同一 lessonId 連續兩次生成的題目不同
   6) GENG_exam(50) 全數合法且題幹不重複
   7) GENG_stats / GENG_lessons / GENG_NOTICE API 正常
   8) GENG_validate 對錯誤格式會回 false（閘門有效）
*/
const fs = require("fs"), vm = require("vm"), cp = require("child_process");
const FILE = __dirname + "/gen-grammar.js";

let fails = 0;
function ok(cond, msg){
  if(cond){ console.log("  PASS  " + msg); }
  else { fails++; console.log("  FAIL  " + msg); }
}
function section(t){ console.log("\n== " + t + " =="); }

/* ---- 1) 語法 ---- */
section("1. node --check 語法");
try{
  cp.execSync("node --check \"" + FILE + "\"", { stdio: "pipe" });
  ok(true, "gen-grammar.js node --check 通過");
}catch(e){
  ok(false, "node --check 失敗：" + String(e.stderr || e.message));
}

/* ---- 載入 ---- */
const ctx = { console: console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(FILE, "utf8"), ctx, { filename: "gen-grammar.js" });
["GENG_gen", "GENG_validate", "GENG_lessonQuestions", "GENG_exam", "GENG_stats", "GENG_lessons", "GENG_NOTICE"]
  .forEach(function(k){ ok(typeof ctx[k] !== "undefined", "API 存在：" + k); });

function batchCheck(qs, label, need){
  ok(Array.isArray(qs) && qs.length === need, label + "：回傳 " + need + " 題");
  let valid = 0, range = 0, four = 0, uniq = 0, blank = 0, zh = 0;
  const stems = new Set();
  qs.forEach(function(q){
    if(ctx.GENG_validate(q))valid++;
    if(Number.isInteger(q.a) && q.a >= 0 && q.a <= 3)range++;
    if(Array.isArray(q.o) && q.o.length === 4)four++;
    if(new Set(q.o).size === 4)uniq++;
    if(typeof q.q === "string" && q.q.indexOf("___") >= 0)blank++;
    if(/[\u4e00-\u9fff]/.test(q.e || ""))zh++;
    stems.add(q.q);
  });
  const n = qs.length;
  ok(valid === n, label + "：GENG_validate 全數通過 (" + valid + "/" + n + ")");
  ok(range === n, label + "：答案索引皆在 0-3 (" + range + "/" + n + ")");
  ok(four === n, label + "：每題 4 個選項 (" + four + "/" + n + ")");
  ok(uniq === n, label + "：選項無重複 (" + uniq + "/" + n + ")");
  ok(blank === n, label + "：題幹含 ___ 空格 (" + blank + "/" + n + ")");
  ok(zh === n, label + "：解析含中文 (" + zh + "/" + n + ")");
  ok(stems.size === n, label + "：同批題幹不重複 (" + stems.size + "/" + n + ")");
  return stems;
}

/* ---- 2) 每課 10 題 ---- */
section("2. 12 課各生成 10 題");
const ids = ctx.GENG_lessons().map(function(l){ return l.id; });
ok(ids.length === 12 && ids.join(",") === "1,2,3,4,5,6,7,8,9,10,11,12", "GENG_lessons() 回傳 12 課 (id 1-12)");

const idxCount = [0, 0, 0, 0];
const allStems = new Set();
ids.forEach(function(id){
  const b1 = ctx.GENG_gen(id, 10);
  batchCheck(b1, "第 " + id + " 課 批次1", 10);
  b1.forEach(function(q){ idxCount[q.a]++; allStems.add(q.q); });
  const b2 = ctx.GENG_gen(id, 10);
  ok(b2.length === 10, "第 " + id + " 課 批次2：回傳 10 題");
  const s1 = new Set(b1.map(function(q){ return q.q; }));
  const s2 = new Set(b2.map(function(q){ return q.q; }));
  let same = 0; s1.forEach(function(x){ if(s2.has(x))same++; });
  ok(same < s1.size, "第 " + id + " 課 連續兩次生成不同（重疊 " + same + "/10）");
  const bq = ctx.GENG_lessonQuestions(id);
  batchCheck(bq, "第 " + id + " 課 GENG_lessonQuestions", 10);
});

/* ---- 3) 答案索引分布 ---- */
section("3. 答案索引分布（12 課 x 10 題 = 120 題）");
console.log("  分布：A=" + idxCount[0] + "  B=" + idxCount[1] + "  C=" + idxCount[2] + "  D=" + idxCount[3]);
ok(idxCount.every(function(c){ return c > 0; }), "A/B/C/D 四個索引都出現（非固定值）");
const total120 = idxCount.reduce(function(a, b){ return a + b; }, 0);
ok(total120 === 120, "統計樣本數 = 120（實得 " + total120 + "）");
const min = Math.min.apply(null, idxCount), max = Math.max.apply(null, idxCount);
ok(min >= 10 && max <= 90, "分布不偏頗（min=" + min + ", max=" + max + "）");

/* ---- 4) GENG_exam(50) ---- */
section("4. GENG_exam(50) 混合題");
const ex = ctx.GENG_exam(50);
batchCheck(ex, "GENG_exam(50)", 50);
ok(new Set(ex.map(function(q){ return q.q; })).size === 50, "GENG_exam(50) 題幹全部不重複");
const exIdx = [0, 0, 0, 0];
ex.forEach(function(q){ exIdx[q.a]++; });
console.log("  分布：A=" + exIdx[0] + "  B=" + exIdx[1] + "  C=" + exIdx[2] + "  D=" + exIdx[3]);
ok(exIdx.every(function(c){ return c > 0; }), "混合題四個索引都出現");
const exLessons = new Set();
ok(Array.isArray(ex) && ex.length === 50, "exam 題數 50");
console.log("  題幹樣本：" + ex.slice(0, 3).map(function(q){ return q.q; }).join(" | "));

/* ---- 5) 統計與合規字串 ---- */
section("5. GENG_stats / GENG_NOTICE");
const st = ctx.GENG_stats();
console.log("  " + JSON.stringify(st));
ok(st.total >= 120 + 120 + 120 + 50, "total 統計正確（批次1+批次2+lessonQuestions+exam ≥ 410，實得 " + st.total + "）");
ok(st.batches > 0, "batches > 0");
ok(Object.keys(st.byLesson).length === 12, "byLesson 覆蓋 12 課");
ok(typeof ctx.GENG_NOTICE === "string" && ctx.GENG_NOTICE.indexOf("原創生成") >= 0 && ctx.GENG_NOTICE.indexOf("非歷屆試題") >= 0,
   "GENG_NOTICE 含合規用語：" + ctx.GENG_NOTICE);

/* ---- 6) 驗證閘門（壞題要被擋下） ---- */
section("6. GENG_validate 閘門");
const bad = [
  { name: "選項只有 3 個", q: { q: "She ___ here.", o: ["is", "are", "am"], a: 1, e: "測試解析測試解析" } },
  { name: "選項重複", q: { q: "She ___ here.", o: ["is", "is", "am", "be"], a: 0, e: "測試解析測試解析" } },
  { name: "答案索引 4", q: { q: "She ___ here.", o: ["is", "are", "am", "be"], a: 4, e: "測試解析測試解析" } },
  { name: "答案索引 -1", q: { q: "She ___ here.", o: ["is", "are", "am", "be"], a: -1, e: "測試解析測試解析" } },
  { name: "題幹無空格", q: { q: "She is here.", o: ["is", "are", "am", "be"], a: 0, e: "測試解析測試解析" } },
  { name: "解析沒中文", q: { q: "She ___ here.", o: ["is", "are", "am", "be"], a: 0, e: "because grammar" } },
  { name: "解析為空", q: { q: "She ___ here.", o: ["is", "are", "am", "be"], a: 0, e: "" } },
  { name: "題幹為空", q: { q: "", o: ["is", "are", "am", "be"], a: 0, e: "測試解析測試解析" } },
  { name: "不是物件", q: null }
];
bad.forEach(function(b){ ok(ctx.GENG_validate(b.q) === false, "拒絕：" + b.name); });
ok(ctx.GENG_validate({ q: "She ___ a teacher.", o: ["am", "is", "are", "be"], a: 1, e: "is 配第三人稱單數 She。" }) === true,
   "接受：合法題目");

/* ---- 7) 不存在的 lessonId 不會炸掉 ---- */
section("7. 防呆");
ok(Array.isArray(ctx.GENG_gen(99, 10)) && ctx.GENG_gen(99, 10).length === 0, "不存在的 lessonId 回傳空陣列（不丟例外）");
ok(Array.isArray(ctx.GENG_exam(0)) || ctx.GENG_exam(0).length >= 0, "GENG_exam(0) 不丟例外");

console.log("\n===============================");
console.log(fails === 0 ? "全部測試通過 ✔" : "有 " + fails + " 項失敗 ✘");
console.log("===============================");
process.exit(fails === 0 ? 0 : 1);
