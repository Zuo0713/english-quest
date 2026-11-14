"use strict";
/* ================================================================
   shop.js — 商店・道具・每日任務・寶石 模組（獨立新增檔）
   ----------------------------------------------------------------
   * 完全不修改 index.html，整合時只要：
     1) <script src="shop.js"></script>（放在 index.html 主 script 之後）
     2) 首頁選單加 <button class="menu-card shop" onclick="SHOP_open()">…</button>
     3) 答題／學習流程呼叫 window.SHQ_* 與 window.SHOP_* hooks（見檔尾）
   * 所有全域名稱皆以 SH / SHQ / SHP / SHOP_ 開頭，避免與既有程式衝突。
   * 對 S 的新欄位一律防禦性初始化（舊存檔沒有也能運作）：
       S.gems          寶石
       S.items         道具庫存 {id:數量}
       S.xpBoostUntil  經驗加成到期時間戳（ms）
       S.quests        每日任務 {date,list:[{id,desc,goal,prog,done,claimed,gem,coin,xp}],bonus}
       S.gemEx         寶石兌換紀錄 {date,n}
   ================================================================ */

/* ===================== 樣式（前綴 .sh-） ===================== */
const SH_CSS=`
/* ===== 商店 / 每日任務 ===== */
.sh-wallet{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.sh-chip{background:var(--card2);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:7px 13px;
  font-size:13px;font-weight:700;display:flex;align-items:center;gap:5px;color:var(--text)}
.sh-chip.gem{border-color:rgba(59,130,246,.45);color:var(--blue2);background:rgba(59,130,246,.16)}
.sh-chip.boost{border-color:rgba(245,158,11,.45);color:var(--amber2);background:rgba(245,158,11,.14)}
.sh-chip.boost.on{border-color:rgba(239,68,68,.5);color:var(--red2);background:rgba(239,68,68,.16);
  animation:glow 2.4s infinite}
.sh-ex{display:flex;align-items:center;gap:10px;background:var(--card);border:1px dashed rgba(59,130,246,.45);
  border-radius:14px;padding:11px 13px;margin-bottom:16px;flex-wrap:wrap}
.sh-ex-t{font-weight:700;font-size:14px}
.sh-ex-d{font-size:12px;color:var(--text2);flex:1;min-width:160px;line-height:1.5}
.sh-sec-title{display:flex;align-items:center;justify-content:space-between;gap:8px;
  font-size:15px;font-weight:800;margin:18px 0 10px;color:var(--text)}
.sh-reset{font-size:11.5px;font-weight:600;color:var(--text2);background:var(--card);
  border:1px solid rgba(255,255,255,.1);padding:3px 9px;border-radius:10px;white-space:nowrap}
.sh-grid{display:grid;gap:10px}
.sh-item{display:flex;gap:12px;background:var(--card);border:1px solid rgba(255,255,255,.1);
  border-radius:var(--radius);padding:13px;transition:.25s;animation:slideUp .3s backwards}
.sh-item:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.22)}
.sh-item.has{border-color:rgba(16,185,129,.35)}
.sh-ico{font-size:28px;width:46px;height:46px;flex:none;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.08);border-radius:12px}
.sh-body{flex:1;min-width:0}
.sh-name{font-size:14.5px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sh-stock{font-size:11px;font-weight:700;padding:2px 8px;border-radius:9px;
  background:rgba(16,185,129,.22);color:var(--green2)}
.sh-stock.empty{background:rgba(255,255,255,.1);color:var(--text2)}
.sh-desc{font-size:12px;color:var(--text2);margin:4px 0 9px;line-height:1.5}
.sh-acts{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.sh-buy{border:none;border-radius:10px;padding:8px 13px;font-size:13px;font-weight:800;cursor:pointer;
  transition:.2s;font-family:inherit;color:#fff}
.sh-buy.coin{background:linear-gradient(135deg,var(--amber),#d97706)}
.sh-buy.gem{background:linear-gradient(135deg,var(--blue),#2563eb)}
.sh-buy:hover{transform:translateY(-2px);box-shadow:0 5px 14px rgba(0,0,0,.3)}
.sh-use{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:10px;padding:8px 13px;
  font-size:13px;font-weight:700;color:var(--text);cursor:pointer;transition:.2s;font-family:inherit}
.sh-use:hover{background:rgba(255,255,255,.1)}
.sh-buy:disabled,.sh-use:disabled,.sh-claim:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none}
.sh-quests{display:grid;gap:10px}
.sh-quest{background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius);
  padding:13px;transition:.25s;animation:slideUp .3s backwards}
.sh-quest.done{border-color:rgba(245,158,11,.5);
  background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(251,191,36,.07))}
.sh-quest.claimed{border-color:rgba(16,185,129,.4);opacity:.72}
.sh-q-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}
.sh-q-desc{font-size:14px;font-weight:700}
.sh-q-rw{font-size:11.5px;font-weight:700;color:var(--amber2);background:rgba(245,158,11,.16);
  border:1px solid rgba(245,158,11,.35);padding:3px 9px;border-radius:14px;white-space:nowrap}
.sh-bar{height:10px;background:rgba(255,255,255,.12);border-radius:5px;overflow:hidden;margin:10px 0 8px}
.sh-bar-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--blue),var(--green));
  transition:width .5s ease}
.sh-quest.done .sh-bar-fill{background:linear-gradient(90deg,var(--amber),var(--amber2))}
.sh-q-foot{display:flex;justify-content:space-between;align-items:center;gap:8px}
.sh-q-prog{font-size:12.5px;color:var(--text2);font-weight:700}
.sh-claim{background:transparent;border:1px solid rgba(255,255,255,.25);color:var(--text2);padding:8px 15px;
  border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:.2s;font-family:inherit}
.sh-claim.ready{background:linear-gradient(135deg,var(--pri),var(--pink));color:#fff;border-color:transparent;
  animation:pulse 1.6s infinite;box-shadow:0 4px 16px rgba(124,58,237,.4)}
.sh-claim.ready:hover{transform:translateY(-2px)}
.sh-done-note{font-size:13px;font-weight:700;color:var(--green2);background:rgba(16,185,129,.14);
  border:1px dashed rgba(16,185,129,.45);border-radius:12px;padding:10px 12px;margin-top:10px;text-align:center}
@media(max-width:400px){
  .sh-buy,.sh-use,.sh-claim{padding:7px 10px;font-size:12.5px}
}
`;

/* ===================== 基礎工具（一律走 window.*，避免 ReferenceError） ===================== */
function SH_win(name){
  try{
    if(typeof window!=="undefined"&&window&&typeof window[name]==="function")return window[name];
  }catch(e){}
  return null;
}
function SH_call(name,args){
  const f=SH_win(name);
  if(!f)return undefined;
  try{return f.apply(null,args||[])}catch(e){return undefined}
}
function SH_toast(m,e){SH_call("toast",[m,e])}
function SH_save(){SH_call("save")}
function SH_confetti(n){SH_call("confetti",[n])}
function SH_renderHome(){SH_call("renderHome",[])}
function SH_addCoins(n){
  n=Number(n)||0;
  const f=SH_win("addCoins");
  if(f){try{f(n);return true}catch(e){}}
  const st=SH_state();
  if(st){st.coins=(Number(st.coins)||0)+n;SH_save();SH_renderHome()}
  return true;
}
function SH_esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function SH_today(){
  const r=SH_call("today",[]);
  if(typeof r==="string"&&r.length>=8)return r;
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
/* 目前的玩家狀態（舊存檔 / 尚未載入時回傳 null，不拋錯） */
function SH_state(){
  try{
    if(typeof S!=="undefined"&&S&&typeof S==="object")return SH_initState(S);
  }catch(e){}
  return null;
}
function SH_initState(st){
  if(typeof st.gems!=="number"||!isFinite(st.gems)||st.gems<0)st.gems=0;
  if(!st.items||typeof st.items!=="object"||Array.isArray(st.items))st.items={};
  if(typeof st.xpBoostUntil!=="number"||!isFinite(st.xpBoostUntil)||st.xpBoostUntil<0)st.xpBoostUntil=0;
  if(!st.quests||typeof st.quests!=="object"||!Array.isArray(st.quests.list))
    st.quests={date:"",list:[],bonus:false};
  if(typeof st.quests.bonus!=="boolean")st.quests.bonus=false;
  if(!st.gemEx||typeof st.gemEx!=="object")st.gemEx={date:"",n:0};
  return st;
}

/* ===================== 資料定義 ===================== */
const SH_ITEMS=[
  {id:"replay",icon:"🎧",name:"聽力重聽券",desc:"聽力題可再多聽 1 次（點重聽時自動消耗）",coin:60,gem:2},
  {id:"time",  icon:"⏱️",name:"時間延長券",desc:"閱讀／測驗單題延長 10 秒",coin:50,gem:1},
  {id:"hint",  icon:"💡",name:"提示券",    desc:"排除一個錯誤選項，提高猜對機率",coin:40,gem:1},
  {id:"shield",icon:"🛡️",name:"護盾券",    desc:"對戰中答錯一次不扣 HP",coin:80,gem:2},
  {id:"xp",    icon:"🔥",name:"經驗加成",  desc:"使用後 30 分鐘內所有 XP ×2",coin:150,gem:3}
];
const SH_ITEM_MAP=(function(){const m={};SH_ITEMS.forEach(function(x){m[x.id]=x});return m})();
const SHQ_TPL=[
  {id:"right10",kind:"correct",desc:"✅ 今日答對 10 題",          goal:10,coin:40,gem:1,xp:30},
  {id:"listen3",kind:"listen", desc:"🎧 聽力練習（作答 3 題聽力）", goal:3, coin:30,gem:1,xp:25},
  {id:"words5", kind:"words",  desc:"🔤 今日背 5 個單字",          goal:5, coin:50,gem:2,xp:40},
  {id:"win1",   kind:"win",    desc:"⚔️ 贏 1 場對戰",              goal:1, coin:60,gem:2,xp:50}
];
const SHQ_BONUS_GEM=3;   /* 當日任務全數領完額外送的寶石 */
const SH_XP_BOOST_MS=30*60*1000;
const SH_EX_RATE=300;    /* 寶石兌換：300 🪙 → 1 💎 */
const SH_EX_CAP=3;       /* 每日兌換上限 */

/* 任務推進的累計帳（跨日會一起歸零）：
   SHQ_ev      各事件入口累計（由 SHQ_onAnswer/... 累加）
   SHQ_base    任務週期開始時 S.correct/S.words/S.wins 的基準值
   SHQ_applied 已經推進到任務的量
   → 目標量 = max(事件累計, 統計差量)，取 max 可避免「事件 + 統計」重複計算 */
let SHQ_ev={correct:0,listen:0,words:0,win:0};
let SHQ_base={correct:0,words:0,wins:0};
let SHQ_applied={correct:0,listen:0,words:0,win:0};

/* ===================== 每日任務 ===================== */
function SHQ_buildList(){
  return SHQ_TPL.map(function(t){
    return {id:t.id,kind:t.kind,desc:t.desc,goal:t.goal,prog:0,
            done:false,claimed:false,coin:t.coin,gem:t.gem,xp:t.xp};
  });
}
function SHQ_zeroBaseline(st){
  SHQ_base={correct:Number(st.correct)||0,words:Number(st.words)||0,wins:Number(st.wins)||0};
  SHQ_ev={correct:0,listen:0,words:0,win:0};
  SHQ_applied={correct:0,listen:0,words:0,win:0};
}
/* 確保任務屬於「今天」（跨日自動重置），回傳任務包或 null */
function SHQ_ensure(){
  const st=SH_state();
  if(!st)return null;
  const t=SH_today();
  const q=st.quests;
  const broken=(!q.date)||q.date!==t||!Array.isArray(q.list)||
    q.list.length!==SHQ_TPL.length||
    q.list.some(function(x){return !x||typeof x.prog!=="number"||typeof x.goal!=="number"});
  if(broken){
    st.quests={date:t,list:SHQ_buildList(),bonus:false};
    SHQ_zeroBaseline(st);
    SH_save();
  }
  return st.quests;
}
/* 把 delta 推進到對應種類的任務，回傳實際推進量 */
function SHQ_advance(kind,delta){
  delta=Number(delta)||0;
  if(delta<=0)return 0;
  const q=SHQ_ensure();
  if(!q)return 0;
  let gained=0;
  const finished=[];
  for(let i=0;i<q.list.length;i++){
    const it=q.list[i];
    if(!it||it.kind!==kind)continue;
    if(it.prog>=it.goal)continue;
    const before=it.prog;
    it.prog=Math.min(it.goal,it.prog+delta);
    gained+=it.prog-before;
    if(it.prog>=it.goal&&!it.done){it.done=true;finished.push(it)}
  }
  if(gained>0){
    SH_save();
    for(let i=0;i<finished.length;i++){
      SH_toast("🎉 每日任務完成："+finished[i].desc,"🎯");
      SH_confetti(16);
    }
    SHOP_renderIfOpen();
  }
  return gained;
}
/* 每次答題／學習後呼叫：把「事件累計」與「S 統計差量」推進到任務 */
function SHQ_sync(){
  try{
    const st=SH_state();
    if(!st)return false;
    const q=SHQ_ensure();
    if(!q)return false;
    const stat={
      correct:(Number(st.correct)||0)-SHQ_base.correct,
      words:(Number(st.words)||0)-SHQ_base.words,
      win:(Number(st.wins)||0)-SHQ_base.wins
    };
    const tgt={
      correct:Math.max(0,SHQ_ev.correct,stat.correct),
      listen:Math.max(0,SHQ_ev.listen),
      words:Math.max(0,SHQ_ev.words,stat.words),
      win:Math.max(0,SHQ_ev.win,stat.win)
    };
    Object.keys(tgt).forEach(function(k){
      if(tgt[k]<SHQ_applied[k]){SHQ_applied[k]=tgt[k];return}  /* 統計被重置（換帳號）→ 重新對齊 */
      const d=tgt[k]-SHQ_applied[k];
      if(d>0){SHQ_applied[k]=tgt[k];SHQ_advance(k,d)}
    });
    return true;
  }catch(e){return false}
}
/* 領獎（防重複領取） */
function SHQ_claim(id){
  try{
    const st=SH_state();
    if(!st)return false;
    const q=SHQ_ensure();
    if(!q)return false;
    let target=null;
    for(let i=0;i<q.list.length;i++)if(q.list[i].id===id)target=q.list[i];
    if(!target){SH_toast("找不到這個每日任務","⚠️");return false}
    if(target.claimed){SH_toast("這個任務已經領過囉","✅");return false}
    if(!target.done||target.prog<target.goal){SH_toast("任務還沒完成，再加油一下！","💪");return false}
    let beforeLv=0;
    try{const f=SH_win("level");if(f)beforeLv=f()}catch(e){}
    target.claimed=true;
    const mult=SHOP_xpMult();
    const xpGain=(Number(target.xp)||0)*mult;
    if(target.coin)SH_addCoins(target.coin);
    st.gems=(Number(st.gems)||0)+(Number(target.gem)||0);
    st.xp=(Number(st.xp)||0)+xpGain;
    SH_save();
    SH_renderHome();
    SH_toast("領取成功！+"+target.coin+" 🪙、+"+target.gem+" 💎、+"+xpGain+" ✨","🎁");
    SH_confetti(24);
    /* 當日任務全部領完 → 額外寶石 */
    let all=true;
    for(let i=0;i<q.list.length;i++)if(!q.list[i].claimed)all=false;
    if(all&&!q.bonus){
      q.bonus=true;
      st.gems=(Number(st.gems)||0)+SHQ_BONUS_GEM;
      SH_save();
      SH_toast("🎉 今日任務全數完成，額外 +"+SHQ_BONUS_GEM+" 💎","💎");
      SH_confetti(40);
    }
    try{
      const lv=SH_win("level"),up=SH_win("levelUp");
      if(lv&&up){const after=lv();if(after>beforeLv)up(after)}
    }catch(e){}
    SHOP_renderIfOpen();
    return true;
  }catch(e){return false}
}
/* ---- 事件入口（index.html 的答題／學習流程呼叫） ---- */
function SHQ_onAnswer(ok,mode){
  try{
    const st=SH_state();
    if(!st)return false;
    if(ok)SHQ_ev.correct+=1;
    if(mode==="listen"||mode==="audio")SHQ_ev.listen+=1;
    SHQ_sync();
    return true;
  }catch(e){return false}
}
function SHQ_onQuizEnd(mode){
  try{
    const st=SH_state();
    if(!st)return false;
    if(mode==="listen"||mode==="mix"||mode==="mock")SHQ_ev.listen+=1;
    SHQ_sync();
    return true;
  }catch(e){return false}
}
function SHQ_onWords(n){
  try{
    const st=SH_state();
    if(!st)return false;
    SHQ_ev.words+=Number(n)||0;
    SHQ_sync();
    return true;
  }catch(e){return false}
}
function SHQ_onWin(){
  try{
    const st=SH_state();
    if(!st)return false;
    SHQ_ev.win+=1;
    SHQ_sync();
    return true;
  }catch(e){return false}
}

/* ===================== 道具：庫存 ===================== */
function SHP_avail(id){
  try{
    const st=SH_state();
    if(!st)return 0;
    const n=Number(st.items[id]);
    return (isFinite(n)&&n>0)?Math.floor(n):0;
  }catch(e){return 0}
}
function SHP_take(id){
  try{
    const st=SH_state();
    if(!st)return false;
    const n=SHP_avail(id);
    if(n<1)return false;
    st.items[id]=n-1;
    SH_save();
    return true;
  }catch(e){return false}
}
/* 購買：currency = "coin"（預設）或 "gem" */
function SHP_buy(id,currency){
  try{
    const st=SH_state();
    if(!st){SH_toast("遊戲狀態尚未載入","⚠️");return false}
    const cur=(currency==="gem")?"gem":"coin";
    const it=SH_ITEM_MAP[id];
    if(!it){SH_toast("找不到這個道具","⚠️");return false}
    const price=(cur==="gem")?Number(it.gem):Number(it.coin);
    const have=(cur==="gem")?(Number(st.gems)||0):(Number(st.coins)||0);
    if(have<price){
      SH_toast(cur==="gem"?"💎 寶石不足，完成每日任務可獲得寶石":"🪙 金幣不足，去作答測驗賺金幣吧",
               cur==="gem"?"💎":"🪙");
      return false;
    }
    if(cur==="gem")st.gems=have-price;
    else st.coins=have-price;
    st.items[id]=(Number(st.items[id])||0)+1;
    SH_save();
    SH_renderHome();
    SHOP_renderIfOpen();
    SH_toast("購買成功！"+it.icon+it.name+" ×1（庫存 "+SHP_avail(id)+"）","🛒");
    return true;
  }catch(e){return false}
}
/* 使用：
   - 🔥 經驗加成：立刻消耗 1 個並啟動 30 分鐘 XP×2
   - 其他道具：答題流程中會自動消耗（這裡只確認庫存並提示，回傳 true 表示「已就緒」） */
function SHP_use(id){
  try{
    const st=SH_state();
    if(!st){SH_toast("遊戲狀態尚未載入","⚠️");return false}
    const it=SH_ITEM_MAP[id];
    if(!it){SH_toast("找不到這個道具","⚠️");return false}
    if(SHP_avail(id)<1){SH_toast("庫存不足，先到商店購買","🛒");return false}
    if(id==="xp"){
      if(!SHP_take("xp"))return false;
      const now=Date.now();
      const base=Math.max(Number(st.xpBoostUntil)||0,now);
      st.xpBoostUntil=base+SH_XP_BOOST_MS;
      SH_save();
      SHOP_renderIfOpen();
      SH_toast("🔥 經驗加成啟動！30 分鐘內 XP ×2","🔥");
      SH_confetti(18);
      return true;
    }
    SH_toast(it.icon+" "+it.name+"：答題時會自動生效（庫存 "+SHP_avail(id)+"）","ℹ️");
    return true;
  }catch(e){return false}
}
/* 寶石兌換：300 🪙 → 1 💎（每日 "+SH_EX_CAP+" 次） */
function SHP_exchange(){
  try{
    const st=SH_state();
    if(!st){SH_toast("遊戲狀態尚未載入","⚠️");return false}
    const t=SH_today();
    if(!st.gemEx||st.gemEx.date!==t)st.gemEx={date:t,n:0};
    if((Number(st.gemEx.n)||0)>=SH_EX_CAP){
      SH_toast("今天的寶石兌換次數用完了，明天再來","💎");return false;
    }
    const coins=Number(st.coins)||0;
    if(coins<SH_EX_RATE){SH_toast("🪙 金幣不足（需要 "+SH_EX_RATE+" 金幣）","🪙");return false}
    st.coins=coins-SH_EX_RATE;
    st.gems=(Number(st.gems)||0)+1;
    st.gemEx.n=(Number(st.gemEx.n)||0)+1;
    SH_save();
    SH_renderHome();
    SHOP_renderIfOpen();
    SH_toast("兌換成功！獲得 1 💎（今日 "+st.gemEx.n+"/"+SH_EX_CAP+" 次）","💎");
    return true;
  }catch(e){return false}
}

/* ===================== 道具生效 hooks（不足時優雅回傳 falsy） ===================== */
/* 聽力重聽券：可多聽一次並扣庫存 */
function SHOP_extraListen(){
  try{
    if(!SH_state())return false;
    if(SHP_avail("replay")<1){SH_toast("🎧 沒有重聽券了，去商店買一張吧","🛒");return false}
    if(!SHP_take("replay"))return false;
    SH_toast("🎧 重聽券生效：本題可再多聽 1 次","🎧");
    SHOP_renderIfOpen();
    return true;
  }catch(e){return false}
}
/* 時間延長券：給目前題目加秒。可傳入目標物件（如 QZ），不傳則找全域 QZ/MK */
function SHOP_addTime(sec,target){
  try{
    if(!SH_state())return false;
    const add=(typeof sec==="number"&&isFinite(sec)&&sec>0)?sec:10;
    let t=null;
    if(target&&typeof target==="object"&&typeof target.time==="number")t=target;
    if(!t){
      try{if(typeof QZ!=="undefined"&&QZ&&typeof QZ.time==="number")t=QZ}catch(e){}
    }
    if(!t){
      try{if(typeof MK!=="undefined"&&MK&&typeof MK.time==="number")t=MK}catch(e){}
    }
    if(!t){SH_toast("⏱️ 現在沒有可以延長的題目","⏱️");return false}
    if(SHP_avail("time")<1){SH_toast("⏱️ 沒有時間延長券了，去商店買一張吧","🛒");return false}
    if(!SHP_take("time"))return false;
    t.time+=add;
    try{if(typeof QZ!=="undefined"&&t===QZ)SH_call("updateTimer")}catch(e){}
    SH_toast("⏱️ 時間延長券生效：+"+add+" 秒","⏱️");
    SHOP_renderIfOpen();
    return true;
  }catch(e){return false}
}
/* 提示券：回傳要排除的錯誤選項索引（-1 = 無道具／無法判斷）。
   可傳入 (正確索引, 選項數)，不傳則自動從全域 QZ 取得目前題目 */
function SHOP_hint(correctIdx,count){
  try{
    if(!SH_state())return -1;
    if(typeof correctIdx!=="number"){
      try{
        if(typeof QZ!=="undefined"&&QZ&&QZ.qs&&QZ.qs[QZ.i]){
          const q=QZ.qs[QZ.i];
          correctIdx=Number(q.a);
          if(typeof count!=="number")count=Array.isArray(q.o)?q.o.length:0;
        }
      }catch(e){}
    }
    if(typeof correctIdx!=="number"||typeof count!=="number"||count<2||!isFinite(correctIdx)){
      SH_toast("💡 目前無法使用提示","💡");return -1;
    }
    if(SHP_avail("hint")<1){SH_toast("💡 沒有提示券了，去商店買一張吧","🛒");return -1}
    const wrongs=[];
    for(let i=0;i<count;i++)if(i!==correctIdx)wrongs.push(i);
    if(!wrongs.length){SH_toast("💡 目前無法使用提示","💡");return -1}
    const idx=wrongs[Math.floor(Math.random()*wrongs.length)];
    if(!SHP_take("hint"))return -1;
    SH_toast("💡 提示券生效：已排除一個錯誤選項","💡");
    SHOP_renderIfOpen();
    return idx;
  }catch(e){return -1}
}
/* 護盾券：抵銷一次傷害並扣庫存 */
function SHOP_shield(){
  try{
    if(!SH_state())return false;
    if(SHP_avail("shield")<1){SH_toast("🛡️ 沒有護盾券了，去商店買一張吧","🛒");return false}
    if(!SHP_take("shield"))return false;
    SH_toast("🛡️ 護盾生效：本題不扣 HP！","🛡️");
    SHOP_renderIfOpen();
    return true;
  }catch(e){return false}
}
/* 目前 XP 倍率（1 或 2） */
function SHOP_xpMult(){
  try{
    const st=SH_state();
    if(!st)return 1;
    const u=Number(st.xpBoostUntil)||0;
    if(u<=0)return 1;
    if(u<=Date.now()){st.xpBoostUntil=0;return 1}
    return 2;
  }catch(e){return 1}
}
/* 套用倍率後的 XP（給 index.html 發獎時用） */
function SHOP_applyXp(n){
  n=Number(n)||0;
  try{return Math.round(n*SHOP_xpMult())}catch(e){return n}
}
/* 經驗加成剩餘秒數（0 = 未啟用） */
function SHOP_xpBoostLeft(){
  try{
    const st=SH_state();
    if(!st)return 0;
    const u=Number(st.xpBoostUntil)||0;
    return u>Date.now()?Math.ceil((u-Date.now())/1000):0;
  }catch(e){return 0}
}

/* ===================== 畫面 ===================== */
function SH_screen(){
  try{
    if(typeof document==="undefined")return null;
    return document.getElementById("scr-shop");
  }catch(e){return null}
}
function SH_mountScreen(){
  try{
    if(typeof document==="undefined")return false;
    let el=SH_screen();
    if(!el){
      el=document.createElement("div");
      el.id="scr-shop";
      el.className="screen";
      const host=(typeof document.getElementById==="function"&&document.getElementById("app"))||document.body;
      if(host&&host.appendChild)host.appendChild(el);
      else if(document.body&&document.body.appendChild)document.body.appendChild(el);
    }
    return true;
  }catch(e){return false}
}
function SH_fmtTime(s){
  const m=Math.floor(s/60),x=s%60;
  return m?m+" 分 "+String(x).padStart(2,"0")+" 秒":x+" 秒";
}
function SHOP_render(){
  try{
    SH_mountScreen();
    const scr=SH_screen();
    if(!scr)return false;
    const st=SH_state();
    if(!st)return false;
    const q=SHQ_ensure();
    if(!q)return false;
    const mult=SHOP_xpMult();
    const left=SHOP_xpBoostLeft();
    const items=st.items;
    let h="";
    h+='<button class="back-btn" onclick="go(\'scr-home\')">‹ 返回大廳</button>';
    h+='<div class="sec-title">🛒 商店與每日任務</div>';
    h+='<div class="sec-sub">用金幣或寶石換道具，完成每日任務領取 🪙、💎 與 ✨ XP</div>';
    /* -- 錢包 -- */
    h+='<div class="sh-wallet">'+
       '<span class="sh-chip">🪙 <b>'+SH_esc(Number(st.coins)||0)+'</b></span>'+
       '<span class="sh-chip gem">💎 <b>'+SH_esc(Number(st.gems)||0)+'</b></span>'+
       '<span class="sh-chip boost'+(mult>1?" on":"")+'">🔥 XP ×'+mult+
       (left>0?" <b>"+SH_fmtTime(left)+"</b>":"")+'</span>'+
       '</div>';
    /* -- 寶石兌換 -- */
    const exN=(st.gemEx&&st.gemEx.date===SH_today())?(Number(st.gemEx.n)||0):0;
    const exCan=(Number(st.coins)||0)>=SH_EX_RATE&&exN<SH_EX_CAP;
    h+='<div class="sh-ex"><div class="sh-ex-t">💎 寶石兌換</div>'+
       '<div class="sh-ex-d">'+SH_EX_RATE+' 🪙 換 1 💎　·　每日 '+SH_EX_CAP+' 次（今日 '+exN+'/'+SH_EX_CAP+'）</div>'+
       '<button class="sh-buy gem" onclick="SHP_exchange()"'+(exCan?"":" disabled")+'>💎 兌換 1 顆</button>'+
       '</div>';
    /* -- 道具 -- */
    h+='<div class="sh-sec-title">🎒 道具<span class="sh-reset">金幣 🪙 或寶石 💎 皆可購買</span></div>';
    h+='<div class="sh-grid">';
    SH_ITEMS.forEach(function(it,i){
      const n=(Number(items[it.id])||0);
      h+='<div class="sh-item'+(n>0?" has":"")+'" style="animation-delay:'+(i*.04)+'s">'+
         '<div class="sh-ico">'+it.icon+'</div>'+
         '<div class="sh-body">'+
           '<div class="sh-name">'+SH_esc(it.name)+
             '<span class="sh-stock'+(n>0?"":" empty")+'">庫存 '+n+'</span></div>'+
           '<div class="sh-desc">'+SH_esc(it.desc)+'</div>'+
           '<div class="sh-acts">'+
             '<button class="sh-buy coin" onclick="SHP_buy(\''+it.id+'\',\'coin\')">🪙 '+it.coin+'</button>'+
             '<button class="sh-buy gem" onclick="SHP_buy(\''+it.id+'\',\'gem\')">💎 '+it.gem+'</button>'+
             '<button class="sh-use" onclick="SHP_use(\''+it.id+'\')"'+(n>0?"":" disabled")+'>使用</button>'+
           '</div>'+
         '</div>'+
       '</div>';
    });
    h+='</div>';
    /* -- 每日任務 -- */
    let claimedN=0,doneN=0;
    q.list.forEach(function(x){if(x.claimed)claimedN++;else if(x.done)doneN++});
    h+='<div class="sh-sec-title">📅 每日任務<span class="sh-reset">每日 00:00 自動重置</span></div>';
    h+='<div class="sh-quests">';
    q.list.forEach(function(x,i){
      const pct=x.goal>0?Math.min(100,Math.round(x.prog/x.goal*100)):0;
      const cls="sh-quest"+(x.claimed?" claimed":x.done?" done":"");
      h+='<div class="'+cls+'" style="animation-delay:'+(i*.05)+'s">'+
         '<div class="sh-q-head"><span class="sh-q-desc">'+SH_esc(x.desc)+'</span>'+
         '<span class="sh-q-rw">🪙'+(Number(x.coin)||0)+' 💎'+(Number(x.gem)||0)+' ✨'+(Number(x.xp)||0)+'</span></div>'+
         '<div class="sh-bar"><div class="sh-bar-fill" style="width:'+pct+'%"></div></div>'+
         '<div class="sh-q-foot"><span class="sh-q-prog">'+Math.min(x.prog,x.goal)+' / '+x.goal+'（'+pct+'%）</span>'+
         (x.claimed?'<button class="sh-claim" disabled>✅ 已領取</button>'
           :x.done?'<button class="sh-claim ready" onclick="SHQ_claim(\''+x.id+'\')">🎁 領取獎勵</button>'
           :'<button class="sh-claim" disabled>進行中</button>')+
         '</div>'+
       '</div>';
    });
    h+='</div>';
    if(claimedN===q.list.length)
      h+='<div class="sh-done-note">🎉 今日任務全數完成！寶石已入帳，明天再來挑戰</div>';
    else if(doneN>0)
      h+='<div class="sh-done-note">🎁 有 '+doneN+' 個任務可以領獎了</div>';
    h+='<div class="mini-note">💡 道具會在答題流程中自動生效；🔥 經驗加成啟動後 30 分鐘內所有 XP 獲得 ×2<br>'+
       '📅 每日任務每天 00:00 重置，全部領完再送 '+SHQ_BONUS_GEM+' 💎</div>';
    scr.innerHTML=h;
    return true;
  }catch(e){return false}
}
function SHOP_renderIfOpen(){
  try{
    const scr=SH_screen();
    if(!scr)return false;
    if(scr.classList&&typeof scr.classList.contains==="function"&&scr.classList.contains("active"))
      return SHOP_render();
  }catch(e){}
  return false;
}
function SHOP_open(){
  try{
    SH_injectCSS();
    SH_mountScreen();
    SHQ_ensure();
  }catch(e){}
  try{SH_call("go",["scr-shop"])}catch(e){}
  return SHOP_render();
}

/* ===================== 注入 ===================== */
function SH_injectCSS(){
  try{
    if(typeof document==="undefined")return false;
    if(document.getElementById("sh-css"))return false;
    const s=document.createElement("style");
    s.id="sh-css";
    s.textContent=SH_CSS;
    const head=document.head||(document.getElementsByTagName&&document.getElementsByTagName("head")[0])||document.body;
    if(head&&head.appendChild)head.appendChild(s);
    else if(document.body&&document.body.appendChild)document.body.appendChild(s);
    return true;
  }catch(e){return false}
}
function SH_boot(){
  SH_injectCSS();
  SH_mountScreen();
  try{SHQ_ensure()}catch(e){}
}
SH_boot();

/* ===================== 對外掛載 window.* ===================== */
if(typeof window!=="undefined"){
  try{
    /* 整合入口 */
    window.SHOP_open=SHOP_open;
    window.SHOP_render=SHOP_render;
    /* 道具生效 hooks */
    window.SHOP_extraListen=SHOP_extraListen;
    window.SHOP_addTime=SHOP_addTime;
    window.SHOP_hint=SHOP_hint;
    window.SHOP_shield=SHOP_shield;
    window.SHOP_xpMult=SHOP_xpMult;
    window.SHOP_applyXp=SHOP_applyXp;
    window.SHOP_xpBoostLeft=SHOP_xpBoostLeft;
    /* 目前道具庫存（用來避免對戰每題盲呼叫 hook 觸發提示） */
    window.SHOP_has=function(id){try{return SHP_avail(id)>0}catch(e){return false}};
    window.SHOP_count=function(id){try{return SHP_avail(id)}catch(e){return 0}};
    /* 每日任務 */
    window.SHQ_sync=SHQ_sync;
    window.SHQ_claim=SHQ_claim;
    window.SHQ_ensure=SHQ_ensure;
    window.SHQ_onAnswer=SHQ_onAnswer;
    window.SHQ_onQuizEnd=SHQ_onQuizEnd;
    window.SHQ_onWords=SHQ_onWords;
    window.SHQ_onWin=SHQ_onWin;
    /* 商店 */
    window.SHP_buy=SHP_buy;
    window.SHP_use=SHP_use;
    window.SHP_exchange=SHP_exchange;
    window.SH_injectCSS=SH_injectCSS;
  }catch(e){}
}
