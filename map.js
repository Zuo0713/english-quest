"use strict";
/* =======================================================================
   map.js — 領地地圖（知識王式領地開拓）模組
   ---------------------------------------------------------------------
   * 全域識別字一律 MAP_ 前綴；匯出 window.MAP_open（多益領地地圖）、
     window.MAP_gopen（文法地圖：知識王式分區分難度，入口在文法迷宮畫面）
   * 兩種模式 MAP_MODE = "toeic" | "grammar"：
     - 地區表分開（MAP_REGIONS / MAP_GREGIONS）、題庫池分開（MAP_POOLS / MAP_GPOOLS）、
       解鎖用的「整體正確率」分開（多益 = S.correct/S.total，文法 = 文法各區合計）
     - 存檔欄位共用 S.map / S.regionStat / S.mapClaim，以地區 id 區隔
       （文法地區 id 一律 g 開頭，不會與多益 8 區衝突）
   * 依賴 index.html 的全域輔助（$ esc toast S save go pick shuffle speak
     confetti gainStats level renderHome levelUp），全部防禦式呼叫，
     任何一個不存在都不會讓本檔崩掉。
   * 對 S 的新欄位（gems / map / regionStat / mapClaim）一律防禦性初始化，
     舊存檔沒有這些欄位也能正常運作。
   ======================================================================= */

/* ======================= CSS（自帶 .map-* 前綴） ======================= */
const MAP_CSS=`
/* ===== 領地地圖：貨幣列 ===== */
.map-currency{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:13px}
.map-chip-gem{border-color:rgba(236,72,153,.45);color:#f9a8d4}
.map-chip-gem b{color:#f9a8d4}

/* ===== 領地地圖：規則說明 ===== */
.map-rule{background:var(--card);border:1px dashed rgba(167,139,250,.55);border-radius:14px;
  padding:12px 14px;margin-bottom:14px;font-size:12.5px;color:var(--text2);line-height:1.75}
.map-rule .mr-t{font-weight:800;color:var(--pri2);font-size:13.5px;margin-bottom:5px;display:flex;align-items:center;gap:6px}
.map-th-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.map-th-chip{background:rgba(124,58,237,.2);border:1px solid rgba(167,139,250,.4);color:#ddd6fe;
  border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700}
.map-th-chip.on{background:linear-gradient(135deg,var(--green),var(--green2));border-color:transparent;color:#052e1e}
.map-th-chip.off{opacity:.5}

/* ===== 領地地圖：整體正確率 ===== */
.map-gacc{background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:14px;
  padding:12px 14px;margin-bottom:14px}
.map-gacc-top{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;
  color:var(--text2);margin-bottom:8px;gap:8px}
.map-gacc-top b{color:var(--amber2);font-size:16px}
.map-bar{height:12px;background:rgba(255,255,255,.1);border-radius:6px;overflow:hidden}
.map-bar-fill{height:100%;background:linear-gradient(90deg,var(--blue),var(--green2));
  border-radius:6px;transition:width .5s}

/* ===== 領地地圖：地區卡片 ===== */
.map-regions{display:flex;flex-direction:column;gap:12px}
.map-card{background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius);
  padding:14px;cursor:pointer;transition:.25s;animation:slideUp .35s backwards;color:var(--text);
  text-align:left;font-family:inherit;width:100%}
.map-card:hover{background:var(--card2);transform:translateY(-3px);border-color:rgba(255,255,255,.25)}
.map-card:active{transform:scale(.99)}
.map-card.locked{opacity:.74;filter:grayscale(.7)}
.map-card.locked:hover{transform:none}
.map-card.done{border-color:rgba(16,185,129,.5);box-shadow:0 0 14px rgba(16,185,129,.22)}
.map-top{display:flex;align-items:center;gap:11px}
.map-emoji{font-size:32px;flex-shrink:0}
.map-info{flex:1;min-width:0}
.map-name{font-weight:800;font-size:15.5px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.map-en{font-size:10.5px;font-weight:600;color:var(--text2);background:rgba(255,255,255,.08);
  padding:2px 7px;border-radius:7px}
.map-theme{font-size:11.5px;color:var(--text2);margin-top:3px}
.map-stars{font-size:12.5px;letter-spacing:1.5px;color:var(--amber2);margin-top:5px;
  display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.map-stars .off{opacity:.3;filter:grayscale(1)}
.map-star-lv{font-size:11px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.45);
  color:var(--amber2);border-radius:8px;padding:1px 7px;font-weight:700;letter-spacing:0}
.map-pct{font-size:19px;font-weight:900;color:var(--green2);flex-shrink:0;text-align:right;line-height:1.15}
.map-pct small{display:block;font-size:10px;font-weight:600;color:var(--text2);letter-spacing:0}
.map-pct.full{color:var(--amber2)}

/* ===== 領地地圖：土地格網 ===== */
.map-tiles{display:grid;gap:4px;margin-top:11px}
.map-tile{aspect-ratio:1/1;border-radius:6px;background:rgba(126,96,55,.3);
  border:1px dashed rgba(255,255,255,.24);display:flex;align-items:center;justify-content:center;
  font-size:13px;color:rgba(255,255,255,.4);transition:.2s;min-height:26px}
.map-tile.open{background:linear-gradient(150deg,rgba(16,185,129,.45),rgba(52,211,153,.2));
  border:1px solid rgba(52,211,153,.65);color:#fff;box-shadow:0 0 7px rgba(16,185,129,.32);
  animation:pop .3s backwards}
.map-meta{display:flex;gap:7px;flex-wrap:wrap;font-size:11.5px;color:var(--text2);margin-top:10px}
.map-meta span{background:rgba(255,255,255,.07);border-radius:8px;padding:3px 8px}
.map-meta b{color:var(--green2)}
.map-meta .gem{color:#f9a8d4}
.map-actions{display:flex;gap:9px;margin-top:11px}
.map-actions .btn-main,.map-actions .btn-sec{padding:12px 8px;font-size:14px}
.map-lock-note{margin-top:11px;background:rgba(239,68,68,.13);border:1px solid rgba(248,113,113,.42);
  color:#fca5a5;border-radius:11px;padding:10px 12px;font-size:12.5px;line-height:1.65}
.map-lock-note b{color:#fecaca}
.map-done-note{margin-top:11px;background:rgba(16,185,129,.15);border:1px solid rgba(52,211,153,.42);
  color:#6ee7b7;border-radius:11px;padding:10px 12px;font-size:12.5px;line-height:1.65}

/* ===== 領地地圖：圖例 ===== */
.map-legend{display:flex;gap:14px;justify-content:center;font-size:11.5px;color:var(--text2);
  margin-top:11px;flex-wrap:wrap}
.map-legend i{font-style:normal;display:inline-flex;align-items:center;gap:5px}
.map-legend .lg-wild{width:13px;height:13px;border-radius:4px;background:rgba(126,96,55,.3);
  border:1px dashed rgba(255,255,255,.3);display:inline-block}
.map-legend .lg-open{width:13px;height:13px;border-radius:4px;
  background:linear-gradient(150deg,var(--green),var(--green2));display:inline-block}

/* ===== 領地地圖：地區詳情 ===== */
.map-detail-head{display:flex;align-items:center;gap:12px;background:var(--card);
  border:1px solid rgba(255,255,255,.1);border-radius:var(--radius);padding:14px;margin-bottom:13px}
.map-detail-emoji{font-size:42px;flex-shrink:0}
.map-big-tiles{display:grid;gap:6px;margin-bottom:13px;background:rgba(0,0,0,.16);
  border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px}
.map-big-tile{aspect-ratio:1/1;border-radius:9px;background:rgba(126,96,55,.3);
  border:1px dashed rgba(255,255,255,.24);display:flex;align-items:center;justify-content:center;
  font-size:17px;color:rgba(255,255,255,.4);transition:.2s}
.map-big-tile.open{background:linear-gradient(150deg,rgba(16,185,129,.5),rgba(52,211,153,.24));
  border:1px solid rgba(52,211,153,.7);color:#fff;box-shadow:0 0 9px rgba(16,185,129,.35);
  animation:pop .3s backwards}
.map-reward-box{background:var(--card);border:1px solid rgba(245,158,11,.35);border-radius:14px;
  padding:12px 14px;font-size:12.5px;color:var(--text2);line-height:1.85;margin-bottom:13px}
.map-reward-box b{color:var(--amber2)}

/* ===== 領地地圖：開拓中 ===== */
.map-play-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.map-land-chip{background:rgba(16,185,129,.16);border:1px solid rgba(52,211,153,.45);
  color:#6ee7b7;border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;white-space:nowrap}
.map-land-chip.full{background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.5);color:var(--amber2)}
.map-mini-tiles{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px}
.map-mini-tile{width:14px;height:14px;border-radius:4px;background:rgba(126,96,55,.35);
  border:1px solid rgba(255,255,255,.2)}
.map-mini-tile.open{background:linear-gradient(150deg,var(--green),var(--green2));border-color:transparent;
  box-shadow:0 0 6px rgba(16,185,129,.5)}
.map-run-note{font-size:12px;color:var(--text2);text-align:center;margin-top:10px;line-height:1.6}

/* ===== 領地地圖：AI 對戰 ===== */
.map-ai-tag{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:8px;
  background:rgba(239,68,68,.2);color:#fca5a5;margin-top:6px}
.map-ai-tag.ok{background:rgba(16,185,129,.2);color:var(--green2)}
.map-result-note{background:rgba(255,255,255,.06);border-radius:12px;padding:11px 13px;
  font-size:12.5px;color:var(--text2);line-height:1.75;margin-top:12px;text-align:left}
.map-result-note b{color:var(--amber2)}
`;

/* ======================= 遊戲資料 ======================= */
const MAP_MIN_Q=15;          /* 每區最少題數 */
const MAP_RUN_N=10;          /* 一次開拓出題數 */
const MAP_BATTLE_N=20;       /* AI 對戰題數 */
const MAP_DMG=5;             /* 答錯扣自己 5 HP */
const MAP_UNLOCK=[0,.40,.55,.70,.85];                 /* 難度 1-5 解鎖門檻（整體正確率） */
const MAP_AI_ACC={1:.45,2:.55,3:.65,4:.75,5:.85};      /* 難度 → AI 正確率 */
const MAP_GEM_CLEAR=[0,3,5,7,10];                      /* 整區 100% 開拓寶石（依難度） */
const MAP_BATTLE_GEM=[0,2,4,6,8];                      /* 對戰勝利寶石（依難度） */
const MAP_TILE_EMOJI=["🏠","🌳","🌾","🏡","🌱","💧"];

const MAP_REGIONS=[
  {id:"biz",name:"商務區",en:"Business District",icon:"🏢",theme:"Office & Business",
   cols:5,rows:4,
   kws:["meeting","meetings","office","report","reports","employee","employees","company","business",
        "client","clients","marketing","sales","manager","interview","resume","hire","hired","staff",
        "department","corporate","conference","presentation","contract","supplier","purchase","orders",
        "personnel","colleagues","supervisor","deadline","memo","agenda","orientation","training",
        "workplace","quarterly","campaign","applicant","vacancy","workforce","employer"]},
  {id:"travel",name:"旅遊區",en:"Travel Zone",icon:"✈️",theme:"Travel & Transport",
   cols:4,rows:3,
   kws:["flight","flights","airport","hotel","luggage","passenger","passengers","passport","boarding",
        "airline","train","tour","travel","traveler","reservation","destination","gate","trip","vacation",
        "departure","arrival","itinerary","cruise","ticket","tickets","suitcase","visa","ferry","terminal",
        "luggage","tourist","journey","abroad","overseas"]},
  {id:"life",name:"生活區",en:"Daily Life",icon:"🛒",theme:"Everyday & Lifestyle",
   cols:5,rows:4,
   kws:["grocery","groceries","restaurant","laundry","apartment","rent","neighbor","parking","store",
        "shopping","delivery","recipe","meal","dinner","pet","garden","electricity","repair","maintenance",
        "customer","checkout","supermarket","mall","cleaning","landlord","lease","tenant","household",
        "furniture","bicycle","umbrella","menu","waiter","cashier","return","exchange","kitchen","chef",
        "vegetables","car","mechanic","engine","family","children","home","house","street","park","weather"]},
  {id:"campus",name:"校園區",en:"Campus",icon:"🎓",theme:"School & Education",
   cols:4,rows:3,
   kws:["student","students","university","school","class","classes","semester","professor","campus",
        "homework","exam","course","library","lecture","dormitory","tuition","enrollment","workshop",
        "seminar","education","academic","scholarship","graduate","registration","textbook","assignment",
        "tutor","classroom","degree","teacher","pupil","orientation","training","seminar"]},
  {id:"medical",name:"醫療區",en:"Medical Center",icon:"🏥",theme:"Health & Medical",
   cols:4,rows:3,
   kws:["doctor","doctors","patient","patients","hospital","medical","clinic","dentist","medicine",
        "prescription","symptom","symptoms","surgery","nurse","health","therapy","allergy","fever",
        "injury","injured","wellness","dental","checkup","ambulance","pharmacy","recovery","diagnosis",
        "chronic","mental","treatment","physical","doctor"]},
  {id:"finance",name:"金融區",en:"Finance Hub",icon:"🏦",theme:"Banking & Money",
   cols:5,rows:4,
   kws:["bank","banks","loan","loans","credit","interest","mortgage","investment","investor","stock",
        "stocks","financial","finance","budget","invoice","payment","payments","tax","taxes","accounting",
        "revenue","profit","expense","expenses","transaction","account","salary","wages","cost","price",
        "prices","billing","audit","currency","deposit","withdrawal","shareholder","dividend","refund",
        "fee","fees","economy","economic","million","billion"]},
  {id:"tech",name:"科技區",en:"Tech Park",icon:"💻",theme:"Technology & IT",
   cols:5,rows:4,
   kws:["software","computer","computers","website","network","system","systems","server","application",
        "update","data","digital","technology","device","devices","program","programs","email","online",
        "internet","security","cyber","robot","engineering","technical","machine","printer","database",
        "cloud","apps","download","browser","password","wireless","battery","screen","keyboard","coding",
        "developer","platform","encryption","virus","malware","tech","program"]},
  {id:"news",name:"新聞區",en:"News Room",icon:"📰",theme:"News & Public Affairs",
   cols:4,rows:3,
   kws:["announcement","announce","announced","notice","newspaper","article","reporter","journalist",
        "according","officials","government","council","community","survey","study","research","storm",
        "construction","renovation","population","reported","yesterday","residents","statement","press",
        "weekly","monthly","headline","festival","election","weather","city","local","published","editor"]}
];

/* 文法地圖：6 個文法地區（知識王式分區分難度），lessons = GRAMMAR 的課 id
   題庫來源：content-grammar.js 的 GRAM_Q（12 課 × 50 題 = 600 題） */
const MAP_GREGIONS=[
  {id:"gbasic",name:"基礎區",en:"Grammar Basics",icon:"🔵",theme:"Be動詞・現在簡單式",cols:4,rows:3,lessons:[1,2]},
  {id:"gword",name:"字詞區",en:"Articles & Prepositions",icon:"🟡",theme:"冠詞・介系詞",cols:4,rows:3,lessons:[3,7]},
  {id:"gtense",name:"時態區",en:"Tenses",icon:"⏰",theme:"過去式・進行式・完成式",cols:5,rows:3,lessons:[4,5,12]},
  {id:"gagree",name:"一致比較區",en:"Agreement & Comparison",icon:"📊",theme:"主詞動詞一致・比較級",cols:4,rows:3,lessons:[6,8]},
  {id:"gclause",name:"子句區",en:"Clauses & Verb Patterns",icon:"🔗",theme:"不定詞與動名詞・關係代名詞",cols:4,rows:3,lessons:[9,10]},
  {id:"gvoice",name:"語態區",en:"Passive Voice",icon:"🛡️",theme:"被動語態",cols:4,rows:3,lessons:[11]}
];

/* 題型 → 地區的基礎配分（關鍵字沒命中時依題型分配，符合「聽力→旅遊/校園、
   Part5/6 文法→商務/科技、Part7 長文→新聞/金融」的方向） */
const MAP_PART_BONUS={
  "Part 1":{life:3,travel:2,campus:1,biz:1},
  "Part 2":{life:2,travel:2,campus:2,biz:2,medical:1,finance:1,tech:1},
  "Part 3":{biz:2,travel:2,life:1,campus:1,medical:1,finance:1,tech:1,news:1},
  "Part 4":{travel:3,news:2,biz:1,campus:1,medical:1,finance:1,tech:1,life:1},
  "Part 5":{biz:3,tech:3,finance:2,life:1,campus:1,medical:1,news:1,travel:1},
  "Part 6":{biz:3,tech:3,finance:2,news:2,life:1,campus:1,medical:1,travel:1},
  "Part 7":{news:3,finance:3,biz:2,life:2,campus:2,medical:2,tech:2,travel:2}
};

let MAP_STATE=null;   /* 目前畫面狀態 {view,rid,qs,i,right,...} */
let MAP_POOLS=null;   /* 多益各地區題庫（懶建構） */
let MAP_GPOOLS=null;  /* 文法各地區題庫（懶建構） */
let MAP_MODE="toeic"; /* 目前模式："toeic" 多益領地地圖 | "grammar" 文法地圖 */

/* ======================= 防禦式全域呼叫 ======================= */
function MAP_el(id){
  try{ if(typeof $==="function")return $(id); }catch(e){}
  try{ return document.getElementById(id); }catch(e){ return null; }
}
function MAP_esc(s){
  try{ if(typeof esc==="function")return esc(s); }catch(e){}
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function MAP_toast(msg,emoji){
  try{ if(typeof toast==="function"){ toast(msg,emoji); return; } }catch(e){}
  try{
    const t=MAP_el("toast");
    if(t){ t.textContent=(emoji?emoji+" ":"")+msg; t.classList.add("show");
      setTimeout(function(){ t.classList.remove("show"); },2400); }
  }catch(e){}
}
function MAP_save(){ try{ if(typeof save==="function")save(); }catch(e){} }
function MAP_go(id){
  try{ if(typeof go==="function"){ go(id); return; } }catch(e){}
  try{
    const all=document.querySelectorAll(".screen");
    for(let i=0;i<all.length;i++)all[i].classList.remove("active");
    const t=MAP_el(id);
    if(t)t.classList.add("active");
  }catch(e){}
}
function MAP_confetti(n){ try{ if(typeof confetti==="function")confetti(n); }catch(e){} }
function MAP_speak(t){ try{ if(typeof speak==="function")speak(t); }catch(e){} }
function MAP_level(){ try{ if(typeof level==="function")return level(); }catch(e){} return 1; }
function MAP_gain(ok){
  try{ if(typeof gainStats==="function"){ gainStats(ok); return; } }catch(e){}
  const s=MAP_initState(); if(!s)return;
  s.total=(Number(s.total)||0)+1;
  if(ok)s.correct=(Number(s.correct)||0)+1;
  MAP_save();
}
/* 金幣 + XP（含升級檢查），全部防禦式 */
function MAP_reward(coins,xp){
  const s=MAP_initState(); if(!s)return;
  let before=1;
  try{ if(typeof level==="function")before=level(); }catch(e){}
  s.coins=(Number(s.coins)||0)+coins;
  s.xp=(Number(s.xp)||0)+xp;
  MAP_save();
  try{ if(typeof renderHome==="function")renderHome(); }catch(e){}
  try{
    if(typeof level==="function"&&typeof levelUp==="function"){
      const after=level();
      if(after>before)levelUp(after);
    }
  }catch(e){}
}
function MAP_addGems(n){
  const s=MAP_initState(); if(!s||!n)return 0;
  s.gems=(Number(s.gems)||0)+n;
  MAP_save();
  return s.gems;
}

/* ======================= S 新欄位：防禦性初始化 ======================= */
function MAP_stateObj(){
  try{ if(typeof S!=="undefined"&&S&&typeof S==="object")return S; }catch(e){}
  return null;
}
function MAP_initState(){
  const s=MAP_stateObj(); if(!s)return null;
  if(typeof s.gems!=="number"||!isFinite(s.gems)||s.gems<0){
    const n=Number(s.gems); s.gems=(isFinite(n)&&n>=0)?n:0;   /* 舊存檔字串數字 → 轉換 */
  }
  if(!s.map||typeof s.map!=="object"||Array.isArray(s.map))s.map={};
  if(!s.regionStat||typeof s.regionStat!=="object"||Array.isArray(s.regionStat))s.regionStat={};
  if(!s.mapClaim||typeof s.mapClaim!=="object"||Array.isArray(s.mapClaim))s.mapClaim={};
  ["correct","total","coins","xp"].forEach(function(k){
    if(typeof s[k]!=="number"||!isFinite(s[k])||s[k]<0){
      const n=Number(s[k]); s[k]=(isFinite(n)&&n>=0)?n:0;      /* 舊存檔字串數字 → 轉換，垃圾值 → 0 */
    }
  });
  const ALL=MAP_allRegs();
  for(let i=0;i<ALL.length;i++){
    const rid=ALL[i].id, size=MAP_tiles(rid);
    if(!Array.isArray(s.map[rid])){
      s.map[rid]=[];
    }else{
      const seen={}, out=[];
      for(let j=0;j<s.map[rid].length;j++){
        const v=s.map[rid][j];
        if(typeof v==="number"&&isFinite(v)&&v>=0&&v<size&&!seen[v]){ seen[v]=1; out.push(v); }
      }
      out.sort(function(a,b){return a-b});
      s.map[rid]=out;
    }
    const st=s.regionStat[rid];
    if(!st||typeof st!=="object"||Array.isArray(st)||
       typeof st.right!=="number"||typeof st.total!=="number"||
       !isFinite(st.right)||!isFinite(st.total)||st.right<0||st.total<0||st.right>st.total){
      s.regionStat[rid]={right:0,total:0};
    }
  }
  return s;
}

/* ======================= 地區 / 難度 / 解鎖 ======================= */
function MAP_regs(){ return MAP_isG()?MAP_GREGIONS.slice():MAP_REGIONS.slice(); }
function MAP_allRegs(){ return MAP_REGIONS.concat(MAP_GREGIONS); }
function MAP_isG(){ return MAP_MODE==="grammar"; }
function MAP_isGReg(rid){
  if(typeof rid!=="string"||!rid)return false;
  for(let i=0;i<MAP_GREGIONS.length;i++)if(MAP_GREGIONS[i].id===rid)return true;
  return false;
}
/* 目前模式的「整體正確率」分子/分母：多益 = S.correct/S.total，文法 = 文法各區合計 */
function MAP_modeStat(){
  const s=MAP_initState();
  if(!s)return {right:0,total:0};
  if(MAP_isG()){
    let r=0,t=0;
    for(let i=0;i<MAP_GREGIONS.length;i++){
      const st=s.regionStat[MAP_GREGIONS[i].id];
      if(st){ r+=Number(st.right)||0; t+=Number(st.total)||0; }
    }
    return {right:r,total:t};
  }
  return {right:Number(s.correct)||0,total:Number(s.total)||0};
}
function MAP_reg(rid){
  const a=MAP_isG()?MAP_GREGIONS:MAP_REGIONS, b=MAP_isG()?MAP_REGIONS:MAP_GREGIONS;
  for(let i=0;i<a.length;i++)if(a[i].id===rid)return a[i];
  for(let i=0;i<b.length;i++)if(b[i].id===rid)return b[i];
  return null;
}
/* 行內 onclick 字串（依模式切換入口函式） */
function MAP_listFn(){ return MAP_isG()?"MAP_gopen()":"MAP_open()"; }
function MAP_regFn(rid){ return (MAP_isG()?"MAP_gopen('":"MAP_open('")+rid+"')"; }
function MAP_tiles(rid){
  const r=MAP_reg(rid);
  if(!r)return 0;
  const c=Math.max(1,Math.floor(r.cols||0)), w=Math.max(1,Math.floor(r.rows||0));
  return c*w;
}
/* 該地區歷史答對率（right/total），沒有資料回 0，並防禦性建立結構 */
function MAP_regionAcc(rid){
  const s=MAP_initState(); if(!s)return 0;
  const st=s.regionStat[rid];
  if(!st||!st.total)return 0;
  const a=st.right/st.total;
  if(!isFinite(a))return 0;
  return Math.max(0,Math.min(1,a));
}
/* 難度 1-5：完全由「該區歷史正確率」分級 */
function MAP_diff(rid){
  const acc=MAP_regionAcc(rid);
  if(acc>=.85)return 5;
  if(acc>=.70)return 4;
  if(acc>=.55)return 3;
  if(acc>=.40)return 2;
  return 1;
}
function MAP_unlockNeed(diff){
  let d=Math.floor(Number(diff)||1);
  if(d<1)d=1;
  if(d>5)d=5;
  return MAP_UNLOCK[d-1];
}
function MAP_globalAcc(){
  const m=MAP_modeStat();
  if(m.total<=0)return 0;
  return Math.max(0,Math.min(1,m.right/m.total));
}
function MAP_isUnlocked(rid){
  if(!MAP_reg(rid))return false;
  return MAP_globalAcc()+1e-9>=MAP_unlockNeed(MAP_diff(rid));
}
function MAP_aiAcc(diff){
  let d=Math.floor(Number(diff)||1);
  if(d<1)d=1;
  if(d>5)d=5;
  return MAP_AI_ACC[d];
}
function MAP_gemClear(diff){
  let d=Math.floor(Number(diff)||1);
  if(d<1)d=1;
  if(d>5)d=5;
  return MAP_GEM_CLEAR[d];
}
function MAP_gemBattle(diff){
  let d=Math.floor(Number(diff)||1);
  if(d<1)d=1;
  if(d>5)d=5;
  return MAP_BATTLE_GEM[d];
}
/* 已開拓格（防禦式） */
function MAP_opened(rid){
  const s=MAP_initState();
  if(!s)return [];
  return (s.map[rid]||[]).slice();
}
function MAP_openCount(rid){ return MAP_opened(rid).length; }
function MAP_progress(rid){
  const t=MAP_tiles(rid);
  if(!t)return 0;
  return Math.max(0,Math.min(1,MAP_openCount(rid)/t));
}
function MAP_isDone(rid){ return MAP_openCount(rid)>=MAP_tiles(rid); }

/* 開拓一格：回傳 {opened,done,gems}（整區完成才發寶石，且只發一次） */
function MAP_claimTile(rid){
  const s=MAP_initState();
  const res={opened:false,done:false,gems:0};
  if(!s||!MAP_reg(rid))return res;
  const size=MAP_tiles(rid);
  const arr=s.map[rid]||[];
  if(arr.length>=size){ res.done=true; return res; }
  const used={};
  for(let i=0;i<arr.length;i++)used[arr[i]]=1;
  let idx=0;
  while(idx<size&&used[idx])idx++;
  if(idx>=size){ res.done=true; return res; }
  arr.push(idx);
  arr.sort(function(a,b){return a-b});
  s.map[rid]=arr;
  res.opened=true;
  if(arr.length>=size&&!s.mapClaim[rid]){
    s.mapClaim[rid]=true;
    res.gems=MAP_gemClear(MAP_diff(rid));
    if(res.gems>0){ s.gems=(Number(s.gems)||0)+res.gems; MAP_save(); }
    res.done=true;
  }
  return res;
}

/* 記錄該區答題歷史（同時更新整體 S.correct/S.total） */
function MAP_record(rid,ok){
  const s=MAP_initState(); if(!s)return;
  if(MAP_reg(rid)){
    const st=s.regionStat[rid];
    st.total=(Number(st.total)||0)+1;
    if(ok)st.right=(Number(st.right)||0)+1;
  }
  MAP_gain(!!ok);
  MAP_save();
}
/* ======================= 題庫：合併池 → 分區 ======================= */
function MAP_allQ(){
  const out=[];
  function add(a){
    if(!Array.isArray(a))return;
    for(let i=0;i<a.length;i++)if(a[i]&&typeof a[i]==="object")out.push(a[i]);
  }
  try{ add(typeof TOEIC_Q!=="undefined"?TOEIC_Q:null); }catch(e){}
  try{ add(typeof MOCK_BANK!=="undefined"&&MOCK_BANK?MOCK_BANK.listen:null); }catch(e){}
  try{ add(typeof MOCK_BANK!=="undefined"&&MOCK_BANK?MOCK_BANK.read:null); }catch(e){}
  try{ add(typeof MOCK_EXTRA!=="undefined"&&MOCK_EXTRA?MOCK_EXTRA.listen:null); }catch(e){}
  try{ add(typeof MOCK_EXTRA!=="undefined"&&MOCK_EXTRA?MOCK_EXTRA.read:null); }catch(e){}
  return out;
}
function MAP_shuffle(a){
  try{ if(typeof shuffle==="function")return shuffle(a); }catch(e){}
  const b=a.slice();
  for(let i=b.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1)), t=b[i]; b[i]=b[j]; b[j]=t;
  }
  return b;
}
function MAP_pick(a,n){
  try{ if(typeof pick==="function")return pick(a,n); }catch(e){}
  return MAP_shuffle(a).slice(0,n);
}
/* 取 n 題；題目不足時重複洗牌補滿（保證 AI 對戰拿得到 20 題） */
function MAP_pickN(a,n){
  if(!Array.isArray(a)||!a.length||n<=0)return [];
  if(a.length>=n)return MAP_pick(a,n);
  const out=[];
  let guard=0;
  while(out.length<n&&guard<10000){
    const s=MAP_shuffle(a);
    for(let i=0;i<s.length&&out.length<n;i++)out.push(s[i]);
    guard++;
  }
  return out;
}
function MAP_hay(q){
  return ((q.q||"")+" "+(q.passage||"")+" "+(q.audio||"")+" "+(q.zh||"")+" "+(q.part||"")).toLowerCase();
}
function MAP_kwRe(r){
  if(r._re)return r._re;
  const ks=(r.kws||[]).filter(function(k){return typeof k==="string"&&k});
  r._re=ks.length?new RegExp("\\b(?:"+ks.join("|")+")\\b","i"):null;
  return r._re;
}
/* 依「關鍵字 + 題型配分」給每區打分，最高分者勝出（同分取排序在前者） */
function MAP_classify(q){
  const h=MAP_hay(q);
  const bonus=MAP_PART_BONUS[q.part]||{};
  let best=null, bestScore=0;
  for(let i=0;i<MAP_REGIONS.length;i++){
    const r=MAP_REGIONS[i];
    let score=bonus[r.id]||0;
    const re=MAP_kwRe(r);
    if(re){
      re.lastIndex=0;
      const m=h.match(re);
      if(m)score+=m.length*3;
    }
    if(score>bestScore){ bestScore=score; best=r.id; }
  }
  return bestScore>0?best:null;
}
/* 建構每區題庫：先分類，零分題丟給最小的區，再補到每區 >= MAP_MIN_Q */
function MAP_buildPools(){
  const all=MAP_allQ();
  const buckets={};
  for(let i=0;i<MAP_REGIONS.length;i++)buckets[MAP_REGIONS[i].id]=[];
  const rest=[];
  for(let i=0;i<all.length;i++){
    const rid=MAP_classify(all[i]);
    if(rid&&buckets[rid])buckets[rid].push(all[i]);
    else rest.push(all[i]);
  }
  /* 零分題 → 依序塞進目前最小的區（維持平均） */
  for(let i=0;i<rest.length;i++){
    let target=null;
    for(let j=0;j<MAP_REGIONS.length;j++){
      const id=MAP_REGIONS[j].id;
      if(!target||buckets[id].length<buckets[target].length)target=id;
    }
    if(target)buckets[target].push(rest[i]);
  }
  /* 不足 MAP_MIN_Q 的區，從最大的區借題（每題只會出現在一區） */
  for(let guard=0;guard<10000;guard++){
    let small=null,big=null;
    for(let j=0;j<MAP_REGIONS.length;j++){
      const id=MAP_REGIONS[j].id, len=buckets[id].length;
      if(len<MAP_MIN_Q&&!small)small=id;
      if(!big||len>buckets[big].length)big=id;
    }
    if(!small)break;
    if(!big||buckets[big].length<=MAP_MIN_Q)break;
    buckets[small].push(buckets[big].pop());
  }
  return buckets;
}
/* 文法題庫：把 GRAMMAR 各課的題目（content-grammar.js 的 GRAM_Q，每課 50 題）
   轉成地圖題目格式 {q,o,a,t:"gram",part:課名,lesson,why,zh} */
function MAP_grammarAllQ(){
  const out=[];
  try{
    if(typeof GRAMMAR!=="undefined"&&Array.isArray(GRAMMAR)){
      for(let i=0;i<GRAMMAR.length;i++){
        const g=GRAMMAR[i], qs=Array.isArray(g.q)?g.q:[];
        for(let j=0;j<qs.length;j++){
          const q=qs[j];
          if(!q||typeof q!=="object"||!Array.isArray(q.o)||typeof q.a!=="number")continue;
          out.push({q:q.q,o:q.o,a:q.a,t:"gram",part:g.t||"文法",lesson:g.id,
                    why:q.e||q.why||"",zh:q.zh||""});
        }
      }
    }
  }catch(e){}
  return out;
}
/* 文法分區：依 MAP_GREGIONS.lessons 分桶，再補到每區 >= MAP_MIN_Q */
function MAP_buildGPools(){
  const all=MAP_grammarAllQ(), buckets={};
  for(let i=0;i<MAP_GREGIONS.length;i++)buckets[MAP_GREGIONS[i].id]=[];
  for(let i=0;i<all.length;i++){
    const q=all[i];
    for(let j=0;j<MAP_GREGIONS.length;j++){
      if((MAP_GREGIONS[j].lessons||[]).indexOf(q.lesson)>=0){ buckets[MAP_GREGIONS[j].id].push(q); break; }
    }
  }
  for(let guard=0;guard<10000;guard++){
    let small=null,big=null;
    for(let j=0;j<MAP_GREGIONS.length;j++){
      const id=MAP_GREGIONS[j].id, len=buckets[id].length;
      if(len<MAP_MIN_Q&&!small)small=id;
      if(!big||len>buckets[big].length)big=id;
    }
    if(!small)break;
    if(!big||buckets[big].length<=MAP_MIN_Q)break;
    buckets[small].push(buckets[big].pop());
  }
  return buckets;
}
function MAP_regionQ(rid){
  if(MAP_isGReg(rid)){
    if(!MAP_GPOOLS||typeof MAP_GPOOLS!=="object")MAP_GPOOLS=MAP_buildGPools();
    const b=MAP_GPOOLS[rid];
    return Array.isArray(b)?b:[];
  }
  if(!MAP_POOLS||typeof MAP_POOLS!=="object")MAP_POOLS=MAP_buildPools();
  const b=MAP_POOLS[rid];
  return Array.isArray(b)?b:[];
}
function MAP_poolStats(){
  const regs=MAP_regs(), out={};
  let pools=null;
  if(MAP_isG()){
    if(!MAP_GPOOLS||typeof MAP_GPOOLS!=="object")MAP_GPOOLS=MAP_buildGPools();
    pools=MAP_GPOOLS;
  }else{
    if(!MAP_POOLS||typeof MAP_POOLS!=="object")MAP_POOLS=MAP_buildPools();
    pools=MAP_POOLS;
  }
  for(let i=0;i<regs.length;i++){
    const id=regs[i].id;
    out[id]=pools[id]?pools[id].length:0;
  }
  return out;
}

/* ======================= 共用片段 ======================= */
function MAP_head(backLabel,backOnclick,title,sub){
  const s=MAP_initState()||{};
  return '<button class="back-btn" onclick="'+backOnclick+'">'+backLabel+'</button>'+
    '<div class="sec-title">'+title+'</div>'+
    '<div class="sec-sub">'+sub+'</div>'+
    '<div class="map-currency">'+
      '<span class="chip">🪙 <b>'+(Number(s.coins)||0)+'</b></span>'+
      '<span class="chip map-chip-gem">💎 <b>'+(Number(s.gems)||0)+'</b></span>'+
      '<span class="chip">⭐ Lv.'+MAP_level()+'</span>'+
    '</div>';
}
function MAP_starsHtml(d){
  let h="";
  for(let i=1;i<=5;i++)h+='<span class="'+(i<=d?"":"off")+'">⭐</span>';
  return h;
}
function MAP_tilesHtml(rid,big){
  const total=MAP_tiles(rid), opened=MAP_opened(rid), used={};
  for(let i=0;i<opened.length;i++)used[opened[i]]=1;
  const cls=big?"map-big-tile":"map-tile";
  let h='<div class="'+(big?"map-big-tiles":"map-tiles")+'" style="grid-template-columns:repeat('+
        (MAP_reg(rid)?MAP_reg(rid).cols:4)+',1fr)">';
  for(let i=0;i<total;i++){
    const on=!!used[i];
    h+='<div class="'+cls+(on?" open":"")+'">'+(on?MAP_TILE_EMOJI[i%MAP_TILE_EMOJI.length]:"")+'</div>';
  }
  h+="</div>";
  return h;
}
function MAP_legendHtml(){
  return '<div class="map-legend">'+
    '<i><span class="lg-wild"></span>荒地（尚未開拓）</i>'+
    '<i><span class="lg-open"></span>已開拓領土</i>'+
    '<i>⭐ 難度＝該區歷史正確率</i></div>';
}

/* ======================= 畫面：地區總覽 ======================= */
function MAP_cardHtml(r){
  const d=MAP_diff(r.id), acc=MAP_regionAcc(r.id), st=(MAP_initState()||{}).regionStat[r.id];
  const total=MAP_tiles(r.id), opened=MAP_openCount(r.id);
  const pct=Math.round(opened/total*100), done=opened>=total;
  const unlocked=MAP_isUnlocked(r.id), need=MAP_unlockNeed(d), g=MAP_globalAcc();
  const nq=MAP_regionQ(r.id).length;
  let h='<div class="map-card'+(unlocked?"":" locked")+(done?" done":"")+'" onclick="'+MAP_regFn(r.id)+'">';
  h+='<div class="map-top"><span class="map-emoji">'+r.icon+'</span><div class="map-info">';
  h+='<div class="map-name">'+MAP_esc(r.name)+'<span class="map-en">'+MAP_esc(r.en)+'</span></div>';
  h+='<div class="map-theme">'+MAP_esc(r.theme)+' · '+total+' 格土地 · '+nq+' 題庫</div>';
  h+='<div class="map-stars">'+MAP_starsHtml(d)+'<span class="map-star-lv">難度 '+d+'</span></div>';
  h+='</div><div class="map-pct'+(done?" full":"")+'">'+pct+'%<small>已開拓 '+opened+"/"+total+'</small></div></div>';
  h+=MAP_tilesHtml(r.id,false);
  h+='<div class="map-meta">'+
     '<span class="acc">📊 歷史正確率 <b>'+Math.round(acc*100)+'%</b>（'+(st?st.right:0)+"/"+(st?st.total:0)+'）</span>'+
     '<span>🪙 每題 +'+(2+d)+'</span><span>✨ +'+(4+2*d)+' XP</span>'+
     '<span class="gem">💎 整區完成 +'+MAP_gemClear(d)+'</span></div>';
  if(unlocked){
    h+='<div class="map-actions">'+
       '<button class="btn-main" onclick="event.stopPropagation();MAP_start(\''+r.id+'\')">⛏️ 開拓領土</button>'+
       '<button class="btn-sec" onclick="event.stopPropagation();MAP_battle(\''+r.id+'\')">🤖 挑戰該區 AI</button>'+
       '</div>';
    if(done)h+='<div class="map-done-note">🏆 區域已 100% 開拓完成，可以繼續挑戰 AI 刷寶石與金幣！</div>';
  }else{
    h+='<div class="map-lock-note">🔒 尚未解鎖：此區難度 '+d+' 需要<b>整體正確率 '+
       Math.round(need*100)+'%</b>（目前 '+Math.round(g*100)+'%）。<br>💡 難度由該區歷史正確率分級，'+
       '多答對更多題目就能解鎖。</div>';
  }
  h+="</div>";
  return h;
}
function MAP_renderList(){
  const s=MAP_initState()||{};
  const g=MAP_globalAcc(), m=MAP_modeStat(), isG=MAP_isG();
  let h=MAP_head(isG?"‹ 返回文法迷宮":"‹ 返回大廳","MAP_close()",
    isG?"🗺️ 文法地圖":"🗺️ 領地地圖",
    isG?"知識王式分區分難度：答對一題開拓一格，整區完成拿寶石！"
       :"答對一題開拓一塊土地，整區開拓完成拿寶石！");
  h+='<div class="map-rule"><div class="mr-t">📊 難度怎麼分？</div>'+
     '每一個地區的 ⭐ 難度 1-5，是用<b>「該地區題目的歷史答題正確率」</b>'+
     '即時分級的：你答得越準，這區難度越高、AI 越強、獎勵也越多。'+
     (isG
       ? '解鎖下一級難度，則需要你<b>文法題的整體正確率（文法各區合計）</b>達到門檻：'
       : '解鎖下一級難度，則需要玩家<b>整體正確率（S.correct / S.total）</b>達到門檻：')+
     '<div class="map-th-list">';
  for(let d=1;d<=5;d++){
    const need=MAP_unlockNeed(d), on=g+1e-9>=need;
    h+='<span class="map-th-chip '+(on?"on":"off")+'">⭐'+d+" · "+Math.round(need*100)+"%</span>";
  }
  h+='</div></div>';
  h+='<div class="map-gacc"><div class="map-gacc-top"><span>🎯 我的整體正確率'+
     '（'+m.right+"/"+m.total+'）</span><b>'+Math.round(g*100)+'%</b></div>'+
     '<div class="map-bar"><div class="map-bar-fill" style="width:'+Math.round(g*100)+'%"></div></div></div>';
  h+='<div class="map-regions">';
  const regs=MAP_regs();
  for(let i=0;i<regs.length;i++)h+=MAP_cardHtml(regs[i]);
  h+="</div>";
  h+=MAP_legendHtml();
  h+='<div class="mini-note">💡 每題答對可得金幣與 XP（可到商店換道具）；答錯不開拓土地，但會記入該區歷史正確率。</div>';
  MAP_setHtml(h);
}
/* ======================= 畫面：地區詳情 ======================= */
function MAP_renderRegion(){
  const st=MAP_STATE||{view:"list",rid:null};
  const r=MAP_reg(st.rid);
  if(!r){ MAP_STATE={view:"list",rid:null}; return MAP_renderList(); }
  const d=MAP_diff(r.id), acc=MAP_regionAcc(r.id);
  const rs=(MAP_initState()||{}).regionStat[r.id]||{right:0,total:0};
  const total=MAP_tiles(r.id), opened=MAP_openCount(r.id), done=opened>=total;
  const unlocked=MAP_isUnlocked(r.id), need=MAP_unlockNeed(d), g=MAP_globalAcc();
  const nq=MAP_regionQ(r.id).length;
  let h=MAP_head("‹ 所有地區",MAP_listFn(),""+r.icon+" "+MAP_esc(r.name),
    MAP_esc(r.en)+" · "+MAP_esc(r.theme));
  h+='<div class="map-detail-head"><span class="map-detail-emoji">'+r.icon+'</span>'+
     '<div class="map-info"><div class="map-name">'+MAP_esc(r.name)+
     '<span class="map-en">'+MAP_esc(r.en)+'</span></div>'+
     '<div class="map-stars">'+MAP_starsHtml(d)+'<span class="map-star-lv">難度 '+d+
     '（歷史正確率分級）</span></div>'+
     '<div class="map-theme">'+total+' 格土地 · 題庫 '+nq+' 題 · 已開拓 '+opened+"/"+total+'</div>'+
     '</div><div class="map-pct'+(done?" full":"")+'">'+Math.round(opened/total*100)+
     '%<small>開拓率</small></div></div>';
  h+='<div class="stats-row">'+
     '<div class="stat-card">📊 區域正確率<b>'+Math.round(acc*100)+'%</b></div>'+
     '<div class="stat-card">✅ 答對 / 總數<b>'+(rs.right||0)+"/"+(rs.total||0)+'</b></div>'+
     '<div class="stat-card">⛏️ 已開拓<b>'+opened+"/"+total+'</b></div></div>';
  h+='<div style="height:13px"></div>';
  h+=MAP_tilesHtml(r.id,true);
  h+=MAP_legendHtml();
  h+='<div class="map-reward-box">🎁 <b>開拓獎勵</b>：答對一題 = 🪙 +'+(2+d)+' ＋ ✨ +'+(4+2*d)+
     ' XP；整區 100% 開拓再拿 <b>💎 '+MAP_gemClear(d)+' 寶石</b>。<br>'+
     '🤖 <b>挑戰該區 AI</b>：20 題 HP 對決，AI 正確率 '+
     Math.round(MAP_aiAcc(d)*100)+'%，勝利拿 🪙 +'+(40+15*d)+' 與 💎 '+MAP_gemBattle(d)+'。</div>';
  if(unlocked){
    h+='<div class="map-actions">'+
       '<button class="btn-main" onclick="MAP_start(\''+r.id+'\')">⛏️ 開拓領土（'+MAP_RUN_N+' 題）</button>'+
       '<button class="btn-sec" onclick="MAP_battle(\''+r.id+'\')">🤖 挑戰該區 AI</button></div>';
    if(done)h+='<div class="map-done-note">🏆 區域已完成 100% 開拓！可反覆挑戰 AI 賺金幣與寶石。</div>';
  }else{
    h+='<div class="map-lock-note">🔒 尚未解鎖：難度 '+d+' 需要<b>整體正確率 '+
       Math.round(need*100)+'%</b>（目前 '+Math.round(g*100)+'%）。<br>'+
       '💡 該區難度由你的歷史正確率分級，先到其他地區多答對幾題就能解鎖。</div>';
  }
  h+='<div class="map-run-note">每次開拓出 '+MAP_RUN_N+' 題，答對才會開拓下一塊土地。</div>';
  MAP_setHtml(h);
}

/* ======================= 畫面：開拓作答 ======================= */
function MAP_renderPlay(){
  const st=MAP_STATE;
  if(!st||st.view!=="play"){ MAP_render(); return; }
  const r=MAP_reg(st.rid);
  const q=st.qs[st.i];
  if(!q){ MAP_endRun(); return; }
  const total=MAP_tiles(st.rid), opened=MAP_openCount(st.rid), done=opened>=total;
  const runPct=Math.round(st.i/st.qs.length*100);
  let h=MAP_head("‹ 暫離","MAP_region('"+st.rid+"')","⛏️ 開拓 "+MAP_esc(r?r.name:""),
    "答對開拓一格，答錯不開拓（本輪 "+MAP_RUN_N+" 題）");
  h+='<div class="map-play-head">'+
     '<span class="map-land-chip'+(done?" full":"")+'">'+(r?r.icon:"")+" "+(r?MAP_esc(r.name):"")+
     ' · 已開拓 '+opened+"/"+total+'</span>'+
     '<div class="q-progress" style="flex:1"><div class="q-progress-fill" style="width:'+runPct+'%"></div></div>'+
     '<span class="q-counter">'+(st.i+1)+"/"+st.qs.length+'</span></div>';
  h+='<div class="map-mini-tiles">';
  for(let i=0;i<total;i++)h+='<span class="map-mini-tile'+(MAP_opened(st.rid).indexOf(i)>=0?" open":"")+'"></span>';
  h+='</div>';
  h+=MAP_qHtml(q,st,"map");
  MAP_setHtml(h);
  if(!st.answered&&q.t==="listen"&&q.audio){
    setTimeout(function(){ if(MAP_STATE===st&&!st.answered)MAP_speak(q.audio); },350);
  }
}
/* 題目卡片（開拓與對戰共用，prefix 區隔用） */
function MAP_qHtml(q,st,prefix){
  const isL=q.t==="listen";
  const kind=isL?"聽力":(q.t==="gram"?"文法":"閱讀");
  let h='<div class="q-card">';
  h+='<span class="q-type'+(isL?"":" reading")+'">'+MAP_esc(q.part||"題目")+" · "+
     kind+(st&&st.regionName?' · '+MAP_esc(st.regionName):"")+"</span>";
  if(q.emoji)h+='<div class="q-emoji-scene">'+MAP_esc(q.emoji)+"</div>";
  if(q.passage)h+='<div class="q-passage">'+MAP_esc(q.passage).replace(/\n/g,"<br>")+"</div>";
  if(isL&&q.audio)h+='<div class="q-audio"><button class="audio-btn" onclick="MAP_audio()">🔊</button>'+
     '<div><div class="audio-label">🎧 會自動朗讀一次（可重播）</div>'+
     '<div class="audio-locked">✍️ 作答後顯示原文與解析</div></div></div>';
  h+='<div class="q-text" style="margin-top:10px">'+MAP_esc(q.q)+"</div>";
  if(!isL&&q.passage)h+='<div style="margin-top:8px;text-align:right">'+
     '<button class="say-inline" onclick="MAP_say()">🔊 朗讀文章</button></div>';
  h+="</div>";
  h+='<div class="q-options">';
  const answered=!!(st&&st.answered), picked=st?st.picked:-1, ok=picked===q.a;
  (q.o||[]).forEach(function(o,i){
    let cls="opt-btn";
    if(answered){
      if(i===q.a)cls+=" correct";
      if(i===picked&&!ok)cls+=" wrong";
    }
    h+='<button class="'+cls+'"'+(answered?" disabled":"")+
       ' onclick="MAP_answer('+i+')"><span class="opt-key">'+String.fromCharCode(65+i)+
       '</span><span>'+MAP_esc(o)+"</span></button>";
  });
  h+="</div>";
  if(answered&&st&&st.fb)h+='<div class="feedback show '+(st.fbOk?"ok":"no")+'">'+st.fb+"</div>";
  if(answered)h+='<button class="next-btn show" onclick="MAP_next()">'+
     (st&&st.i+1>=st.qs.length?"查看結果":"下一題 ›")+"</button>";
  return h;
}
function MAP_feedbackHtml(q,ok,picked){
  let t;
  if(ok)t='<div class="fb-title">✅ 答對了！土地開拓 +1</div>';
  else if(picked<0)t='<div class="fb-title">⏰ 未作答，正確答案 '+String.fromCharCode(65+q.a)+"</div>";
  else t='<div class="fb-title">❌ 答錯了，正確答案 '+String.fromCharCode(65+q.a)+"</div>";
  let body="";
  if(q.t==="listen"&&q.audio){
    body='<div class="listen-reveal">'+
      '<div class="lr-line"><b>🎙️ 原文</b><span class="lr-en">'+MAP_kw(q.audio,q.kw)+"</span></div>"+
      '<div class="lr-line"><b>🇨🇳 句意</b>'+MAP_esc(q.zh||"")+"</div>"+
      (q.why?'<div class="lr-line"><b>💡 為什麼</b><span class="lr-why">'+MAP_esc(q.why)+"</span></div>":"")+
      "</div>";
  }else{
    body=q.zh?("<div>"+MAP_esc(q.zh)+"</div>"):"";
    if(q.why)body+='<div class="lr-line" style="margin-top:7px"><b>💡 為什麼</b><span class="lr-why">'+
      MAP_esc(q.why)+"</span></div>";
  }
  return t+body;
}
function MAP_kw(text,kw){
  let out=MAP_esc(text);
  if(!kw||!kw.length)return out;
  try{
    if(typeof kwMark==="function")return kwMark(text,kw);
  }catch(e){}
  return out;
}
function MAP_audio(){
  const st=MAP_STATE; if(!st||!st.qs)return;
  const q=st.qs[st.i];
  if(q&&q.audio)MAP_speak(q.audio);
}
function MAP_say(){
  const st=MAP_STATE; if(!st||!st.qs)return;
  const q=st.qs[st.i];
  if(q)MAP_speak(q.passage||q.q);
}
/* ======================= 開拓流程 ======================= */
function MAP_start(rid){
  const r=MAP_reg(rid);
  if(!r){ MAP_toast("找不到這個地區","❌"); return; }
  MAP_initState();
  if(!MAP_isUnlocked(rid)){
    MAP_toast("🔒 尚未解鎖：難度 "+MAP_diff(rid)+" 需要整體正確率 "+
      Math.round(MAP_unlockNeed(MAP_diff(rid))*100)+"%","🔒");
    MAP_STATE={view:"region",rid:rid};
    MAP_render();
    return;
  }
  const pool=MAP_regionQ(rid);
  if(!pool.length){ MAP_toast("這個地區還沒有題目","⚠️"); return; }
  const qs=MAP_pickN(pool,Math.min(MAP_RUN_N,pool.length));
  if(!qs.length){ MAP_toast("題目載入失敗","⚠️"); return; }
  MAP_STATE={view:"play",rid:rid,regionName:r.name,qs:qs,i:0,right:0,
    answered:false,picked:-2,fb:"",fbOk:false,openedNow:0,coins:0,xp:0,gems:0};
  MAP_render();
}
function MAP_answer(i){
  const st=MAP_STATE;
  if(!st||st.view!=="play"||st.answered)return;
  const q=st.qs[st.i];
  if(!q)return;
  const ok=(i===q.a);
  const d=MAP_diff(st.rid);            /* 先取難度（記錄前），獎勵才不會被本次答題影響 */
  st.answered=true;
  st.picked=i;
  MAP_record(st.rid,ok);
  if(ok){
    st.right++;
    const coins=2+d, xp=4+2*d;
    st.coins+=coins; st.xp+=xp;
    MAP_reward(coins,xp);
    const claim=MAP_claimTile(st.rid);
    st.openedNow++;
    if(claim.done&&claim.gems>0){
      st.gems+=claim.gems;
      MAP_toast("🏆 整區開拓完成！+"+claim.gems+" 寶石","💎");
      MAP_confetti(60);
    }else{
      MAP_confetti(8);
    }
  }
  st.fbOk=ok;
  st.fb=MAP_feedbackHtml(q,ok,i);
  MAP_render();
}
function MAP_next(){
  const st=MAP_STATE;
  if(!st||st.view!=="play"||!st.answered)return;
  st.i++;
  if(st.i>=st.qs.length){ MAP_endRun(); return; }
  st.answered=false; st.picked=-2; st.fb=""; st.fbOk=false;
  MAP_render();
}
function MAP_endRun(){
  const st=MAP_STATE;
  if(!st||st.view!=="play")return;
  const total=st.qs.length, r=st.right;
  const pct=total?Math.round(r/total*100):0;
  const opened=MAP_openCount(st.rid), tiles=MAP_tiles(st.rid);
  const done=opened>=tiles;
  let emoji="🎉",word="開拓順利！";
  if(pct<40){emoji="💪";word="繼續加油！"}
  else if(pct<70){emoji="😊";word="表現不錯！"}
  else if(pct<100){emoji="🌟";word="非常優秀！"}
  if(done){emoji="👑";word="領地完成！"}
  st.view="result";
  let h=MAP_head("‹ 地區詳情","MAP_region('"+st.rid+"')","⛏️ 開拓結果",
    MAP_esc((MAP_reg(st.rid)||{}).name||""));
  h+='<div class="result-card"><div class="result-emoji">'+emoji+"</div>"+
     '<div class="result-title">'+word+"</div>"+
     '<div class="result-score">'+r+"/"+total+"</div>"+
     '<div class="result-stats">'+
     '<div class="rs-item"><div class="rs-val">'+pct+'%</div><div class="rs-label">本輪正確率</div></div>'+
     '<div class="rs-item"><div class="rs-val">+'+st.openedNow+'</div><div class="rs-label">開拓土地</div></div>'+
     '<div class="rs-item"><div class="rs-val">'+opened+"/"+tiles+'</div><div class="rs-label">區域進度</div></div>'+
     '</div>'+
     '<div class="reward-row"><span class="reward-pill">🪙 +'+st.coins+'</span>'+
     '<span class="reward-pill">✨ +'+st.xp+" XP</span>"+
     (st.gems>0?'<span class="reward-pill">💎 +'+st.gems+"</span>":"")+'</div>';
  if(done)h+='<div class="map-done-note">🏆 '+MAP_esc((MAP_reg(st.rid)||{}).name||"")+
    ' 已 100% 開拓完成，寶石已入袋！</div>';
  h+='<div class="btn-row"><button class="btn-sec" onclick="'+MAP_listFn()+'">回地圖</button>'+
     '<button class="btn-main" onclick="MAP_start(\''+st.rid+'\')">再開拓一次</button></div></div>';
  h+='<div class="mini-note">💡 答錯不會開拓土地，但會記入該區歷史正確率，進而影響難度分級。</div>';
  st.resultHtml=h;
  MAP_setHtml(h);
  if(pct>=80)MAP_confetti(30);
}

/* ======================= AI 對戰流程 ======================= */
function MAP_battle(rid){
  const r=MAP_reg(rid);
  if(!r){ MAP_toast("找不到這個地區","❌"); return; }
  MAP_initState();
  if(!MAP_isUnlocked(rid)){
    MAP_toast("🔒 尚未解鎖：難度 "+MAP_diff(rid)+" 需要整體正確率 "+
      Math.round(MAP_unlockNeed(MAP_diff(rid))*100)+"%","🔒");
    MAP_STATE={view:"region",rid:rid};
    MAP_render();
    return;
  }
  const pool=MAP_regionQ(rid);
  if(!pool.length){ MAP_toast("這個地區還沒有題目","⚠️"); return; }
  const d=MAP_diff(rid);
  const qs=MAP_pickN(pool,MAP_BATTLE_N);
  MAP_STATE={view:"battle",rid:rid,regionName:r.name,diff:d,acc:MAP_aiAcc(d),
    name:"🤖 "+r.name+" AI",qs:qs,i:0,p1:100,p2:100,right1:0,right2:0,
    answered:false,picked:-2,fb:"",fbOk:false,log:"準備戰鬥...",coins:0,xp:0,gems:0};
  MAP_render();
}
function MAP_renderBattle(){
  const st=MAP_STATE;
  if(!st||st.view!=="battle"){ MAP_render(); return; }
  if(st.i>=st.qs.length||st.p1<=0||st.p2<=0){ MAP_endBattle(); return; }
  const q=st.qs[st.i];
  if(!q){ MAP_endBattle(); return; }
  const r=MAP_reg(st.rid);
  let h=MAP_head("‹ 暫離","MAP_region('"+st.rid+"')","🤖 挑戰 "+MAP_esc(r?r.name:"")+" AI",
    "雙方各 100 HP，答錯扣自己 "+MAP_DMG+" HP，HP 高者獲勝");
  h+='<div class="vs-arena"><div class="vs-row">'+
     '<div class="vs-player"><div class="vs-name">🎮 你</div>'+
     '<div class="hp-bar"><div class="hp-fill p1" style="width:'+st.p1+'%"></div></div>'+
     '<div class="hp-num">'+st.p1+" HP</div></div>"+
     '<div class="vs-mark">VS</div>'+
     '<div class="vs-player"><div class="vs-name">'+MAP_esc(st.name)+"</div>"+
     '<div class="hp-bar"><div class="hp-fill p2" style="width:'+st.p2+'%"></div></div>'+
     '<div class="hp-num">'+st.p2+" HP</div></div></div>"+
     '<div class="battle-log">'+(st.answered?st.fbLog:("第 "+(st.i+1)+"/"+st.qs.length+" 題 — 選出你的答案！"))+"</div>"+
     '<div style="text-align:center"><span class="map-ai-tag'+(st.answered?" ok":"")+'">'+
     "AI 正確率 "+Math.round(st.acc*100)+"%（難度 "+st.diff+"）</span></div></div>";
  h+=MAP_qHtml(q,st,"b");
  MAP_setHtml(h);
  if(!st.answered&&q.t==="listen"&&q.audio){
    setTimeout(function(){ if(MAP_STATE===st&&!st.answered)MAP_speak(q.audio); },300);
  }
}
function MAP_battleAnswer(i){
  const st=MAP_STATE;
  if(!st||st.view!=="battle"||st.answered)return;
  const q=st.qs[st.i];
  if(!q)return;
  const p1ok=(i===q.a);
  const aiOk=Math.random()<st.acc;
  const dmg1=p1ok?0:MAP_DMG, dmg2=aiOk?0:MAP_DMG;
  st.p1=Math.max(0,st.p1-dmg1);
  st.p2=Math.max(0,st.p2-dmg2);
  if(p1ok)st.right1++;
  if(aiOk)st.right2++;
  st.answered=true;
  st.picked=i;
  MAP_record(st.rid,p1ok);
  if(p1ok)MAP_reward(1,2);   /* 對戰中答對也有小獎勵 */
  let log="";
  if(p1ok&&aiOk)log="你答對了！　|　"+st.name+" 也答對";
  else if(p1ok)log="你答對了！🎉　|　"+st.name+" 答錯 -"+dmg2+" HP";
  else if(aiOk)log="你答錯了 -"+dmg1+" HP　|　"+st.name+" 答對";
  else log="雙方都答錯！你 -"+dmg1+" HP、"+st.name+" -"+dmg2+" HP";
  log+="　▸ HP "+st.p1+" : "+st.p2;
  st.fbLog=log;
  st.fbOk=p1ok;
  st.fb=MAP_feedbackHtml(q,p1ok,i);
  MAP_render();
  const delay=q.t==="listen"?3600:1700;
  setTimeout(function(){
    if(MAP_STATE!==st)return;
    st.i++;
    if(st.p1<=0||st.p2<=0||st.i>=st.qs.length)MAP_endBattle();
    else{ st.answered=false; st.picked=-2; st.fb=""; st.fbLog=""; MAP_render(); }
  },delay);
}
function MAP_endBattle(){
  const st=MAP_STATE;
  if(!st||st.view!=="battle")return;
  const win=st.p1>st.p2, draw=st.p1===st.p2;
  let coins,xp,gems;
  if(win){ coins=40+15*st.diff; xp=60+20*st.diff; gems=MAP_gemBattle(st.diff); }
  else if(draw){ coins=25; xp=40; gems=0; }
  else { coins=10; xp=20; gems=0; }
  st.coins=coins; st.xp=xp; st.gems=gems;
  MAP_reward(coins,xp);
  if(gems>0)MAP_addGems(gems);
  st.view="result";
  const n=st.qs.length;
  let h=MAP_head("‹ 地區詳情","MAP_region('"+st.rid+"')","🤖 AI 對戰結果",
    MAP_esc((MAP_reg(st.rid)||{}).name||"")+" · 難度 "+st.diff);
  h+='<div class="result-card"><div class="result-emoji">'+(win?"🏆":draw?"🤝":"😵")+"</div>"+
     '<div class="result-title">'+(win?"你贏了！":draw?"平手！":"戰敗...")+"</div>"+
     '<div class="result-score">'+st.p1+" : "+st.p2+"</div>"+
     '<div class="result-stats">'+
     '<div class="rs-item"><div class="rs-val">'+st.p1+'</div><div class="rs-label">你的 HP（答對 '+
       st.right1+"/"+n+")</div></div>"+
     '<div class="rs-item"><div class="rs-val">'+st.p2+'</div><div class="rs-label">'+MAP_esc(st.name)+
       "（答對 "+st.right2+"/"+n+")</div></div>"+
     '<div class="rs-item"><div class="rs-val">'+Math.round(st.acc*100)+'%</div><div class="rs-label">AI 正確率</div></div>'+
     '</div>'+
     '<div class="reward-row"><span class="reward-pill">🪙 +'+coins+'</span>'+
     '<span class="reward-pill">✨ +'+xp+" XP</span>"+
     (gems>0?'<span class="reward-pill">💎 +'+gems+"</span>":"")+'</div>'+
     '<div class="map-result-note">⚔️ 規則：雙方 100 HP，答錯扣自己 '+MAP_DMG+
       ' HP（20 題剛好扣完），最後 <b>HP 高者獲勝</b>。<br>AI 強度依該區難度 '+st.diff+
       ' 決定（正確率 '+Math.round(st.acc*100)+'%）。</div>'+
     '<div class="btn-row"><button class="btn-sec" onclick="'+MAP_listFn()+'">回地圖</button>'+
     '<button class="btn-main" onclick="MAP_battle(\''+st.rid+'\')">再戰一場</button></div></div>';
  st.resultHtml=h;
  MAP_setHtml(h);
  if(win)MAP_confetti(44);
}

/* ======================= 畫面輸出 / 導覽 ======================= */
function MAP_setHtml(html){
  const box=MAP_el("scr-map");
  if(box){ try{ box.innerHTML=html; }catch(e){} }
}
function MAP_render(){
  const st=MAP_STATE||(MAP_STATE={view:"list",rid:null});
  if(st.view==="play")return MAP_renderPlay();
  if(st.view==="battle")return MAP_renderBattle();
  if(st.view==="region")return MAP_renderRegion();
  if(st.view==="result"){
    if(st.resultHtml){ MAP_setHtml(st.resultHtml); return; }
    return MAP_renderList();
  }
  return MAP_renderList();
}
function MAP_region(rid){
  MAP_STATE={view:MAP_reg(rid)?"region":"list",rid:rid||null};
  MAP_render();
}
function MAP_open(rid){
  MAP_MODE="toeic";
  MAP_initState();
  MAP_ensureScreen();
  MAP_injectCSS();
  MAP_STATE={view:MAP_reg(rid)?"region":"list",rid:MAP_reg(rid)?rid:null};
  MAP_render();
  MAP_go("scr-map");
}
/* 文法地圖入口（文法迷宮畫面的按鈕）；rid 為文法地區 id */
function MAP_gopen(rid){
  MAP_MODE="grammar";
  MAP_initState();
  MAP_ensureScreen();
  MAP_injectCSS();
  const ok=MAP_isGReg(rid);
  MAP_STATE={view:ok?"region":"list",rid:ok?rid:null};
  MAP_render();
  MAP_go("scr-map");
}
function MAP_close(){
  MAP_STATE={view:"list",rid:null};
  MAP_go(MAP_isG()?"scr-grammar":"scr-home");
}

/* ======================= 畫面建立 / CSS 注入 ======================= */
function MAP_ensureScreen(){
  try{
    if(document.getElementById("scr-map"))return true;
    const d=document.createElement("div");
    d.className="screen";
    d.id="scr-map";
    const b=document.getElementById("scr-battle");
    if(b&&b.parentNode&&b.parentNode.insertBefore)b.parentNode.insertBefore(d,b.nextSibling);
    else if(document.body)document.body.appendChild(d);
    return !!document.getElementById("scr-map");
  }catch(e){ return false; }
}
function MAP_injectCSS(){
  try{
    if(document.getElementById("map-css"))return false;
    const st=document.createElement("style");
    st.id="map-css";
    st.textContent=MAP_CSS;
    const head=document.head||document.getElementsByTagName("head")[0]||document.documentElement;
    if(!head)return false;
    head.appendChild(st);
    return true;
  }catch(e){ return false; }
}

/* ======================= 啟動 ======================= */
MAP_injectCSS();
if(typeof document!=="undefined"){
  MAP_ensureScreen();
  if(document.readyState==="loading"){
    try{
      document.addEventListener("DOMContentLoaded",function(){ MAP_ensureScreen(); MAP_injectCSS(); });
    }catch(e){}
  }
}
try{ if(typeof window!=="undefined"){ window.MAP_open=MAP_open; window.MAP_gopen=MAP_gopen; } }catch(e){}
