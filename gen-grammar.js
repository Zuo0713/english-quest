/* ============================================================================
   gen-grammar.js — 文法新題產生器（依多益出題邏輯原創生成）

   【合規聲明】
   多益（TOEIC）歷屆試題受 ETS 版權保護，本檔「沒有」也不會抄錄任何歷屆
   試題。這裡的做法是：把多益 Part 5 / 文法題的「出題邏輯」（文法規則、
   常見干擾項設計、商務情境句型）拆成槽位與模板，再以隨機組合「原創生成」
   全新題目，效果等同於不斷長出新的練習題，而非盜版歷屆試題。

   對外 UI 請使用 GENG_NOTICE 作為說明用語：
     「🎲 隨機新題 · 依多益出題邏輯原創生成（非歷屆試題）」

   【格式】完全比照 content-grammar.js 的 GRAM_Q：
     {q:"題幹（含 ___ 空格）", o:[4 個選項], a:正確索引 0-3, e:"中文解析"}

   【對外 API】（唯一導出方式：window.GENG_*）
     window.GENG_gen(lessonId, n)          產生某課 n 題
     window.GENG_lessonQuestions(lessonId) 該課 10 題「🎲 隨機新題」
     window.GENG_exam(n)                   混合各文法點的 n 題（Part 5 風格）
     window.GENG_validate(q)               單題格式驗證（布林）
     window.GENG_stats()                   已生成題數統計
     window.GENG_lessons()                 12 課清單（給 UI 排按鈕用）
     window.GENG_NOTICE                    UI 合規說明字串

   【技術】所有內部全域名稱一律加 GENG_ 前綴；相依的既有全域函式
   （shuffle / toast 等）在呼叫當下才解析，不存在時自我保護。
   ========================================================================== */

const GENG_CSS = `
.geng-note{font-size:12px;line-height:1.6;opacity:.8;margin-top:6px}
.geng-badge{display:inline-block;padding:2px 8px;border-radius:999px;
  background:rgba(120,160,255,.18);border:1px solid rgba(120,160,255,.45);
  font-size:12px;letter-spacing:.2px}
`;

/* ======================= 相依函式（載入順序自我保護） ======================= */
function GENG_sh(a){ /* shuffle 安全代理：優先用既有 shuffle，否則自帶 Fisher-Yates */
  if(typeof shuffle === "function")return shuffle(a);
  const x = Array.prototype.slice.call(a);
  for(let i = x.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const t = x[i]; x[i] = x[j]; x[j] = t;
  }
  return x;
}
function GENG_one(a){ return a[Math.floor(Math.random() * a.length)]; }
function GENG_rand(n){ return Math.floor(Math.random() * n); }
function GENG_pickN(a, n){ return GENG_sh(a).slice(0, n); }
function GENG_toast(msg, emoji){ /* toast 可能尚未載入 → 直接略過 */
  if(typeof toast === "function"){ try{ toast(msg, emoji); }catch(e){} }
}
function GENG_cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ======================= 統計 ======================= */
const GENG_STATS = { total: 0, invalid: 0, batches: 0, byLesson: {}, started: 0 };
GENG_STATS.started = Date.now();

/* ======================= 驗證（題目品質硬性閘門） ======================= */
function GENG_validateWith(q){
  if(!q || typeof q !== "object")return "不是物件";
  if(typeof q.q !== "string" || !q.q.trim())return "題幹不是非空字串";
  if(q.q.indexOf("___") < 0)return "題幹缺少 ___ 空格";
  if(!Array.isArray(q.o) || q.o.length !== 4)return "選項必須正好 4 個";
  for(let i = 0; i < 4; i++){
    if(typeof q.o[i] !== "string" || !q.o[i].trim())return "第 " + (i + 1) + " 個選項無效";
  }
  const set = new Set(q.o.map(function(s){ return s.trim(); }));
  if(set.size !== 4)return "選項有重複";
  if(typeof q.a !== "number" || !Number.isInteger(q.a) || q.a < 0 || q.a > 3)return "答案索引必須是 0-3 的整數";
  if(typeof q.e !== "string" || q.e.trim().length < 6)return "中文解析太短";
  if(!/[\u4e00-\u9fff]/.test(q.e))return "中文解析必須含中文說明";
  return null;
}
function GENG_validate(q){ return GENG_validateWith(q) === null; }

/* ======================= 組題：規格 → 合法題目 =======================
   spec = {q:題幹, correct:正確選項, wrongs:[干擾項...], e:中文解析}
   選項去重後不足 4 個、或未通過驗證，一律丟棄（並計入 invalid）。      */
function GENG_build(spec){
  if(!spec || typeof spec !== "object")return null;
  const stem = spec.q, correct = String(spec.correct == null ? "" : spec.correct).trim();
  const why = String(spec.e == null ? "" : spec.e).trim();
  if(typeof stem !== "string" || stem.indexOf("___") < 0 || !correct || !why){
    GENG_STATS.invalid++; return null;
  }
  const seen = new Set([correct]), opts = [correct];
  const wr = GENG_sh(Array.isArray(spec.wrongs) ? spec.wrongs : []);
  for(let i = 0; i < wr.length && opts.length < 4; i++){
    const s = String(wr[i] == null ? "" : wr[i]).trim();
    if(!s || seen.has(s))continue;
    seen.add(s); opts.push(s);
  }
  if(opts.length !== 4){ GENG_STATS.invalid++; return null; }
  const o = GENG_sh(opts);
  const q = { q: stem, o: o, a: o.indexOf(correct), e: why };
  const err = GENG_validateWith(q);
  if(err){ GENG_STATS.invalid++; return null; }
  return q;
}

/* ============================================================================
   課 1：Be 動詞與代名詞
   槽位：主詞(人/物) × 謂語片語 × be 動詞規則 / 疑問句倒裝 / 所有格受格
   ========================================================================== */
const GENG_L1_PEOPLE = [
  { s: "Ms. Chen", sl: "Ms. Chen", be: "is", tag: "第三人稱單數" },
  { s: "Our new manager", sl: "our new manager", be: "is", tag: "第三人稱單數" },
  { s: "Mr. Tanaka", sl: "Mr. Tanaka", be: "is", tag: "第三人稱單數" },
  { s: "My brother", sl: "my brother", be: "is", tag: "第三人稱單數" },
  { s: "I", sl: "I", be: "am", tag: "第一人稱單數" },
  { s: "You", sl: "you", be: "are", tag: "第二人稱" },
  { s: "We", sl: "we", be: "are", tag: "複數主詞" },
  { s: "They", sl: "they", be: "are", tag: "複數主詞" },
  { s: "The new interns", sl: "the new interns", be: "are", tag: "複數主詞" },
  { s: "My colleagues", sl: "my colleagues", be: "are", tag: "複數主詞" }
];
const GENG_L1_THINGS = [
  { s: "The shipment", be: "is", tag: "第三人稱單數" },
  { s: "The package", be: "is", tag: "第三人稱單數" },
  { s: "The conference rooms", be: "are", tag: "複數主詞" },
  { s: "The new printers", be: "are", tag: "複數主詞" },
  { s: "The sample units", be: "are", tag: "複數主詞" },
  { s: "The documents", be: "are", tag: "複數主詞" }
];
const GENG_L1_PRED_P = [
  "available for the meeting this afternoon",
  "responsible for the new project",
  "in the main conference room",
  "ready for the presentation",
  "from the Taipei head office",
  "on the third floor",
  "in charge of the training session"
];
const GENG_L1_PRED_T = [
  "delayed by the heavy rain",
  "scheduled for tomorrow morning",
  "behind the reception desk",
  "in the supply room",
  "ready for tomorrow's demonstration",
  "on the third floor"
];
function GENG_beNote(be){
  if(be === "am")return "am 只能配第一人稱 I，is 配第三人稱單數，are 配 you 或複數主詞。";
  if(be === "is")return "is 只配第三人稱單數，am 只配 I，are 配 you 或複數主詞。";
  return "are 配 you、we、they 與複數名詞，is 只配第三人稱單數，am 只配 I。";
}
function GENG_l1_state(){ /* 陳述句：主詞與 be 動詞一致 */
  const useThing = Math.random() < 0.5;
  const sub = GENG_one(useThing ? GENG_L1_THINGS : GENG_L1_PEOPLE);
  const pred = GENG_one(useThing ? GENG_L1_PRED_T : GENG_L1_PRED_P);
  const wrongs = ["am", "is", "are"].filter(function(b){ return b !== sub.be; });
  return {
    q: sub.s + " ___ " + pred + ".",
    correct: sub.be,
    wrongs: wrongs.concat(["be"]),
    e: sub.s + " 是" + sub.tag + "，be 動詞用 " + sub.be + "；" + GENG_beNote(sub.be)
  };
}
function GENG_l1_question(){ /* 疑問句：be 動詞前置 */
  const useThing = Math.random() < 0.5;
  const sub = GENG_one(useThing ? GENG_L1_THINGS : GENG_L1_PEOPLE);
  const pred = GENG_one(useThing ? GENG_L1_PRED_T : GENG_L1_PRED_P);
  const sl = useThing ? sub.s.charAt(0).toLowerCase() + sub.s.slice(1) : sub.sl;
  const c = GENG_cap(sub.be);
  const wrongs = ["Am", "Is", "Are"].filter(function(b){ return b !== c; });
  return {
    q: "___ " + sl + " " + pred + "?",
    correct: c,
    wrongs: wrongs.concat(["Do"]),
    e: "疑問句要把 be 動詞提到主詞前，" + sub.s + " 是" + sub.tag + "配 " + c +
       "，所以是「" + c + " " + sl + "…?」；" + GENG_beNote(sub.be) +
       " Do 後面只能接一般動詞，不能接補語片語。"
  };
}
const GENG_L1_PRON = [
  { q: "This is ___ new assistant, Mr. Lee.", c: "my", w: ["me", "mine", "I"],
    e: "空格後有名詞 assistant，要用所有格 my；me 是受格、mine 後面不能再接名詞、I 是主格。" },
  { q: "Please hand ___ the keys to the meeting room.", c: "me", w: ["my", "mine", "I"],
    e: "動詞 hand 後面是受詞，要用受格 me；my 是所有格、mine 是名詞所有格、I 只能當主詞。" },
  { q: "___ department will process your application.", c: "Our", w: ["Us", "We", "Ours"],
    e: "空格後有名詞 department，要用所有格 Our；We 是主格、Us 是受格、Ours 後面不能接名詞。" },
  { q: "The IT team will contact ___ before the installation.", c: "you", w: ["your", "yours", "yourself"],
    e: "contact 後面是受詞，用受格 you；your 要接名詞、yours 是名詞所有格、yourself 是反身代名詞。" },
  { q: "Is this printer ___?", c: "yours", w: ["your", "you", "yourself"],
    e: "空格後沒有名詞，用名詞所有格 yours 表示「你的（印表機）」；your 後面必須接名詞。" },
  { q: "The boss wants ___ to join the conference call.", c: "me", w: ["my", "mine", "I"],
    e: "want + 受詞 + to V，此處要用受格 me；my 是所有格、mine 是名詞所有格、I 是主格。" },
  { q: "Mr. Park gave ___ the updated schedule.", c: "us", w: ["our", "ours", "we"],
    e: "give 後面接間接受詞，用受格 us；our 要接名詞、ours 是名詞所有格、we 只能當主詞。" },
  { q: "___ office is next to the elevator.", c: "Their", w: ["They", "Them", "Theirs"],
    e: "空格後有名詞 office，要用所有格 Their；Theirs 是名詞所有格，後面不能直接接名詞。" },
  { q: "The auditor asked ___ to resend the invoices.", c: "us", w: ["our", "ours", "we"],
    e: "asked 後面是受詞，用受格 us；our 要接名詞、ours 是名詞所有格、we 只能當主詞。" },
  { q: "Did you send the contract to ___ yesterday?", c: "her", w: ["she", "her's", "herself"],
    e: "to 是介系詞，後面要用受格 her；she 是主格、her's 不是正確的所有格寫法、herself 是反身代名詞。" },
  { q: "This laptop is ___ , so please do not use it.", c: "mine", w: ["my", "me", "I"],
    e: "空格後沒有名詞，用名詞所有格 mine 表示「我的（電腦）」；my 後面必須接名詞、me 是受格。" },
  { q: "The manager herself checked ___ e-mail twice.", c: "her", w: ["hers", "she", "herself's"],
    e: "空格後有名詞 e-mail，要用所有格 her；hers 是名詞所有格、she 是主格、herself's 不存在。" }
];
function GENG_l1_pron(){
  const it = GENG_one(GENG_L1_PRON);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 2：現在簡單式
   槽位：主詞(三單/複數) × 動詞(原形/三單/ing/過去) × 時間副詞；do/does 助動詞
   ========================================================================== */
const GENG_L2_VERBS = [
  { b: "go", t3: "goes", i: "going", p: "went", c: "to the head office by train every morning" },
  { b: "speak", t3: "speaks", i: "speaking", p: "spoke", c: "Japanese with our clients in Osaka" },
  { b: "check", t3: "checks", i: "checking", p: "checked", c: "e-mails before the morning meeting" },
  { b: "handle", t3: "handles", i: "handling", p: "handled", c: "all of the customer complaints" },
  { b: "study", t3: "studies", i: "studying", p: "studied", c: "business English after work" },
  { b: "review", t3: "reviews", i: "reviewing", p: "reviewed", c: "the budget proposal every Friday" },
  { b: "prepare", t3: "prepares", i: "preparing", p: "prepared", c: "the weekly sales report" },
  { b: "help", t3: "helps", i: "helping", p: "helped", c: "new employees with the system" },
  { b: "travel", t3: "travels", i: "traveling", p: "traveled", c: "to our branch offices twice a month" },
  { b: "finish", t3: "finishes", i: "finishing", p: "finished", c: "work at six o'clock every day" },
  { b: "write", t3: "writes", i: "writing", p: "wrote", c: "clear e-mails to our suppliers" },
  { b: "arrive", t3: "arrives", i: "arriving", p: "arrived", c: "at the office before eight" }
];
const GENG_L2_S3 = ["He", "She", "My brother", "Ms. Watanabe", "Our sales manager", "The new assistant", "Mr. Kim", "My colleague"];
const GENG_L2_S3L = ["he", "she", "my brother", "ms. watanabe", "our sales manager", "the new assistant", "mr. kim", "my colleague"];
const GENG_L2_SPL = ["They", "We", "The new assistants", "My colleagues", "Our managers", "The interns"];
const GENG_L2_SPLL = ["they", "we", "the new assistants", "my colleagues", "our managers", "the interns"];

function GENG_l2_statement(){ /* 三單加 -s / 複數用原形 */
  const three = Math.random() < 0.55;
  const v = GENG_one(GENG_L2_VERBS);
  const s = three ? GENG_one(GENG_L2_S3) : GENG_one(GENG_L2_SPL);
  const correct = three ? v.t3 : v.b;
  const wrongs = three ? [v.b, v.i, v.p] : [v.t3, v.i, v.p];
  return {
    q: s + " ___ " + v.c + ".",
    correct: correct,
    wrongs: wrongs,
    e: (three ? s + " 是第三人稱單數，動詞要加 -s 用 " + correct : s + " 是複數主詞，動詞用原形 " + correct) +
       "；" + v.i + " 是進行式（前面要配 be 動詞），" + v.p + " 是過去式，要用在過去時間。"
  };
}
const GENG_L2_DO = [
  { q: "They ___ attend the workshop on Tuesday.", c: "don't", w: ["doesn't", "aren't", "didn't"],
    e: "They 是複數主詞，現在式的否定用 don't；doesn't 只配第三人稱單數，didn't 是過去式，aren't 要配 V-ing。" },
  { q: "___ your supervisor approve the new budget?", c: "Does", w: ["Do", "Is", "Did"],
    e: "your supervisor 是第三人稱單數，現在式疑問句用 Does；Do 配複數，Did 是過去式，Is 後面不能接原形動詞。" },
  { q: "My roommate ___ work on weekends.", c: "doesn't", w: ["don't", "isn't", "didn't"],
    e: "My roommate 是第三人稱單數，否定用 doesn't；don't 配複數主詞，isn't 要配 V-ing 或補語。" },
  { q: "___ they usually take the shuttle bus?", c: "Do", w: ["Does", "Are", "Did"],
    e: "they 是複數主詞，現在式疑問句用 Do；Does 只配第三人稱單數，Are 後面不能接原形動詞。" },
  { q: "The receptionist ___ speak Mandarin.", c: "doesn't", w: ["don't", "isn't", "didn't"],
    e: "The receptionist 是第三人稱單數，否定用 doesn't + 原形 speak；isn't 後面不能接原形動詞。" },
  { q: "We ___ need the projector for this session.", c: "don't", w: ["doesn't", "isn't", "didn't"],
    e: "We 是複數主詞，現在式否定用 don't + 原形 need；doesn't 只配第三人稱單數。" },
  { q: "___ Mr. Adler handle international accounts?", c: "Does", w: ["Do", "Is", "Are"],
    e: "Mr. Adler 是第三人稱單數，疑問句用 Does + 原形 handle；Do 配複數主詞，Is/Are 是 be 動詞。" },
  { q: "The interns ___ submit their reports on Fridays.", c: "don't", w: ["doesn't", "isn't", "didn't"],
    e: "The interns 是複數主詞，否定用 don't；doesn't 只配第三人稱單數，on Fridays 表習慣用現在式。" },
  { q: "___ she often work overtime during the busy season?", c: "Does", w: ["Do", "Did", "Is"],
    e: "she 是第三人稱單數，現在式疑問句用 Does + 原形 work；Did 是過去式，Is 後面不能接原形動詞。" },
  { q: "Our branch office ___ close on public holidays.", c: "doesn't", w: ["don't", "isn't", "weren't"],
    e: "Our branch office 是單數主詞，否定用 doesn't + 原形 close；don't 配複數主詞。" }
];
function GENG_l2_do(){
  const it = GENG_one(GENG_L2_DO);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 3：冠詞 a / an / the / 零冠詞
   槽位：情境句模板 × 冠詞判定（音素、特指、泛指、不可數）
   選項池固定 ["a","an","the","零冠詞"]，句首空格時自動改大寫。
   ========================================================================== */
const GENG_L3_ZERO = "no article";
const GENG_L3_ITEMS = [
  { q: "Our company is looking for ___ experienced accountant for the finance team.", a: "an",
    e: "空格後的 experienced 以母音音素開頭，用 an；accountant 是單數可數名詞，不能零冠詞。" },
  { q: "Our company hired ___ engineer who specializes in warehouse safety.", a: "an",
    e: "engineer 以母音音素開頭，用 an；職稱前的單數可數名詞要用 a/an。" },
  { q: "He gave ___ honest answer about the delay.", a: "an",
    e: "honest 的 h 不發音，以母音音素開頭，所以用 an；這是首次提到，不用 the。" },
  { q: "We need ___ hour to set up the conference room.", a: "an",
    e: "hour 的 h 不發音，以母音音素開頭，用 an；an hour 是「一小時」。" },
  { q: "Please complete ___ application form and return it to the front desk.", a: "an",
    e: "首次提到且 application 以母音音素開頭，用 an application form；單數可數名詞不能零冠詞。" },
  { q: "I left ___ umbrella in the taxi after the meeting.", a: "an",
    e: "umbrella 以母音音素開頭用 an；單數可數名詞第一次提到要用 a/an。" },
  { q: "The candidate has ___ MBA from a university in Canada.", a: "an",
    e: "MBA 的發音以母音 /em/ 開頭，用 an；後面的 university 以子音音素 /j/ 開頭才是 a。" },
  { q: "Our manager sent ___ e-mail to the whole department.", a: "an",
    e: "e-mail 以母音音素 /iː/ 開頭，用 an；單數可數名詞首次提到要用 a/an。" },
  { q: "There is ___ meeting room available on the second floor.", a: "a",
    e: "meeting room 以子音音素開頭，用 a；首次提到的單數可數名詞不能零冠詞，也不用 an。" },
  { q: "We need ___ new printer for the marketing team.", a: "a",
    e: "printer 以子音音素開頭，用 a；an 只能用在母音音素開頭的字前面。" },
  { q: "The department ordered ___ uniform for the new security guard.", a: "a",
    e: "uniform 開頭是子音音素 /j/，所以用 a（和 university 一樣），不是按字母 u 判斷。" },
  { q: "We are opening ___ new branch near the university.", a: "a",
    e: "branch 以子音音素開頭用 a；後面的 university 以 /j/ 開頭也是 a，不能用 an。" },
  { q: "He is ___ unusual candidate because he speaks five languages.", a: "an",
    e: "unusual 以母音音素開頭，用 an；候選人是首次提到的單數可數名詞。" },
  { q: "Our office provides ___ free coffee for all employees.", a: GENG_L3_ZERO,
    e: "coffee 是不可數名詞且泛指，用零冠詞；a/an 只能配單數可數名詞。" },
  { q: "We offer ___ training for all new employees.", a: GENG_L3_ZERO,
    e: "training 在此當不可數名詞泛指「培訓」，用零冠詞；a training 不自然。" },
  { q: "Ms. Ortega is ___ most experienced member of the audit team.", a: "the",
    e: "最高級 most experienced 前面必須加定冠詞 the；a/an 不能配最高級。" },
  { q: "Please sign at ___ bottom of the page.", a: "the",
    e: "固定片語 at the bottom of 表示「在…底部」，要用 the。" },
  { q: "Could you turn off ___ lights before you leave?", a: "the",
    e: "指這間辦公室裡特定的燈，用定冠詞 the；a/an 只用於首次提到的不特定事物。" },
  { q: "The HR team will review ___ résumé of the final candidate.", a: "the",
    e: "後面有 of the final candidate 限定是特定那份履歷，用 the。" },
  { q: "Please turn off ___ air conditioner when you leave the office.", a: "the",
    e: "指辦公室裡這台特定的冷氣，用 the；a 表示「某一台」，語意不合。" },
  { q: "___ manager will join the call in a few minutes.", a: "the", cap: true,
    e: "指辦公室裡這位特定的主管（大家都知道是誰），用 The；A/An 表示不特定的「一位」。" },
  { q: "___ water in the kitchen has been tested.", a: "the", cap: true,
    e: "後面 in the kitchen 限定是特定的水，用 The；A/An 只能配單數可數名詞。" },
  { q: "___ information in the report is confidential.", a: "the", cap: true,
    e: "後面 in the report 限定是特定資訊，用 The；information 是不可數名詞，本來就不能用 A/An。" },
  { q: "___ first batch of samples will arrive on Tuesday.", a: "the", cap: true,
    e: "序數詞 first 前面必須用定冠詞 The（the first batch）。" },
  { q: "___ project manager is waiting in the lobby.", a: "The", cap: true,
    e: "指同棟大樓裡大家都知道的那位專案經理，用 The；Project manager 在此是身分特指。" }
];
function GENG_artOpts(art, cap){
  const disp = function(s){
    if(s === GENG_L3_ZERO)return cap ? "No article" : "no article";
    return cap ? GENG_cap(s) : s;
  };
  const all = ["a", "an", "the", GENG_L3_ZERO];
  return { c: disp(art), w: all.filter(function(x){ return x !== art; }).map(disp) };
}
function GENG_l3_article(){
  const it = GENG_one(GENG_L3_ITEMS);
  const o = GENG_artOpts(it.a, !!it.cap);
  return { q: it.q, correct: o.c, wrongs: o.w, e: it.e };
}

/* ============================================================================
   課 4：過去簡單式
   槽位：主詞 × 不規則/規則動詞(過去式) × 過去時間詞；did + 原形
   ========================================================================== */
const GENG_L4_VERBS = [
  { b: "submit", p: "submitted", s: "submits", i: "submitting", c: "the revised proposal" },
  { b: "write", p: "wrote", s: "writes", i: "writing", c: "a thank-you note to the supplier" },
  { b: "take", p: "took", s: "takes", i: "taking", c: "the early train to the branch office" },
  { b: "buy", p: "bought", s: "buys", i: "buying", c: "new headsets for the call center" },
  { b: "sign", p: "signed", s: "signs", i: "signing", c: "the contract with the German client" },
  { b: "hold", p: "held", s: "holds", i: "holding", c: "a short meeting with the design team" },
  { b: "leave", p: "left", s: "leaves", i: "leaving", c: "the office before the storm started" },
  { b: "bring", p: "brought", s: "brings", i: "bringing", c: "the sales figures to the review meeting" },
  { b: "choose", p: "chose", s: "chooses", i: "choosing", c: "the downtown hotel for the conference" },
  { b: "spend", p: "spent", s: "spends", i: "spending", c: "two hours correcting the invoice" },
  { b: "make", p: "made", s: "makes", i: "making", c: "an important decision about hiring" },
  { b: "get", p: "got", s: "gets", i: "getting", c: "a confirmation e-mail from the hotel" },
  { b: "send", p: "sent", s: "sends", i: "sending", c: "the agenda to all participants" }
];
const GENG_L4_SUBJ = ["Ms. Alvarez", "Our intern", "The project manager", "I", "We", "They", "My colleagues", "The accounting team"];
const GENG_L4_TIME = ["yesterday", "last Friday", "two days ago", "last week", "this morning", "earlier today", "before the client arrived"];
function GENG_l4_statement(){
  const pool = GENG_L4_VERBS.filter(function(v){ return !v.skip; });
  const v = GENG_one(pool);
  const s = GENG_one(GENG_L4_SUBJ);
  const t = GENG_one(GENG_L4_TIME);
  return {
    q: s + " ___ " + v.c + " " + t + ".",
    correct: v.p,
    wrongs: [v.b, v.s, v.i],
    e: t + " 是過去時間，動詞要用過去式 " + v.p + "；" + v.b + " 是原形、" + v.s +
       " 是第三人稱單數現在式、" + v.i + " 要配 be 動詞組成進行式。"
  };
}
const GENG_L4_DID = [
  { q: "___ the team approve the new schedule?", c: "Did", w: ["Do", "Does", "Was"],
    e: "過去的疑問句用 Did + 原形動詞 approve；Do、Does 是現在式，Was 後面不能接原形動詞。" },
  { q: "We ___ finish the report on time because the server was down.", c: "didn't", w: ["don't", "doesn't", "weren't"],
    e: "because the server was down 是過去情境，否定用 didn't + 原形 finish；don't、doesn't 是現在式。" },
  { q: "___ you send the invoice to the client yesterday?", c: "Did", w: ["Do", "Does", "Are"],
    e: "yesterday 是過去時間，疑問句用 Did + 原形 send；Are 後面要用 V-ing 或補語。" },
  { q: "The assistants ___ complete the form before the deadline.", c: "didn't", w: ["don't", "doesn't", "aren't"],
    e: "before the deadline 指過去這段時間的動作，用 didn't + 原形 complete；aren't 要配 V-ing。" },
  { q: "Why ___ you tell me about the change earlier?", c: "didn't", w: ["don't", "doesn't", "weren't"],
    e: "earlier 是過去時間，否定疑問用 didn't + 原形 tell；don't、doesn't 是現在式。" },
  { q: "___ she attend the orientation last Monday?", c: "Did", w: ["Do", "Does", "Is"],
    e: "last Monday 是過去時間，用 Did + 原形 attend；Do、Does 是現在式，Is 後面不能接原形動詞。" },
  { q: "I ___ realize the meeting had been canceled.", c: "didn't", w: ["don't", "doesn't", "wasn't"],
    e: "後半句 had been canceled 是過去完成式，主句用 didn't + 原形 realize；wasn't 後面不能接原形動詞。" },
  { q: "Mr. Evans ___ approve the travel budget last week.", c: "didn't", w: ["doesn't", "don't", "wasn't"],
    e: "last week 是過去時間，第三人稱單數的過去否定也是 didn't + 原形 approve；doesn't 是現在式。" },
  { q: "___ they sign the agreement at the meeting yesterday?", c: "Did", w: ["Do", "Does", "Are"],
    e: "yesterday 表過去，用 Did + 原形 sign；Do、Does 用於現在式。" },
  { q: "The designer ___ send the final artwork before lunch.", c: "didn't", w: ["doesn't", "don't", "isn't"],
    e: "before lunch 在此指今天稍早（過去），用 didn't + 原形 send；isn't 要配 V-ing。" }
];
function GENG_l4_did(){
  const it = GENG_one(GENG_L4_DID);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 5：現在進行式
   槽位：主詞(be 變化) × 動詞(V-ing) × 現在時間詞； Look!/Listen! 情境句
   ========================================================================== */
const GENG_L5_SUBJ = [
  { s: "I", be: "am" },
  { s: "Ms. Ortega", be: "is" },
  { s: "The project manager", be: "is" },
  { s: "Our receptionist", be: "is" },
  { s: "He", be: "is" },
  { s: "She", be: "is" },
  { s: "We", be: "are" },
  { s: "They", be: "are" },
  { s: "The new assistants", be: "are" },
  { s: "My colleagues", be: "are" }
];
const GENG_L5_VERBS = [
  { b: "print", i: "printing", s: "prints", p: "printed", c: "the boarding passes for the trip" },
  { b: "review", i: "reviewing", s: "reviews", p: "reviewed", c: "the contract terms with our lawyer" },
  { b: "wait", i: "waiting", s: "waits", p: "waited", c: "for the manager's approval" },
  { b: "discuss", i: "discussing", s: "discusses", p: "discussed", c: "the new marketing plan" },
  { b: "type", i: "typing", s: "types", p: "typed", c: "the customer data into the system" },
  { b: "upload", i: "uploading", s: "uploads", p: "uploaded", c: "the photos from the trade show" },
  { b: "pack", i: "packing", s: "packs", p: "packed", c: "the samples for the exhibition" },
  { b: "call", i: "calling", s: "calls", p: "called", c: "our clients in Europe" },
  { b: "test", i: "testing", s: "tests", p: "tested", c: "the new software update" },
  { b: "prepare", i: "preparing", s: "prepares", p: "prepared", c: "the slides for tomorrow's meeting" },
  { b: "write", i: "writing", s: "writes", p: "wrote", c: "an e-mail to the supplier" },
  { b: "check", i: "checking", s: "checks", p: "checked", c: "the inventory list twice" }
];
const GENG_L5_NOW = ["right now", "at the moment", "now", "while the client is waiting"];
function GENG_l5_statement(){
  const sub = GENG_one(GENG_L5_SUBJ);
  const v = GENG_one(GENG_L5_VERBS);
  const t = GENG_one(GENG_L5_NOW);
  const correct = sub.be + " " + v.i;
  return {
    q: sub.s + " ___ " + v.c + " " + t + ".",
    correct: correct,
    wrongs: [v.b, v.s, v.p],
    e: t + " 表示此刻正在進行，用現在進行式 " + correct + "（be + V-ing）；" +
       v.b + "、" + v.s + " 是現在簡單式（表習慣），" + v.p + " 是過去式。"
  };
}
const GENG_L5_SIGNAL = [
  { q: "Look! The manager ___ the final numbers on the whiteboard.", c: "is writing", w: ["write", "writes", "wrote"],
    e: "Look! 表示眼前正在進行的動作，用現在進行式 is writing；writes 是現在簡單式，wrote 是過去式。" },
  { q: "Look! Two technicians ___ the new sign in the lobby.", c: "are replacing", w: ["replace", "replaces", "replaced"],
    e: "Look! 強調眼前正在進行的動作，主詞 Two technicians 是複數，用 are replacing。" },
  { q: "Be quiet! Ms. Ortega ___ on the phone.", c: "is talking", w: ["talk", "talks", "talked"],
    e: "Be quiet! 表示此刻正在講電話，主詞是第三人稱單數，用 is talking。" },
  { q: "Please hurry! The taxi ___ outside.", c: "is waiting", w: ["waits", "wait", "waited"],
    e: "此刻正在外面等，用現在進行式 is waiting；waits 是表習慣的現在簡單式。" },
  { q: "Do not disturb him; he ___ an important call.", c: "is making", w: ["make", "makes", "made"],
    e: "此刻正在通話中，用 is making；make、makes 是現在簡單式，made 是過去式。" },
  { q: "Look! The marketing team ___ the new brochure.", c: "is reviewing", w: ["review", "reviews", "reviewed"],
    e: "Look! 表示眼前正在進行；集合名詞 the marketing team 視為單數，用 is reviewing。" },
  { q: "The receptionist ___ a visitor at the front desk right now.", c: "is assisting", w: ["assist", "assists", "assisted"],
    e: "right now 要求現在進行式，主詞是第三人稱單數，用 is assisting。" },
  { q: "Listen! Someone ___ the doorbell again.", c: "is ringing", w: ["ring", "rings", "rang"],
    e: "Listen! 表示此刻正在發生，用現在進行式 is ringing；rings 是現在簡單式表習慣，rang 是過去式。" },
  { q: "Hurry up! The meeting ___ in five minutes and we are not ready.", c: "is starting", w: ["start", "starts", "started"],
    e: "即將發生的近期安排常用進行式 is starting；start、starts 表習慣，started 是過去式。" },
  { q: "Be careful! The intern ___ hot coffee near the desk.", c: "is carrying", w: ["carry", "carries", "carried"],
    e: "此刻正在端咖啡，用現在進行式 is carrying；第三人稱單數的現在簡單式才是 carries。" }
];
function GENG_l5_signal(){
  const it = GENG_one(GENG_L5_SIGNAL);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 6：比較級與最高級
   槽位：形容詞(短音節 -er/-est、長音節 more/most) × 比較句型 / 最高級句型
   干擾項：原級、比較級、最高級、副詞、more + 短音節（錯誤用法）
   ========================================================================== */
const GENG_L6_ADJ = [
  { a: "cheap", c: "cheaper", s: "cheapest", adv: "cheaply", long: false,
    t1: "Rent in the suburbs is ___ than rent in the city center.",
    t2: "This is the ___ supplier we have ever worked with." },
  { a: "busy", c: "busier", s: "busiest", adv: "busily", long: false,
    t1: "The front desk is usually ___ than the back office.",
    t2: "Friday is the ___ day of the week at the airport." },
  { a: "easy", c: "easier", s: "easiest", adv: "easily", long: false,
    t1: "This form is much ___ than the previous version.",
    t2: "The first task is the ___ one for new employees." },
  { a: "hot", c: "hotter", s: "hottest", adv: "hotly", long: false,
    t1: "July is ___ than June in most cities.",
    t2: "Summer is the ___ season of the year." },
  { a: "cold", c: "colder", s: "coldest", adv: "coldly", long: false,
    t1: "The conference room is usually ___ than the hallway.",
    t2: "January is the ___ month of the year in Taipei." },
  { a: "large", c: "larger", s: "largest", adv: "largely", long: false,
    t1: "The new warehouse is ___ than the old one.",
    t2: "This is the ___ order our company has ever received." },
  { a: "quick", c: "quicker", s: "quickest", adv: "quickly", long: false,
    t1: "The online application is ___ than the paper one.",
    t2: "The team gave the ___ response to the customer's complaint." },
  { a: "strong", c: "stronger", s: "strongest", adv: "strongly", long: false,
    t1: "Demand for our new product is ___ than we expected.",
    t2: "The sales growth this year is the ___ in our history." },
  { a: "safe", c: "safer", s: "safest", adv: "safely", long: false,
    t1: "Working from home is considered ___ than commuting in rush hour.",
    t2: "This is the ___ exit in the building." },
  { a: "clear", c: "clearer", s: "clearest", adv: "clearly", long: false,
    t1: "The new instructions are ___ than the old ones.",
    t2: "The manager gave the ___ explanation of the policy." },
  { a: "close", c: "closer", s: "closest", adv: "closely", long: false,
    t1: "Our new branch is ___ to the station than the old one.",
    t2: "That is the ___ parking spot to the entrance." },
  { a: "productive", c: "more productive", s: "most productive", adv: "productively", long: true,
    t1: "The team is more ___ this quarter than last quarter.",
    t2: "Our Tokyo office is the most ___ branch in the region." },
  { a: "efficient", c: "more efficient", s: "most efficient", adv: "efficiently", long: true,
    t1: "The new software is more ___ than the old system.",
    t2: "This is the most ___ way to process the invoices." },
  { a: "reliable", c: "more reliable", s: "most reliable", adv: "reliably", long: true,
    t1: "Our new supplier is more ___ than the previous one.",
    t2: "This brand is the most ___ choice for office equipment." },
  { a: "convenient", c: "more convenient", s: "most convenient", adv: "conveniently", long: true,
    t1: "Online payment is more ___ than paying by check.",
    t2: "The downtown branch is the most ___ location for our customers." },
  { a: "comfortable", c: "more comfortable", s: "most comfortable", adv: "comfortably", long: true,
    t1: "The new chairs are more ___ than the old ones.",
    t2: "This is the most ___ seat on the morning train." },
  { a: "popular", c: "more popular", s: "most popular", adv: "popularly", long: true,
    t1: "The new menu is more ___ with staff than the old one.",
    t2: "This is the most ___ item in our online store." },
  { a: "expensive", c: "more expensive", s: "most expensive", adv: "expensively", long: true,
    t1: "Downtown offices are more ___ than offices in the suburbs.",
    t2: "This is the most ___ hotel near the convention center." },
  { a: "important", c: "more important", s: "most important", adv: "importantly", long: true,
    t1: "This client is more ___ than we originally thought.",
    t2: "The safety briefing is the most ___ part of the orientation." },
  { a: "careful", c: "more careful", s: "most careful", adv: "carefully", long: true,
    t1: "Our new assistant is more ___ than the previous one.",
    t2: "This is the most ___ review of the contract so far." }
];
function GENG_l6_distractors(adj, correct){
  const pool = [adj.a, adj.c, adj.s, adj.adv];
  if(!adj.long)pool.push("more " + adj.a);   /* 短音節：多一個常見錯誤用法 */
  const uniq = pool.filter(function(x, i){
    return x !== correct && pool.indexOf(x) === i;
  });
  return uniq;
}
function GENG_l6_compare(){ /* than + 比較級 */
  const d = GENG_one(GENG_L6_ADJ);
  return {
    q: d.t1,
    correct: d.c,
    wrongs: GENG_l6_distractors(d, d.c),
    e: "than 表示兩者比較，要用比較級 " + d.c + (d.long ? "（長音節用 more + 原級）" :
       (/y$/.test(d.a) ? "（y 結尾把 y 改成 i 再加 -er）" : "（短音節直接加 -er）")) +
       "；" + d.s + " 是最高級（要配 the），" + (d.long ? d.a + " 是原級不能配 than，" : "more " + d.a + " 是錯誤用法，") +
       d.adv + " 是副詞，不能當表語。"
  };
}
function GENG_l6_super(){ /* the + 最高級 */
  const d = GENG_one(GENG_L6_ADJ);
  return {
    q: d.t2,
    correct: d.s,
    wrongs: GENG_l6_distractors(d, d.s),
    e: "在 in/of 的範圍內做比較用最高級 " + d.s + "，且前面要有 the；" + d.c +
       " 是比較級，只能用在 than 的兩者比較，" + d.a + " 是原級。"
  };
}

/* ============================================================================
   課 7：介系詞（時間 / 地點 / 固定片語）
   槽位：情境句 × 正確介系詞；干擾項從同類介系詞池取出，模擬 Part 5 搭配題
   ========================================================================== */
const GENG_L7_ITEMS = [
  { q: "The meeting is ___ 9 a.m. sharp.", c: "at", w: ["in", "on", "by"],
    e: "at + 鐘點時刻（at 9 a.m.）；on 用於日期或星期，in 用於月、年或較長時間。" },
  { q: "Our flight to Seoul leaves ___ Monday morning.", c: "on", w: ["in", "at", "by"],
    e: "星期加 morning 用 on（on Monday morning）；at 只配時刻，in 配月份或較長時間。" },
  { q: "The expense report must be submitted ___ Friday noon.", c: "by", w: ["in", "on", "at"],
    e: "by + 時間表示「在…之前完成」的截止期限；on 是「在當天」，at 只配時刻，都不能表期限。" },
  { q: "The deadline for the application is ___ March 15th.", c: "on", w: ["in", "at", "of"],
    e: "具體日期 March 15th 前用 on；in 用於月份或年份，at 只配時刻，of 不表時間。" },
  { q: "He has worked in the finance department ___ 2018.", c: "since", w: ["for", "from", "in"],
    e: "since + 起點時間（2018 年起持續至今）；for + 一段時間（for three years）。" },
  { q: "We will stay in Bangkok ___ three days.", c: "for", w: ["since", "in", "at"],
    e: "for + 一段時間（for three days）；since 只能接起點時間，in/at 不表示持續長度。" },
  { q: "The printer is ___ the third floor, next to the reception desk.", c: "on", w: ["in", "at", "of"],
    e: "樓層前用 on（on the third floor）；in 強調在空間內部，at 表小地點，of 不表位置。" },
  { q: "The manager's name is ___ the label on the box.", c: "on", w: ["in", "at", "of"],
    e: "寫在表面（label）上用 on；in 表在內部，at 表地點，of 不表位置。" },
  { q: "Please put the forms ___ the blue folder.", c: "in", w: ["on", "at", "of"],
    e: "放進封閉空間內部用 in；on 是放在表面，at 表地點，of 不表位置。" },
  { q: "The manager is responsible ___ the annual budget.", c: "for", w: ["with", "of", "at"],
    e: "be responsible for 是固定片語「負責…」；responsible 不與 with、of、at 搭配。" },
  { q: "We are looking forward to hearing ___ you soon.", c: "from", w: ["to", "with", "of"],
    e: "hear from 是固定片語「收到某人的消息」；hear of 是「聽說」，hear to/with 不成立。" },
  { q: "Please reply ___ this e-mail before noon.", c: "to", w: ["on", "in", "at"],
    e: "reply to 是固定片語「回覆…」；reply 不與 on、in、at 搭配。" },
  { q: "The seminar will be held ___ the convention center.", c: "at", w: ["in", "on", "to"],
    e: "at + 明確地點（at the convention center）；on 表平面表面，to 表方向。" },
  { q: "Sign your name ___ the bottom of the form.", c: "at", w: ["in", "on", "of"],
    e: "固定片語 at the bottom of「在…底部」；bottom 不與 in、on、of 這種用法搭配。" },
  { q: "We will take a short break ___ the two sessions.", c: "between", w: ["among", "during", "along"],
    e: "between + 兩者（the two sessions）；among 用於三者以上，during 表「在…期間」。" },
  { q: "The keys are ___ the drawer under the counter.", c: "in", w: ["on", "at", "of"],
    e: "抽屜是封閉空間，用 in the drawer；on 是表面，at 表地點。" },
  { q: "Please arrive ___ the airport at least two hours early.", c: "at", w: ["in", "on", "to"],
    e: "at + 地點（at the airport）；in 強調在裡面，on 表表面，to 表方向。" },
  { q: "The announcement was posted ___ the notice board.", c: "on", w: ["in", "at", "of"],
    e: "公佈欄是平面，用 on the notice board；in 表內部，at 表地點。" },
  { q: "Our head office is ___ Taipei, near the river.", c: "in", w: ["on", "at", "to"],
    e: "in + 城市（in Taipei）；at 用於較小的明確地點，on 表表面。" },
  { q: "The budget must be approved ___ the end of the month.", c: "by", w: ["in", "on", "at"],
    e: "by the end of 表示「在…結束之前」的期限；at、in、on 都不表示截止。" },
  { q: "Please keep your badge ___ you at all times.", c: "with", w: ["for", "on", "to"],
    e: "keep something with you 是固定用法「隨身攜帶」；keep for、keep to、keep on 語意不合。" },
  { q: "The contract was signed ___ both companies.", c: "by", w: ["with", "of", "from"],
    e: "被動語態用 by 引出動作執行者（由兩家公司簽署）；with、of、from 都不能表執行者。" },
  { q: "The new policy applies ___ all full-time employees.", c: "to", w: ["for", "on", "with"],
    e: "apply to 是「適用於…」；apply for 是「申請」，apply 不與 on、with 搭配。" },
  { q: "We are short ___ staff this week because of the holiday.", c: "of", w: ["with", "in", "for"],
    e: "be short of 是固定片語「缺少…」；short with、short in、short for 都不表示缺少。" }
];
function GENG_l7_prep(){
  const it = GENG_one(GENG_L7_ITEMS);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 8：主詞動詞一致
   槽位：各式主詞（each/every、there is/are、A and B、either...or、集合名詞、
         插入修飾語）× 正確動詞；干擾項由 is/are/has/have/was/were 池取出。
   ========================================================================== */
const GENG_L8_ITEMS = [
  { q: "Each of the employees ___ to sign the confidentiality agreement.", c: "has", w: ["have", "are", "were"],
    e: "Each of + 複數名詞視為單數，動詞用 has；真正的主詞是 Each，不是 employees。" },
  { q: "The number of applicants ___ increasing every year.", c: "is", w: ["are", "have", "were"],
    e: "The number of + 複數名詞當單數用 is；A number of 才是複數用 are。" },
  { q: "Neither the manager nor the assistants ___ available this afternoon.", c: "are", w: ["is", "was", "has"],
    e: "neither...nor 就近原則：動詞與靠近的 the assistants（複數）一致，用 are。" },
  { q: "Either the accountant or the director ___ going to sign the contract.", c: "is", w: ["are", "were", "have"],
    e: "either...or 就近原則：動詞與靠近的 the director（單數）一致，用 is。" },
  { q: "There ___ two training sessions scheduled for next week.", c: "are", w: ["is", "has", "was"],
    e: "there be 句型的動詞要與後面的真實主詞 two sessions（複數）一致，用 are。" },
  { q: "The marketing team ___ ready to present its final proposal.", c: "is", w: ["are", "have", "were"],
    e: "集合名詞 team 在此視為一個整體，且有 its 呼應，用單數 is。" },
  { q: "Everyone in the department ___ received the new safety guidelines.", c: "has", w: ["have", "are", "were"],
    e: "Everyone 是不定代名詞，一律當單數，現在完成式用 has received。" },
  { q: "A number of clients ___ asked for an extension.", c: "have", w: ["has", "is", "was"],
    e: "A number of + 複數名詞當複數用 have；The number of 才當單數用 has。" },
  { q: "The CEO and the CFO ___ attending the conference together.", c: "are", w: ["is", "was", "has"],
    e: "A and B 是兩個人，主詞為複數，用 are attending。" },
  { q: "Sales of the new model ___ rising steadily this year.", c: "are", w: ["is", "has", "was"],
    e: "真正的主詞是 Sales（複數），of the new model 只是修飾語，用 are rising。" },
  { q: "Each of the branch offices ___ its own manager.", c: "has", w: ["have", "are", "were"],
    e: "Each 是單數主詞（of the branch offices 是修飾語），用 has。" },
  { q: "The news ___ surprisingly good this morning.", c: "is", w: ["are", "were", "have"],
    e: "news 雖以 s 結尾但為不可數單數，用 is；are 只配複數主詞。" },
  { q: "Twenty employees ___ been trained on the new system.", c: "have", w: ["has", "is", "was"],
    e: "Twenty employees 是複數主詞，現在完成式用 have been trained。" },
  { q: "Mr. Chen as well as his assistants ___ joining the video call.", c: "is", w: ["are", "were", "have"],
    e: "as well as 不影響主詞數量，主詞是單數的 Mr. Chen，用 is（就遠原則看真正的主詞）。" },
  { q: "Neither of the proposals ___ acceptable to the client.", c: "is", w: ["are", "were", "have"],
    e: "Neither 當代名詞是單數，用 is；of the proposals 只是修飾語。" },
  { q: "Our company ___ three branch offices in Europe.", c: "has", w: ["have", "is", "are"],
    e: "Our company 是單數主詞，用 has；have 用於複數主詞或 I/you。" },
  { q: "The information on the flyer ___ correct.", c: "is", w: ["are", "were", "have"],
    e: "information 是不可數名詞當單數，用 is；on the flyer 只是修飾語，別被誤導。" },
  { q: "A lot of paperwork ___ waiting for your approval.", c: "is", w: ["are", "were", "have"],
    e: "paperwork 是不可數名詞，a lot of 不可數時動詞用單數 is。" },
  { q: "The two applicants from the branch office ___ both qualified.", c: "are", w: ["is", "was", "has"],
    e: "主詞是複數的 The two applicants，from the branch office 是修飾語，用 are。" },
  { q: "Every employee and every visitor ___ to wear a badge inside the plant.", c: "has", w: ["have", "are", "were"],
    e: "every + N and every + N 為單數主詞，動詞用 has。" }
];
function GENG_l8_agree(){
  const it = GENG_one(GENG_L8_ITEMS);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 9：不定詞與動名詞
   槽位：情境句 × 動詞搭配（to V / V-ing）；干擾項 = 另一種形式 + 原形 + 過去式
   ========================================================================== */
const GENG_L9_ITEMS = [
  { q: "We decided ___ the proposal to the client after lunch.", c: "to submit", w: ["submitting", "submit", "submitted"],
    e: "decide to V「決定做某事」為固定搭配，所以用 to submit。" },
  { q: "The manager agreed ___ the new schedule.", c: "to accept", w: ["accepting", "accept", "accepted"],
    e: "agree to V 是固定用法，用 to accept；agree 不接 V-ing。" },
  { q: "She wants ___ a transfer to the Singapore branch.", c: "to get", w: ["getting", "get", "gets"],
    e: "want to V「想要做」為固定搭配；want 不接 V-ing 或原形動詞。" },
  { q: "Our team hopes ___ the contract before the deadline.", c: "to sign", w: ["signing", "sign", "signed"],
    e: "hope to V 是固定用法；hope 不接 V-ing，也不是 hope that 省略的型態。" },
  { q: "I enjoy ___ business articles during my commute.", c: "reading", w: ["read", "to read", "reads"],
    e: "enjoy + V-ing「享受做…」是固定搭配；enjoy 不能接 to V。" },
  { q: "They avoided ___ the budget cut until the meeting.", c: "discussing", w: ["discuss", "to discuss", "discussed"],
    e: "avoid + V-ing「避免做…」為固定搭配；avoid 不能接 to V。" },
  { q: "Would you mind ___ the door? It is noisy outside.", c: "closing", w: ["close", "to close", "closed"],
    e: "mind + V-ing「介意做…」為固定用法；mind 後面不能接 to V。" },
  { q: "The interns kept ___ questions during the presentation.", c: "asking", w: ["ask", "to ask", "asked"],
    e: "keep + V-ing「一直做…」為固定搭配；keep 後面不用 to V。" },
  { q: "We look forward to ___ you at the trade show.", c: "meeting", w: ["meet", "to meet", "met"],
    e: "look forward to 中的 to 是介系詞，不是不定詞，後面要接 V-ing，所以用 meeting。" },
  { q: "Please remember ___ the attendance sheet before you leave.", c: "to sign", w: ["signing", "sign", "signed"],
    e: "remember to V 是「記得去做的事（還沒做）」；sheet 還沒簽，所以用 to sign。" },
  { q: "Don't forget ___ off the lights when you leave the office.", c: "to turn", w: ["turning", "turn", "turned"],
    e: "forget to V 是「別忘了去做（還沒做）」；燈還沒關，用 to turn。" },
  { q: "The staff finished ___ the quarterly report ahead of schedule.", c: "preparing", w: ["prepare", "to prepare", "prepared"],
    e: "finish + V-ing「完成做…」為固定搭配；finish to V 不合語法。" },
  { q: "He suggested ___ the conference call until next Monday.", c: "postponing", w: ["postpone", "to postpone", "postponed"],
    e: "suggest + V-ing 是固定用法；suggest 不能接 to V。" },
  { q: "She avoided ___ to the client about the delay.", c: "talking", w: ["talk", "to talk", "talked"],
    e: "avoid + V-ing 為固定搭配，且 talk to sb. 是固定說法，所以用 talking。" },
  { q: "Our company plans ___ a new branch in Vietnam.", c: "to open", w: ["opening", "open", "opened"],
    e: "plan to V「計畫做」是固定搭配；plan 不接 V-ing（plan on V-ing 才有，但此句無 on）。" },
  { q: "Please stop ___ in the corridor; customers are passing by.", c: "shouting", w: ["shout", "to shout", "shouted"],
    e: "stop + V-ing 是「停止正在做的事」；走廊上的人在吵，要停止喊叫，所以用 shouting。" },
  { q: "Please delay ___ the meeting until the manager arrives.", c: "starting", w: ["start", "to start", "started"],
    e: "delay + V-ing「延後做某事」為固定搭配；delay 後面不能接 to V 或原形動詞。" },
  { q: "We are considering ___ the deadline by two days.", c: "extending", w: ["extend", "to extend", "extended"],
    e: "consider + V-ing「考慮做…」是固定用法；consider 不能接 to V。" },
  { q: "Do you mind ___ the file to the whole team?", c: "sending", w: ["send", "to send", "sent"],
    e: "mind + V-ing 為固定用法；mind 後面不能接 to V 或原形動詞。" },
  { q: "We appreciate ___ to the annual dinner.", c: "being invited", w: ["invite", "to invite", "invited"],
    e: "appreciate + V-ing 是固定搭配，且主詞是「被邀請」，用被動的 being invited。" }
];
function GENG_l9_pattern(){
  const it = GENG_one(GENG_L9_ITEMS);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 10：關係代名詞
   槽位：先行詞（人 / 物）× 關係代名詞功能（主詞 / 所有格）
   干擾項池刻意排除 that（多數情況 that 也正確，當干擾項會造成雙解）。
   ========================================================================== */
const GENG_L10_POOL = ["who", "which", "whose", "whom", "where"];
const GENG_L10_ITEMS = [
  { q: "The engineer ___ designed the system won an award.", c: "who",
    e: "先行詞 engineer 是人，且關係從句中缺主詞（designed），用 who；which 用於物，whose 是所有格。" },
  { q: "The manager ___ car was parked illegally received a warning.", c: "whose",
    e: "空格後有名詞 car，表示「經理的車」，要用所有格 whose；who 是主格，whom 是受格。" },
  { q: "The proposal ___ was submitted last week has been approved.", c: "which",
    e: "先行詞 proposal 是物，且從句中缺主詞，用 which；who 只能指人，whose 是所有格。" },
  { q: "The employees ___ completed the safety course will receive a bonus.", c: "who",
    e: "先行詞 employees 是人且在從句中當主詞，用 who；which 用於物，whom 是受格。" },
  { q: "This is the supplier ___ delivered the parts late.", c: "who",
    e: "先行詞 supplier 是人且在從句中當主詞（delivered），用 who。" },
  { q: "The building ___ houses our new branch is near the station.", c: "which",
    e: "先行詞 building 是物且在從句中當主詞，用 which；whose 要後接名詞。" },
  { q: "The customer ___ complaint we received was resolved quickly.", c: "whose",
    e: "空格後有名詞 complaint（客戶的申訴），要用所有格 whose。" },
  { q: "The woman ___ is in charge of recruiting is my former classmate.", c: "who",
    e: "先行詞 woman 是人且從句中缺主詞（is），用 who；which 用於物。" },
  { q: "This is the factory ___ produces the electronic components.", c: "which",
    e: "先行詞 factory 是物且在從句中當主詞，用 which；who 指人，whose 是所有格。" },
  { q: "The interns ___ desks are near the window are from the same school.", c: "whose",
    e: "空格後有名詞 desks（實習生的桌子），要用所有格 whose。" },
  { q: "The book ___ explains our new policy is on the table.", c: "which",
    e: "先行詞 book 是物且在從句中當主詞，用 which；who 只能指人。" },
  { q: "Anyone ___ needs a parking permit should contact HR.", c: "who",
    e: "先行詞 anyone 是人且從句中缺主詞（needs），用 who。" },
  { q: "The project ___ we launched last month is already profitable.", c: "which",
    e: "先行詞 project 是物，且關係從句中缺受詞，用 which（that 亦可但不在選項）。" },
  { q: "The man ___ office is next to mine is an auditor.", c: "whose",
    e: "空格後有名詞 office（那位男士的辦公室），要用所有格 whose。" },
  { q: "The flight ___ arrived late was fully booked.", c: "which",
    e: "先行詞 flight 是物且在從句中當主詞（arrived），用 which。" },
  { q: "The colleague ___ helped me with the report works in accounting.", c: "who",
    e: "先行詞 colleague 是人且在從句中當主詞，用 who；whom 只能當受詞。" },
  { q: "The company ___ headquarters are in Osaka employs 500 people.", c: "whose",
    e: "空格後有名詞 headquarters（公司的總部），要用所有格 whose。" },
  { q: "The e-mail ___ contained the attachment was blocked.", c: "which",
    e: "先行詞 e-mail 是物且在從句中當主詞，用 which；who 指人，whose 要接名詞。" }
];
function GENG_l10_rel(){
  const it = GENG_one(GENG_L10_ITEMS);
  const wrongs = GENG_L10_POOL.filter(function(x){ return x !== it.c; });
  return { q: it.q, correct: it.c, wrongs: wrongs, e: it.e };
}

/* ============================================================================
   課 11：被動語態
   槽位：受動主詞 × 時態標記（every/last/tomorrow/since）× be + 過去分詞
   干擾項：主動式、缺 be、錯誤時態的被動式。
   ========================================================================== */
const GENG_L11_ITEMS = [
  { q: "The quarterly report ___ by the marketing team every month.", c: "is prepared", w: ["prepares", "prepared", "is preparing"],
    e: "every month 表例行動作，且 report 是「被準備」，用現在式被動 is prepared；prepares 是主動，prepared 缺 be。" },
  { q: "The new policy ___ to all employees last Monday.", c: "was announced", w: ["is announced", "will announce", "has announced"],
    e: "last Monday 是過去時間，policy 是「被公佈」，用 was announced；is announced 是現在式，will announce 是主動。" },
  { q: "The final decision ___ at the board meeting tomorrow.", c: "will be announced", w: ["is announced", "was announced", "will announce"],
    e: "tomorrow 表未來，decision 是「被公佈」，用 will be announced；will announce 是主動，缺 be。" },
  { q: "The samples ___ to our head office last week.", c: "were shipped", w: ["are shipped", "ship", "have shipped"],
    e: "last week 是過去時間，samples 是複數受動者，用 were shipped；are shipped 是現在式，ship 是主動。" },
  { q: "English ___ by many of our international customers.", c: "is spoken", w: ["speaks", "spoke", "is speaking"],
    e: "English 是「被使用」的語言，用現在式被動 is spoken；speaks 是主動且主詞應是人。" },
  { q: "The damaged laptop ___ free of charge under the warranty.", c: "is repaired", w: ["repairs", "repaired", "is repairing"],
    e: "laptop 是「被修理」，保修條款用現在式陳述，用 is repaired；repairs 是主動，repaired 缺 be 動詞。" },
  { q: "The meeting time ___ by e-mail next week.", c: "will be announced", w: ["is announced", "was announced", "announces"],
    e: "next week 表未來，meeting time 是「被公佈」，用 will be announced；announces 是主動。" },
  { q: "The conference hall ___ for the annual meeting since January.", c: "has been reserved", w: ["is reserved", "was reserved", "reserved"],
    e: "since + 起點時間要用現在完成式被動 has been reserved；was reserved 是過去式，與 since 衝突。" },
  { q: "Every new employee ___ to sign the confidentiality form.", c: "is required", w: ["requires", "required", "is requiring"],
    e: "employee 是「被要求」，用被動 is required；requires 是主動（employee 要求別人），required 缺 be。" },
  { q: "Two of our products ___ in the new catalog next month.", c: "will be featured", w: ["are featured", "was featured", "features"],
    e: "next month 表未來，products 是複數受動者，用 will be featured；was featured 主詞數量不對。" },
  { q: "The backup ___ automatically every night.", c: "is created", w: ["creates", "created", "is creating"],
    e: "every night 表例行，backup 是「被建立」，用現在式被動 is created；creates 是主動。" },
  { q: "The document ___ by the director yesterday.", c: "was reviewed", w: ["is reviewed", "reviews", "has reviewed"],
    e: "yesterday 是過去時間，document 是「被審閱」，用 was reviewed；is reviewed 是現在式，has reviewed 是主動。" },
  { q: "This form ___ by every new hire before the first day of work.", c: "must be completed", w: ["must complete", "must completing", "completed"],
    e: "form 是「被填寫」，助動詞後要用 be + p.p.，所以是 must be completed；must complete 是主動。" },
  { q: "The new rules ___ at the staff meeting next Friday.", c: "will be introduced", w: ["are introduced", "was introduced", "introduces"],
    e: "next Friday 表未來，rules 是複數受動者，用 will be introduced；was introduced 數量不符，introduces 是主動。" },
  { q: "Our products ___ in more than 30 countries.", c: "are sold", w: ["sell", "are selling", "sold"],
    e: "products 是「被販售」，用現在式被動 are sold；sell 是主動（且主詞通常是人），sold 缺 be。" },
  { q: "The e-mail ___ because the attachment was too large.", c: "was rejected", w: ["rejects", "is rejecting", "rejected"],
    e: "e-mail 是「被退回」，原因子句是過去情境，用 was rejected；rejects 是主動，rejected 缺 be。" },
  { q: "The invoice ___ to the wrong department by mistake yesterday.", c: "was sent", w: ["is sent", "sends", "is sending"],
    e: "yesterday 是過去時間，invoice 是「被寄出」，用 was sent；is sent 是現在式，sends 是主動。" },
  { q: "The room ___ tonight after the workshop.", c: "will be cleaned", w: ["is cleaned", "cleans", "is cleaning"],
    e: "tonight 表未來，room 是「被打掃」，用 will be cleaned；cleans 是主動。" },
  { q: "The names of the winners ___ on the company intranet next Tuesday.", c: "will be posted", w: ["are posted", "posts", "posted"],
    e: "next Tuesday 表未來，names 是「被公佈」，用 will be posted；posts 是主動，posted 缺 be。" },
  { q: "The old servers ___ by the IT department last weekend.", c: "were replaced", w: ["are replaced", "replace", "is replacing"],
    e: "last weekend 是過去時間，servers 是複數受動者，用 were replaced；are replaced 是現在式。" }
];
function GENG_l11_passive(){
  const it = GENG_one(GENG_L11_ITEMS);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   課 12：現在完成式
   槽位：情境句 × 完成式 trigger（since / for / yet / so far / ever / just / first time）
   ========================================================================== */
const GENG_L12_ITEMS = [
  { q: "Ms. Huang ___ in our Taipei office since 2018.", c: "has worked", w: ["works", "worked", "is working"],
    e: "since + 起點時間要用現在完成式 has worked；worked 是過去式，不能與 since 連用。" },
  { q: "We ___ the contract yet, so please wait for further notice.", c: "haven't signed", w: ["didn't sign", "don't sign", "weren't signing"],
    e: "yet 用於否定句且強調至今的結果，用現在完成式 haven't signed；didn't sign 是過去式。" },
  { q: "Our team ___ three new clients so far this quarter.", c: "has signed", w: ["signed", "is signing", "signs"],
    e: "so far「到目前為止」要求現在完成式 has signed；signed 是過去式，is signing 是進行式。" },
  { q: "___ you ever ___ a formal complaint?", c: "Have, filed", w: ["Did, file", "Do, file", "Are, filing"],
    e: "ever 問經驗且後面接過去分詞，用 Have you ever filed；Did/Do 後面只能接原形動詞。" },
  { q: "The designers ___ the final artwork yet.", c: "haven't finished", w: ["didn't finish", "don't finish", "aren't finishing"],
    e: "yet 表示「還沒有」，要用現在完成式 haven't finished；didn't finish 是過去式。" },
  { q: "Mr. Patel ___ with the company for ten years.", c: "has worked", w: ["worked", "works", "was working"],
    e: "for + 一段時間表示持續至今，用現在完成式 has worked；worked 是過去式。" },
  { q: "___ you ever ___ our annual customer survey?", c: "Have, completed", w: ["Did, complete", "Do, complete", "Are, completing"],
    e: "ever 問經驗要用 Have you ever completed；Did/Do 後面接原形動詞，不能接過去分詞 completed。" },
  { q: "Our sales team ___ its target for the year yet.", c: "hasn't reached", w: ["didn't reach", "doesn't reach", "isn't reaching"],
    e: "yet 在否定句中要用現在完成式 hasn't reached；didn't reach 是過去式，isn't reaching 是進行式。" },
  { q: "I ___ that new restaurant on Zhongxiao Road yet.", c: "haven't tried", w: ["tried", "never tried", "am trying"],
    e: "yet 要求現在完成式，否定句用 haven't tried；tried、never tried 是過去式，不能與 yet 連用。" },
  { q: "The accounting team ___ all of the invoices so far this month.", c: "has processed", w: ["processed", "is processing", "processes"],
    e: "so far 要求現在完成式 has processed；processed 是過去式，is processing 是進行式。" },
  { q: "This is the first time I ___ to the new head office.", c: "have been", w: ["went", "was going", "go"],
    e: "This is the first time 後面要用現在完成式 have been；went 是過去式，go 是現在式。" },
  { q: "How long ___ in your current position?", c: "have you worked", w: ["did you work", "are you working", "will you work"],
    e: "問從過去持續到現在的時間要用現在完成式 How long have you worked...；current 表示還在職，不能用過去式。" },
  { q: "Our manager ___ to Japan twice so far this year.", c: "has been", w: ["went", "goes", "was going"],
    e: "so far + 次數要用現在完成式 has been（have been to = 去過）；went 是過去式。" },
  { q: "Please wait a moment; I ___ the file yet.", c: "haven't uploaded", w: ["didn't upload", "don't upload", "wasn't uploading"],
    e: "yet 要求現在完成式，I 的否定是 haven't uploaded；didn't upload 是過去式。" },
  { q: "We ___ in this building since the company was founded.", c: "have worked", w: ["worked", "work", "were working"],
    e: "since 引導過去起點，主句用現在完成式 have worked；worked 是過去式，不能與 since 連用。" },
  { q: "Our team ___ a lot of progress so far this week.", c: "has made", w: ["made", "makes", "is making"],
    e: "so far 要求現在完成式 has made；made 是過去式，makes 是現在簡單式。" },
  { q: "The director ___ just approved the new budget.", c: "has", w: ["have", "did", "does"],
    e: "第三人稱單數的現在完成式用 has + 過去分詞 approved；have 配複數，did/does 後面只能接原形動詞。" },
  { q: "Over the past few months, our team ___ several major clients.", c: "has signed", w: ["signed", "signs", "is signing"],
    e: "over the past few months 表示從過去延續至今，用現在完成式 has signed。" },
  { q: "You ___ the safety training yet?", c: "haven't taken", w: ["didn't take", "don't take", "aren't taking"],
    e: "yet 用於否定句要用現在完成式 haven't taken；didn't take 是過去式，don't take 是現在簡單式。" },
  { q: "The marketing department ___ three new campaigns over the past year.", c: "has launched", w: ["launched", "launches", "is launching"],
    e: "over the past year 表示從過去延續到現在，用現在完成式 has launched；launched 是過去式，launches 是現在簡單式。" }
];
function GENG_l12_perf(){
  const it = GENG_one(GENG_L12_ITEMS);
  return { q: it.q, correct: it.c, wrongs: it.w, e: it.e };
}

/* ============================================================================
   12 課中繼資料（與 index.html 的 GRAMMAR 一一對應；若 GRAMMAR 已載入則沿用
   官方標題，確保 UI 顯示一致）
   ========================================================================== */
const GENG_LESSON_DEF = [
  { id: 1, t: "Be動詞與代名詞" },
  { id: 2, t: "現在簡單式" },
  { id: 3, t: "冠詞 a / an / the" },
  { id: 4, t: "過去簡單式" },
  { id: 5, t: "現在進行式" },
  { id: 6, t: "比較級與最高級" },
  { id: 7, t: "介系詞 in / on / at" },
  { id: 8, t: "主詞動詞一致" },
  { id: 9, t: "不定詞與動名詞" },
  { id: 10, t: "關係代名詞" },
  { id: 11, t: "被動語態" },
  { id: 12, t: "現在完成式" }
];
function GENG_lessons(){
  const live = (typeof GRAMMAR !== "undefined" && Array.isArray(GRAMMAR)) ? GRAMMAR : null;
  return GENG_LESSON_DEF.map(function(d){
    const g = live && live[d.id - 1];
    return { id: d.id, t: (g && g.t) ? g.t : d.t, icon: (g && g.icon) ? g.icon : "🎲" };
  });
}

/* 每課的生成器（可重複呼叫，隨機槽位組合出全新題目） */
const GENG_BUILDERS = {
  "1": [GENG_l1_state, GENG_l1_question, GENG_l1_pron],
  "2": [GENG_l2_statement, GENG_l2_do],
  "3": [GENG_l3_article],
  "4": [GENG_l4_statement, GENG_l4_did],
  "5": [GENG_l5_statement, GENG_l5_signal],
  "6": [GENG_l6_compare, GENG_l6_super],
  "7": [GENG_l7_prep],
  "8": [GENG_l8_agree],
  "9": [GENG_l9_pattern],
  "10": [GENG_l10_rel],
  "11": [GENG_l11_passive],
  "12": [GENG_l12_perf]
};
const GENG_IDS = GENG_LESSON_DEF.map(function(d){ return String(d.id); });

/* ======================= 重複控管 ======================= */
const GENG_RECENT_MAX = 40;
const GENG_RECENT = {};  /* key -> 近期題幹字串 */
const GENG_LAST = {};    /* key -> 上一批題幹（用來保證連續兩批不同） */

function GENG_sameBatch(a, b){
  if(!a || !b || a.length !== b.length || !a.length)return false;
  const sa = new Set(a), sb = new Set(b);
  if(sa.size !== sb.size)return false;
  let same = 0;
  sa.forEach(function(x){ if(sb.has(x))same++; });
  return same === sa.size;
}

/* ======================= 核心：產生 n 題 ======================= */
function GENG_generate(key, n, opts){
  opts = opts || {};
  const fns = GENG_BUILDERS[key];
  if(!fns || !fns.length)return [];
  n = Math.max(0, Math.min(60, parseInt(n, 10) || 0));
  if(!n)return [];
  const forbid = (opts.forbid instanceof Set) ? opts.forbid : null;
  const recent = GENG_RECENT[key] || [];
  const out = [], seen = new Set();
  let tries = 0, relaxed = false;
  while(out.length < n && tries < n * 60){
    tries++;
    if(!relaxed && tries > n * 20)relaxed = true;  /* 近期題用完才放寬 */
    let spec = null;
    try{ spec = GENG_one(fns)(); }catch(e){ continue; }
    const q = GENG_build(spec);
    if(!q)continue;
    if(seen.has(q.q))continue;
    if(forbid && forbid.has(q.q))continue;
    if(!relaxed && recent.indexOf(q.q) >= 0)continue;
    out.push(q); seen.add(q.q);
    GENG_STATS.total++;
  }
  if(out.length){
    GENG_STATS.batches++;
    const rec = (GENG_RECENT[key] || []).slice();
    out.forEach(function(q){ rec.push(q.q); });
    GENG_RECENT[key] = rec.slice(-GENG_RECENT_MAX);
    if(!opts.noLast)GENG_LAST[key] = out.map(function(q){ return q.q; });
    GENG_STATS.byLesson[key] = (GENG_STATS.byLesson[key] || 0) + out.length;
  }
  return out;
}

/* ======================= 對外 API ======================= */
const GENG_NOTICE = "🎲 隨機新題 · 依多益出題邏輯原創生成（非歷屆試題）";

function GENG_gen(lessonId, n){
  const key = String(lessonId);
  if(!GENG_BUILDERS[key]){
    GENG_toast("找不到第 " + lessonId + " 課的文法產生器", "⚠️");
    return [];
  }
  n = (n == null) ? 10 : parseInt(n, 10);
  if(!(n > 0))n = 10;
  const prev = GENG_LAST[key] ? GENG_LAST[key].slice() : null;  /* 上一批題幹 */
  let out = GENG_generate(key, n, {});
  /* 硬性保證：連續兩批題目不完全相同 */
  if(GENG_sameBatch(out.map(function(q){ return q.q; }), prev)){
    out = GENG_generate(key, n, {});
  }
  return out;
}
function GENG_lessonQuestions(lessonId){ return GENG_gen(lessonId, 10); }

function GENG_exam(n){
  n = (n == null) ? 10 : parseInt(n, 10);
  if(!(n > 0))n = 10;
  n = Math.min(n, 200);
  const out = [], seen = new Set();
  const order = GENG_sh(GENG_IDS);
  let i = 0, guard = 0, lenient = false;
  while(out.length < n && guard < n * 80){
    guard++;
    const key = order[i % order.length]; i++;
    let arr = GENG_generate(key, 1, { forbid: seen, noLast: true });
    if(!arr.length && lenient){
      /* 極端情況：放開唯一性，改用近期題填補 */
      arr = GENG_generate(key, 1, { forbid: null, noLast: true });
    }
    if(arr.length){
      const q = arr[0];
      if(!seen.has(q.q) || lenient){
        out.push(q); seen.add(q.q);
      }
    }
    if(!lenient && guard > n * 40)lenient = true;
  }
  return out;
}
function GENG_stats(){
  const by = {};
  Object.keys(GENG_STATS.byLesson).forEach(function(k){ by[k] = GENG_STATS.byLesson[k]; });
  return {
    total: GENG_STATS.total,
    invalid: GENG_STATS.invalid,
    batches: GENG_STATS.batches,
    byLesson: by,
    pools: GENG_IDS.length,
    started: GENG_STATS.started,
    ageMs: Date.now() - GENG_STATS.started
  };
}

/* ======================= 匯出（唯一對外出口 window.GENG_*） ======================= */
function GENG_export(){
  const root = (typeof window !== "undefined") ? window
             : ((typeof globalThis !== "undefined") ? globalThis : null);
  if(!root)return;
  root.GENG_gen = GENG_gen;
  root.GENG_validate = GENG_validate;
  root.GENG_lessonQuestions = GENG_lessonQuestions;
  root.GENG_exam = GENG_exam;
  root.GENG_stats = GENG_stats;
  root.GENG_lessons = GENG_lessons;
  root.GENG_NOTICE = GENG_NOTICE;
}
GENG_export();

/* ======================= 樣式注入（防呆：不重複插入） ======================= */
function GENG_injectCSS(){
  if(typeof document === "undefined")return;      /* node 測試環境：直接略過 */
  if(!document.createElement)return;
  if(document.getElementById("geng-css"))return;  /* 已注入過 */
  if(typeof GENG_CSS !== "string" || !GENG_CSS.trim())return;
  const st = document.createElement("style");
  st.id = "geng-css";
  st.textContent = GENG_CSS;
  (document.head || document.documentElement).appendChild(st);
}
GENG_injectCSS();
