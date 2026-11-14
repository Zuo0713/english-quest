/* shop.js 單元測試：node test-shop.js
   用最小 DOM stub 在 Node VM 中載入 shop.js，驗證：
   1) 語法（node --check）  2) 每日任務跨日重置  3) 進度推進（含不重複計算）
   4) 領獎防重複  5) 購買扣款／庫存／錢不足  6) 道具 hook 庫存不足回傳 falsy 不拋錯
   7) XP 倍率  8) 寶石兌換  9) 畫面渲染 */
"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path");
const {spawnSync}=require("child_process");
const FILE=path.join(__dirname,"shop.js");

/* ==================== 斷言工具 ==================== */
let pass=0,fail=0;const fails=[];
function t(name,fn){
  try{fn();pass++;console.log("  ✔ "+name)}
  catch(e){fail++;fails.push(name);console.log("  ✘ "+name+" → "+(e&&e.message))}
}
function eq(a,b,msg){if(a!==b)throw new Error((msg||"")+"　期望 "+JSON.stringify(b)+"，實際 "+JSON.stringify(a))}
function ok(c,msg){if(!c)throw new Error(msg||"斷言失敗")}

/* ==================== 0) 語法檢查 ==================== */
console.log("\n== 0) 語法檢查 ==");
const chk=spawnSync(process.execPath,["--check",FILE],{encoding:"utf8"});
t("node --check shop.js 無語法錯誤",()=>{
  eq(chk.status,0,(chk.stderr||"").trim());
});

/* ==================== 最小 DOM / 全域 stub ==================== */
const nodes={};
function mkEl(tag){
  const e={
    tagName:String(tag||"div").toUpperCase(),id:"",className:"",textContent:"",disabled:false,
    style:{},dataset:{},children:[],parentNode:null,_html:"",_attrs:{},
    classList:{
      _s:new Set(),
      add:function(){for(let i=0;i<arguments.length;i++)this._s.add(arguments[i])},
      remove:function(){for(let i=0;i<arguments.length;i++)this._s.delete(arguments[i])},
      toggle:function(c,f){if(f===undefined){this._s.has(c)?this._s.delete(c):this._s.add(c)}else if(f)this._s.add(c);else this._s.delete(c)},
      contains:function(c){return this._s.has(c)}
    },
    setAttribute:function(k,v){this._attrs[k]=v;if(k==="id"){this.id=v;if(v)nodes[v]=this}},
    getAttribute:function(k){return k in this._attrs?this._attrs[k]:null},
    appendChild:function(c){this.children.push(c);c.parentNode=this;if(c&&c.id)nodes[c.id]=c;return c},
    removeChild:function(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);return c},
    remove:function(){},
    querySelector:function(){return null},
    querySelectorAll:function(){return []},
    addEventListener:function(){},
    focus:function(){},
    get innerHTML(){return this._html},
    set innerHTML(v){this._html=String(v)}
  };
  return e;
}
const app=mkEl("div");app.id="app";nodes["app"]=app;
const head=mkEl("head"),body=mkEl("body");
const document={
  getElementById:id=>(id?nodes[id]:null),
  createElement:mkEl,
  querySelector:()=>null,
  querySelectorAll:()=>[],
  addEventListener:()=>{},
  getElementsByTagName:t=>(t==="head"?[head]:[]),
  head:head,body:body
};

/* 可控日期 */
let CUR_DATE="2026-11-12";
function nextDay(d){
  const p=d.split("-").map(Number);
  const dt=new Date(p[0],p[1]-1,p[2]+1);
  return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");
}
/* 記錄用 */
const toasts=[],goes=[];let confettis=0,saves=0;
/* index.html 掛在 window 上的函式（shop.js 全部透過 window.* 呼叫） */
const windowStub={
  toast:(m)=>{toasts.push(String(m))},
  save:()=>{saves++},
  go:(id)=>{goes.push(id)},
  confetti:()=>{confettis++},
  addCoins:(n)=>{windowStubState().coins+=n;saves++},
  renderHome:()=>{},
  level:()=>1,
  levelUp:()=>{},
  updateTimer:()=>{},
  esc:s=>String(s),
  today:()=>CUR_DATE,
  dayStr:o=>o===0?CUR_DATE:nextDay(CUR_DATE),
  pick:(a,n)=>a.slice(0,n),
  shuffle:a=>a.slice(),
  DAILY:[{d:1,c:30,x:15,i:"🪙"}]
};
function windowStubState(){return ctx.S}   /* addCoins 需要目前的 S */
/* 舊存檔：沒有 gems / items / xpBoostUntil / quests / gemEx */
const ctx={
  console:console,
  document:document,
  window:windowStub,
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  localStorage:{_m:{},getItem(k){return k in this._m?this._m[k]:null},setItem(k,v){this._m[k]=String(v)},removeItem(k){delete this._m[k]}},
  S:{name:"測試玩家",xp:0,coins:0,streak:0,correct:0,total:0,words:0,wins:0,battles:0,items:{}}
};
vm.createContext(ctx);
const SRC=fs.readFileSync(FILE,"utf8");
vm.runInContext(SRC,ctx,{filename:"shop.js"});

/* 便捷呼叫（function 宣告會成為 context 全域） */
const g=n=>ctx[n];

/* ==================== 1) 載入與掛載 ==================== */
console.log("\n== 1) 載入 / CSS / 畫面 / 對外 API ==");
t("注入 CSS（id=sh-css，僅一次）",()=>{
  ok(nodes["sh-css"],"未找到 style#sh-css");
  eq(nodes["sh-css"].tagName,"STYLE");
  ok(String(nodes["sh-css"].textContent).indexOf(".sh-item")>=0,"CSS 內容不完整");
  eq(g("SH_injectCSS")(),false,"重複注入應回傳 false");
});
t("自動建立 scr-shop 畫面",()=>{
  const scr=nodes["scr-shop"];
  ok(scr,"未建立 #scr-shop");
  ok(scr.className.split(/\s+/).indexOf("screen")>=0,"應含 .screen class");
  eq(scr.parentNode,app,"應插入 #app");
});
t("window.* hooks 全數掛載",()=>{
  ["SHOP_open","SHOP_render","SHOP_extraListen","SHOP_addTime","SHOP_hint","SHOP_shield",
   "SHOP_xpMult","SHOP_applyXp","SHOP_xpBoostLeft","SHQ_sync","SHQ_claim","SHQ_ensure",
   "SHQ_onAnswer","SHQ_onQuizEnd","SHQ_onWords","SHQ_onWin","SHP_buy","SHP_use","SHP_exchange",
   "SH_injectCSS"].forEach(k=>{
    eq(typeof windowStub[k],"function","window."+k+" 未掛載");
  });
});

/* ==================== 2) 防禦性初始化 ==================== */
console.log("\n== 2) 舊存檔防禦性初始化 ==");
t("S 新欄位自動補齊",()=>{
  eq(ctx.S.gems,0,"S.gems");
  ok(ctx.S.items&&typeof ctx.S.items==="object","S.items");
  eq(ctx.S.xpBoostUntil,0,"S.xpBoostUntil");
  ok(ctx.S.quests&&Array.isArray(ctx.S.quests.list),"S.quests");
  ok(ctx.S.gemEx&&typeof ctx.S.gemEx==="object","S.gemEx");
});
t("每日任務建立（日期=今天、4 個任務、進度 0）",()=>{
  const q=ctx.S.quests;
  eq(q.date,CUR_DATE);
  eq(q.list.length,4);
  q.list.forEach(x=>{
    ok(x.id&&x.desc&&x.kind,"任務欄位缺失");
    ok(typeof x.goal==="number"&&x.goal>0,"goal 錯誤");
    eq(x.prog,0);eq(x.done,false);eq(x.claimed,false);
    ok(typeof x.gem==="number"&&typeof x.coin==="number"&&typeof x.xp==="number","獎勵欄位缺失");
  });
});

/* ==================== 3) 進度推進 ==================== */
console.log("\n== 3) 進度推進（事件 hook + S 統計備援） ==");
t("答錯不推進",()=>{
  g("SHQ_onAnswer")(false,"read");
  eq(qOf("right10").prog,0);
});
t("答對 10 題（事件+統計同時來）→ prog 恰為 10（不重複計算）",()=>{
  for(let i=0;i<10;i++){ctx.S.correct++;g("SHQ_onAnswer")(true,"read")}
  const q=qOf("right10");
  eq(q.prog,10,"prog 不應重複計算");
  eq(q.done,true);
});
t("重複呼叫 SHQ_sync() 不會再多算",()=>{
  g("SHQ_sync")();g("SHQ_sync")();
  eq(qOf("right10").prog,10);
});
t("聽力作答 3 題 → 聽力任務完成",()=>{
  g("SHQ_onAnswer")(true,"listen");
  g("SHQ_onAnswer")(false,"listen");   /* 答錯也算作答 */
  g("SHQ_onAnswer")(true,"listen");
  const q=qOf("listen3");
  eq(q.prog,3);eq(q.done,true);
});
t("背 5 個單字（S.words + SHQ_onWords）→ prog 恰為 5",()=>{
  ctx.S.words+=5;
  g("SHQ_onWords")(5);
  eq(qOf("words5").prog,5);
});
t("贏 1 場對戰（S.wins + SHQ_onWin）→ prog 恰為 1",()=>{
  ctx.S.wins++;
  g("SHQ_onWin")();
  eq(qOf("win1").prog,1);eq(qOf("win1").done,true);
});
t("未達標任務維持原進度",()=>{
  eq(qOf("words5").done,true);
  g("SHQ_onAnswer")(true,"read");      /* right10 已滿，不再增加 */
  eq(qOf("right10").prog,10);
});

/* ==================== 4) 畫面渲染 ==================== */
console.log("\n== 4) 商店畫面渲染 ==");
t("SHOP_open() 進出 scr-shop 並渲染",()=>{
  eq(g("SHOP_open")(),true);
  ok(goes.indexOf("scr-shop")>=0,"未呼叫 go('scr-shop')");
  nodes["scr-shop"].classList.add("active");
  const h=nodes["scr-shop"].innerHTML;
  ["聽力重聽券","時間延長券","提示券","護盾券","經驗加成","每日任務","庫存","領取獎勵","💎"].forEach(s=>{
    ok(h.indexOf(s)>=0,"畫面缺少："+s);
  });
  ok(h.indexOf('onclick="SHP_buy(')>=0,"缺少購買按鈕");
  ok(h.indexOf('onclick="SHQ_claim(')>=0,"缺少領獎按鈕");
});
t("渲染出的 HTML 標籤配對正確",()=>{
  g("SHOP_render")();
  const h=nodes["scr-shop"].innerHTML;
  ["div","button","span","b"].forEach(tag=>{
    const open=(h.match(new RegExp("<"+tag+"(\\s|>)","g"))||[]).length;
    const close=(h.match(new RegExp("</"+tag+">","g"))||[]).length;
    eq(close,open,tag+" 標籤數不配對（開 "+open+" / 閉 "+close+"）");
  });
  ok(h.indexOf("<undefined")<0&&h.indexOf("NaN")<0,"渲染出現 undefined/NaN");
});

/* ==================== 5) 領獎（防重複） ==================== */
console.log("\n== 5) 領取每日任務獎勵 ==");
const beforeAll={c:ctx.S.coins,g:ctx.S.gems,x:ctx.S.xp};
t("首次領獎：金幣／寶石／XP 皆入帳",()=>{
  eq(g("SHQ_claim")("right10"),true);
  eq(ctx.S.coins,beforeAll.c+40);
  eq(ctx.S.gems,beforeAll.g+1);
  eq(ctx.S.xp,beforeAll.x+30);
  eq(qOf("right10").claimed,true);
});
t("重複領獎被擋下且不發放",()=>{
  const snap={c:ctx.S.coins,g:ctx.S.gems,x:ctx.S.xp};
  eq(g("SHQ_claim")("right10"),false);
  eq(ctx.S.coins,snap.c);eq(ctx.S.gems,snap.g);eq(ctx.S.xp,snap.x);
  ok(toasts.some(m=>m.indexOf("領過")>=0),"應提示已領過");
});
t("領取其餘 3 個任務後額外寶石只發一次",()=>{
  ["listen3","words5","win1"].forEach(id=>eq(g("SHQ_claim")(id),true,id));
  eq(ctx.S.coins,beforeAll.c+40+30+50+60);
  eq(ctx.S.gems,beforeAll.g+1+1+2+2+3,"含全勤 bonus 3 寶石");
  eq(ctx.S.xp,beforeAll.x+30+25+40+50);
  const snap=ctx.S.gems;
  eq(g("SHQ_claim")("win1"),false);
  eq(ctx.S.gems,snap,"bonus 不重複發放");
});
t("畫面顯示已領取／全數完成",()=>{
  g("SHOP_render")();
  const h=nodes["scr-shop"].innerHTML;
  ok(h.indexOf("已領取")>=0,"缺少已領取狀態");
  ok(h.indexOf("全數完成")>=0,"缺少全數完成提示");
});

/* ==================== 6) 跨日重置 ==================== */
console.log("\n== 6) 跨日自動重置 ==");
const day1Stats={correct:ctx.S.correct,words:ctx.S.words,wins:ctx.S.wins};
t("日期改變 → 任務歸零、領取狀態清除",()=>{
  CUR_DATE=nextDay(CUR_DATE);
  g("SHQ_sync")();
  const q=ctx.S.quests;
  eq(q.date,CUR_DATE);
  eq(q.list.length,4);
  q.list.forEach(x=>{eq(x.prog,0);eq(x.done,false);eq(x.claimed,false)});
  eq(!!q.bonus,false);
});
t("未完成任務不可領獎",()=>{
  eq(g("SHQ_claim")("right10"),false);
  ok(toasts.some(m=>m.indexOf("還沒完成")>=0),"應提示任務未完成");
});
t("只靠 S 統計差量也能推進（沒呼叫事件 hook 的備援）",()=>{
  ctx.S.correct+=3;
  g("SHQ_sync")();
  eq(qOf("right10").prog,3);
  ctx.S.words+=2;
  g("SHQ_sync")();
  eq(qOf("words5").prog,2);
  eq(qOf("win1").prog,0);
});
t("隔日只用事件 hook 也能推進",()=>{
  CUR_DATE=nextDay(CUR_DATE);
  g("SHQ_sync")();
  g("SHQ_onAnswer")(true,"read");
  g("SHQ_onAnswer")(true,"read");
  eq(qOf("right10").prog,2,"事件推進");
  eq(ctx.S.quests.bonus,false);
});

/* ==================== 7) 商店購買 ==================== */
console.log("\n== 7) 商店購買（扣款 / 庫存 / 錢不足） ==");
function resetMoney(coins,gems){ctx.S.coins=coins;ctx.S.gems=gems;ctx.S.items={}}
t("金幣購買：扣款 + 庫存 +1",()=>{
  resetMoney(100,5);
  eq(g("SHP_buy")("time","coin"),true);
  eq(ctx.S.coins,50);
  eq(ctx.S.items.time,1);
});
t("預設以金幣購買（省略第二參數）",()=>{
  eq(g("SHP_buy")("hint"),true);
  eq(ctx.S.coins,10);
  eq(ctx.S.items.hint,1);
});
t("金幣不足 → 不購買、不扣款、庫存不變",()=>{
  const snap=ctx.S.coins;
  eq(g("SHP_buy")("replay","coin"),false);   /* 需 60，只有 10 */
  eq(ctx.S.coins,snap);
  eq(ctx.S.items.replay,undefined);
  ok(toasts.some(m=>m.indexOf("金幣不足")>=0),"應提示金幣不足");
});
t("寶石購買：扣寶石 + 庫存 +1",()=>{
  resetMoney(0,5);
  eq(g("SHP_buy")("xp","gem"),true);
  eq(ctx.S.gems,2);
  eq(ctx.S.items.xp,1);
});
t("寶石不足 → 不購買",()=>{
  resetMoney(1000,1);
  eq(g("SHP_buy")("replay","gem"),false);    /* 需 2 寶石 */
  eq(ctx.S.gems,1);
  eq(ctx.S.items.replay,undefined);
  ok(toasts.some(m=>m.indexOf("寶石不足")>=0),"應提示寶石不足");
});
t("不存在的道具 → false 不拋錯",()=>{
  eq(g("SHP_buy")("nope","coin"),false);
});
t("購買後畫面庫存即時更新",()=>{
  resetMoney(500,10);
  g("SHP_buy")("shield","coin");
  g("SHOP_render")();
  ok(nodes["scr-shop"].innerHTML.indexOf("庫存 1")>=0,"畫面未顯示庫存");
});

/* ==================== 8) 道具 hooks ==================== */
console.log("\n== 8) 道具生效 hooks（庫存不足 → falsy、不拋錯） ==");
t("無庫存時全部回傳 falsy 且不拋錯",()=>{
  ctx.S.items={};
  eq(windowStub.SHOP_extraListen(),false);
  eq(windowStub.SHOP_shield(),false);
  const timer={time:20};
  eq(windowStub.SHOP_addTime(10,timer),false);
  eq(timer.time,20,"不能延長卻仍應保持原時間");
  eq(windowStub.SHOP_hint(0,4),-1);
  eq(windowStub.SHOP_hint(),-1);
  eq(windowStub.SHOP_xpMult(),1);
  eq(windowStub.SHOP_applyXp(50),50);
  eq(windowStub.SHOP_xpBoostLeft(),0);
});
t("無可延長的題目（無 target、無 QZ）→ false 且不扣庫存",()=>{
  ctx.S.items={time:1};
  eq(windowStub.SHOP_addTime(10),false);
  eq(ctx.S.items.time,1);
});
t("🎧 聽力重聽券：扣庫存一次後失效",()=>{
  ctx.S.items={replay:1};
  eq(windowStub.SHOP_extraListen(),true);
  eq(ctx.S.items.replay,0);
  eq(windowStub.SHOP_extraListen(),false);
});
t("⏱️ 時間延長券：題目 +10 秒並扣庫存",()=>{
  ctx.S.items={time:1};
  const q={time:20};
  eq(windowStub.SHOP_addTime(10,q),true);
  eq(q.time,30);
  eq(ctx.S.items.time,0);
  eq(windowStub.SHOP_addTime(10,q),false);
  eq(q.time,30);
});
t("💡 提示券：回傳錯誤選項索引且不等於正確答案",()=>{
  ctx.S.items={hint:1};
  const idx=windowStub.SHOP_hint(0,4);
  ok(idx>=1&&idx<=3,"回傳索引 "+idx+" 應在 1~3");
  eq(ctx.S.items.hint,0);
  eq(windowStub.SHOP_hint(0,4),-1);
});
t("💡 未傳參數時自動從全域 QZ 取目前題目",()=>{
  ctx.QZ={i:0,qs:[{a:2,o:["A","B","C","D"]}]};
  ctx.S.items={hint:1};
  const idx=windowStub.SHOP_hint();
  ok(idx===0||idx===1||idx===3,"回傳 "+idx+" 應排除正確答案 2");
  eq(ctx.S.items.hint,0);
  delete ctx.QZ;
});
t("🛡️ 護盾券：抵銷一次後失效",()=>{
  ctx.S.items={shield:1};
  eq(windowStub.SHOP_shield(),true);
  eq(ctx.S.items.shield,0);
  eq(windowStub.SHOP_shield(),false);
});
t("S 尚未載入時（S=undefined）所有 hook 安全回傳 falsy",()=>{
  const keep=ctx.S;
  ctx.S=undefined;
  eq(windowStub.SHOP_extraListen(),false);
  eq(windowStub.SHOP_shield(),false);
  eq(windowStub.SHOP_addTime(10,{time:1}),false);
  eq(windowStub.SHOP_hint(0,4),-1);
  eq(windowStub.SHOP_xpMult(),1);
  eq(g("SHQ_sync")(),false);
  eq(g("SHQ_claim")("right10"),false);
  eq(g("SHP_buy")("time","coin"),false);
  eq(g("SHP_use")("xp"),false);
  eq(g("SHOP_open")(),false);
  ctx.S=keep;
  ok(true);
});

/* ==================== 9) XP 加成 ==================== */
console.log("\n== 9) 經驗加成（XP 倍率） ==");
t("未啟用 → 倍率 1",()=>{
  ctx.S.xpBoostUntil=0;
  eq(windowStub.SHOP_xpMult(),1);
  eq(windowStub.SHOP_applyXp(50),50);
});
t("SHP_use('xp') 啟動 30 分鐘 → 倍率 2",()=>{
  ctx.S.items={xp:1};
  eq(g("SHP_use")("xp"),true);
  eq(ctx.S.items.xp,0,"應消耗 1 個");
  eq(windowStub.SHOP_xpMult(),2);
  eq(windowStub.SHOP_applyXp(50),100);
  ok(windowStub.SHOP_xpBoostLeft()>0,"剩餘秒數應 >0");
  ok(ctx.S.xpBoostUntil>Date.now()+29*60*1000,"應延後約 30 分鐘");
});
t("到期後倍率回到 1",()=>{
  ctx.S.xpBoostUntil=Date.now()-1000;
  eq(windowStub.SHOP_xpMult(),1);
  eq(windowStub.SHOP_applyXp(50),50);
  eq(windowStub.SHOP_xpBoostLeft(),0);
});
t("庫存不足時 SHP_use 回傳 false",()=>{
  ctx.S.items={};
  eq(g("SHP_use")("xp"),false);
  eq(g("SHP_use")("shield"),false);
  eq(g("SHP_use")("unknown"),false);
});
t("SHP_use 對自動生效型道具回傳 true 且不提前扣庫存",()=>{
  ctx.S.items={replay:2};
  eq(g("SHP_use")("replay"),true);
  eq(ctx.S.items.replay,2,"答題時才扣，不在此時消耗");
});
t("任務獎勵 XP 會套用倍率",()=>{
  CUR_DATE=nextDay(CUR_DATE);
  g("SHQ_sync")();
  ctx.S.xpBoostUntil=Date.now()+30*60*1000;   /* 維持啟用 */
  const q=qOf("win1");
  q.prog=q.goal;q.done=true;
  const xp0=ctx.S.xp,gem0=ctx.S.gems;
  eq(g("SHQ_claim")("win1"),true);
  eq(ctx.S.xp,xp0+q.xp*2,"XP 應 ×2");
  eq(ctx.S.gems,gem0+q.gem,"寶石照常發放");
});

/* ==================== 10) 寶石兌換 ==================== */
console.log("\n== 10) 寶石兌換（300 🪙 → 1 💎） ==");
t("金幣不足 → 不兌換",()=>{
  ctx.S.coins=299;ctx.S.gems=0;
  eq(g("SHP_exchange")(),false);
  eq(ctx.S.coins,299);eq(ctx.S.gems,0);
});
t("兌換成功 → 扣金幣、加寶石",()=>{
  ctx.S.coins=300;
  eq(g("SHP_exchange")(),true);
  eq(ctx.S.coins,0);eq(ctx.S.gems,1);
});
t("每日上限 3 次 → 第 4 次失敗",()=>{
  ctx.S.gemEx={date:CUR_DATE,n:0};   /* 重設今日額度，乾淨測試上限 */
  ctx.S.coins=900;
  eq(g("SHP_exchange")(),true);
  eq(g("SHP_exchange")(),true);
  eq(g("SHP_exchange")(),true);
  eq(ctx.S.gemEx.n,3);
  eq(ctx.S.coins,0);
  eq(ctx.S.gems,1+3);
  ctx.S.coins=300;
  eq(g("SHP_exchange")(),false);
  eq(ctx.S.coins,300,"失敗不可扣款");
  eq(ctx.S.gems,4,"失敗不可發寶石");
  ok(toasts.some(m=>m.indexOf("兌換次數")>=0),"應提示次數用完");
});
t("跨日後兌換次數重置",()=>{
  CUR_DATE=nextDay(CUR_DATE);
  g("SHQ_sync")();
  ctx.S.coins=300;
  eq(g("SHP_exchange")(),true);
  eq(ctx.S.gemEx.n,1);
  eq(ctx.S.gems,5);
});

/* ==================== 11) 綜合：無異常輸出 ==================== */
console.log("\n== 11) 其他 ==");
t("toast / confetti 有被呼叫（UI 反饋）",()=>{
  ok(toasts.length>10,"toast 次數："+toasts.length);
  ok(confettis>0,"confetti 未觸發");
  ok(saves>0,"save() 未觸發");
});
t("所有全域名稱都有 SH / SHQ / SHP / SHOP_ 前綴",()=>{
  const names=["SH_injectCSS","SH_mountScreen","SH_screen","SH_state","SH_boot",
    "SHQ_ensure","SHQ_sync","SHQ_claim","SHQ_buildList","SHQ_advance","SHQ_onAnswer",
    "SHQ_onQuizEnd","SHQ_onWords","SHQ_onWin",
    "SHP_avail","SHP_take","SHP_buy","SHP_use","SHP_exchange",
    "SHOP_open","SHOP_render","SHOP_renderIfOpen","SHOP_extraListen","SHOP_addTime",
    "SHOP_hint","SHOP_shield","SHOP_xpMult","SHOP_applyXp","SHOP_xpBoostLeft"];
  names.forEach(k=>{
    ok(/^(SH_|SHQ_|SHP_|SHOP_|SH_CSS$)/.test(k),"非法前綴："+k);
    ok(k in ctx,"模組全域不存在："+k);
  });
  ["SH_items","renderShop","buyItem","useItem","claimQuest","openShop"].forEach(bad=>{
    ok(!(bad in ctx),"不應存在的衝突名稱："+bad);
  });
});

/* ==================== 結果 ==================== */
console.log("\n========================================");
console.log("通過 "+pass+"　失敗 "+fail);
if(fail){fails.forEach(f=>console.log("  ✘ "+f));process.exit(1)}
console.log("✔ shop.js 測試全數通過");

/* ---------- helper ---------- */
function qOf(id){
  const list=ctx.S.quests&&ctx.S.quests.list;
  ok(Array.isArray(list),"找不到 quests.list");
  for(let i=0;i<list.length;i++)if(list[i].id===id)return list[i];
  throw new Error("找不到任務 "+id);
}
