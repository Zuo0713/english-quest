/* =========================================================
   test-wrong.js — wrong.js 的最小 DOM stub 驗證
   執行：node test-wrong.js
   ========================================================= */
"use strict";
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const assert=require("assert");
const {spawnSync}=require("child_process");

const DIR=__dirname;
const WRONG=path.join(DIR,"wrong.js");
const SELF=__filename;

/* ---------- 日期工具（與 index.html 的 today/dayStr 同邏輯） ---------- */
function fmt(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

/* ---------- 最小 DOM stub ---------- */
function makeEnv(){
  const registry=new Map();
  const listeners=[];
  function makeClassList(){
    const set=new Set();
    return {
      add:function(){ for(let i=0;i<arguments.length;i++)set.add(arguments[i]); },
      remove:function(){ for(let i=0;i<arguments.length;i++)set.delete(arguments[i]); },
      toggle:function(c,f){
        if(f===undefined){ if(set.has(c))set.delete(c);else set.add(c); }
        else if(f)set.add(c);else set.delete(c);
      },
      contains:function(c){ return set.has(c); },
      get length(){ return set.size; },
      _set:set
    };
  }
  function makeEl(tag){
    const el={
      tagName:String(tag||"div").toUpperCase(),
      id:"",
      innerHTML:"",
      textContent:"",
      value:"",
      style:{},
      dataset:{},
      children:[],
      disabled:false,
      onclick:null,oninput:null,onkeydown:null,
      setAttribute:function(k,v){
        if(k==="id")el.id=String(v);
        else if(k==="class")el.className=String(v);
        else el.dataset[k]=String(v);
      },
      getAttribute:function(k){
        if(k==="id")return el.id;
        return (k in el.dataset)?el.dataset[k]:null;
      },
      appendChild:function(c){
        if(!c)return c;
        el.children.push(c);
        if(c.id)registry.set(c.id,c);
        return c;
      },
      removeChild:function(c){
        const i=el.children.indexOf(c);
        if(i>=0)el.children.splice(i,1);
        return c;
      },
      remove:function(){},
      addEventListener:function(){},
      removeEventListener:function(){},
      querySelector:function(){ return null; },
      querySelectorAll:function(){ return []; },
      focus:function(){},
      contains:function(){ return false; }
    };
    el.classList=makeClassList();
    Object.defineProperty(el,"className",{
      get:function(){ return Array.from(el.classList._set).join(" "); },
      set:function(v){
        el.classList._set.clear();
        String(v).split(/\s+/).filter(Boolean).forEach(function(c){ el.classList._set.add(c); });
      }
    });
    return el;
  }
  const head=makeEl("head");
  const body=makeEl("body");
  const app=makeEl("div");
  app.id="app";
  registry.set("app",app);
  const document={
    readyState:"complete",
    head:head,
    body:body,
    documentElement:makeEl("html"),
    getElementById:function(id){ return registry.get(String(id))||null; },
    createElement:function(tag){ return makeEl(tag); },
    querySelector:function(){ return null; },
    querySelectorAll:function(){ return []; },
    addEventListener:function(t,fn){ listeners.push({t:t,fn:fn}); },
    removeEventListener:function(){}
  };
  return {document:document,registry:registry,listeners:listeners,head:head,body:body,app:app,makeEl:makeEl};
}

/* ---------- 建立隔離環境並載入 wrong.js ---------- */
function boot(){
  const env=makeEnv();
  const logs={toast:[],go:[],confetti:[]};
  const sandbox={
    document:env.document,
    console:console,
    setTimeout:setTimeout,
    clearTimeout:clearTimeout,
    logs:logs,
    S:undefined,
    WORD_CARDS:null,
    $:function(id){ return env.document.getElementById(id); },
    esc:function(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); },
    toast:function(m,e){ logs.toast.push(String(e||"")+" "+String(m)); },
    save:function(){ logs.save=(logs.save||0)+1; },
    go:function(id){
      const el=env.document.getElementById(id);
      if(!el)throw new Error("go(): 找不到畫面 "+id);
      el.classList.add("active");
      logs.go.push(id);
    },
    today:function(){ return fmt(new Date()); },
    dayStr:function(off){ return fmt(new Date(Date.now()+off*864e5)); },
    shuffle:function(a){
      a=a.slice();
      for(let i=a.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        const t=a[i];a[i]=a[j];a[j]=t;
      }
      return a;
    },
    pick:function(a,n){ return sandbox.shuffle(a).slice(0,n); },
    speak:function(){ return true; },
    confetti:function(n){ logs.confetti.push(n); },
    gainStats:function(ok){
      const s=sandbox.S; if(!s)return;
      s.total=(s.total||0)+1;
      if(ok)s.correct=(s.correct||0)+1;
    },
    addCoins:function(n){
      const s=sandbox.S; if(!s)return;
      s.coins=(s.coins||0)+n;
    },
    level:function(){ return 1; },
    window:null
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(WRONG,"utf8"),sandbox,{filename:"wrong.js"});
  sandbox.__env=env;
  return sandbox;
}

/* ---------- 測試框架 ---------- */
let pass=0,fail=0;
function t(name,fn){
  try{
    fn();
    pass++;
    console.log("  \u2713 "+name);
  }catch(e){
    fail++;
    console.log("  \u2717 "+name);
    console.log("      "+(e&&e.message?e.message:e));
  }
}
function group(title){ console.log("\n"+title); }

/* 題目樣本（選項 4 個、正確答案 0） */
function newQ(tag){
  return {
    t:"listen",part:"Part 2",
    audio:(tag||"")+"What time does the meeting start?",
    q:(tag||"")+"Choose the best response.",
    o:["It starts at three.","In the conference room.","With Mr. Smith.","About an hour."],
    a:0,
    zh:"會議三點開始。",
    why:"What time 問時間。"
  };
}
/* 連續作答 n 題（每輪固定 n 題，答完自動進結算） */
function playRound(sb,n,ans){
  assert.strictEqual(sb.WRG_start(),true,"練習應該可以開始");
  for(let k=0;k<n;k++){
    const ok=sb.WRG_answer(ans);
    assert.strictEqual(typeof ok,"boolean","WRG_answer 應回傳布林值");
    sb.WRG_next();
  }
}

/* ================= 測試 ================= */
const sb=boot();

group("A. 語法與載入");
t("wrong.js 語法無誤（node --check）",function(){
  const r=spawnSync(process.execPath,["--check",WRONG],{encoding:"utf8"});
  assert.strictEqual(r.status,0,(r.stdout||"")+(r.stderr||""));
});
t("test-wrong.js 語法無誤（node --check）",function(){
  const r=spawnSync(process.execPath,["--check",SELF],{encoding:"utf8"});
  assert.strictEqual(r.status,0,(r.stdout||"")+(r.stderr||""));
});
t("所有全域宣告都有 WRG_ 前綴",function(){
  const src=fs.readFileSync(WRONG,"utf8");
  const decls=[];
  const re=/^(?:function|let|const|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while((m=re.exec(src))!==null)decls.push(m[1]);
  assert.ok(decls.length>15,"找不到足夠的全域宣告");
  decls.forEach(function(d){
    assert.ok(d.indexOf("WRG_")===0,"全域名稱未加 WRG_ 前綴："+d);
  });
});
t("CSS 已注入 #wrg-css",function(){
  assert.ok(sb.document.getElementById("wrg-css"),"找不到 wrg-css");
});
t("動態畫面 #scr-wrong 已建立",function(){
  const scr=sb.document.getElementById("scr-wrong");
  assert.ok(scr,"找不到 scr-wrong");
  assert.ok(scr.classList.contains("screen"));
});
t("window.WRG_* 導出齊全",function(){
  ["WRG_open","WRG_record","WRG_recovered","WRG_wordResult","WRG_dueWords","WRG_reviewHTML","WRG_dailySeed"]
    .forEach(function(k){
      assert.strictEqual(typeof sb.window[k],"function",k+" 未導出");
    });
});

group("B. 防禦性初始化（舊存檔）");
t("空物件 S → 自動建立 S.wrongs / S.wordM",function(){
  sb.S={};
  const q=newQ();
  const w=sb.WRG_record(q,1,"toeic");
  assert.ok(Array.isArray(sb.S.wrongs),"S.wrongs 應為陣列");
  assert.ok(sb.S.wordM&&typeof sb.S.wordM==="object"&&!Array.isArray(sb.S.wordM),"S.wordM 應為物件");
  assert.ok(w,"應回傳錯題條目");
  assert.strictEqual(w.source,"toeic");
  assert.strictEqual(w.type,"listen");
  assert.strictEqual(w.wrong,1);
  assert.strictEqual(w.fixed,false);
  assert.strictEqual(w.picked,1);
  assert.strictEqual(w.streak,0);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(w.last),"last 應為 YYYY-MM-DD");
  assert.ok(Array.isArray(w.opts)&&w.opts.length===4);
  assert.strictEqual(w.a,0);
  assert.ok(typeof w.key==="string"&&w.key.length>0);
});
t("S.wrongs 是垃圾值 → 重置為陣列",function(){
  sb.S={wrongs:"junk",wordM:"junk"};
  sb.WRG_record(newQ(),1,"toeic");
  assert.ok(Array.isArray(sb.S.wrongs));
  assert.ok(!Array.isArray(sb.S.wordM)&&typeof sb.S.wordM==="object");
});
t("S.wrongs 是物件格式 → 轉成陣列並保留資料",function(){
  sb.S={wrongs:{"toeic:9":{key:"toeic:9",source:"toeic",q:"obj?",o:["a","b"],a:0,wrong:2}}};
  sb.WRG_pool();
  assert.ok(Array.isArray(sb.S.wrongs));
  assert.strictEqual(sb.S.wrongs.length,1);
  assert.strictEqual(sb.S.wrongs[0].wrong,2);
  assert.strictEqual(sb.S.wrongs[0].fixed,false);
});
t("S 不存在時所有 API 安全空轉",function(){
  sb.S=undefined;
  assert.strictEqual(sb.WRG_pool().length,0);
  assert.strictEqual(sb.WRG_dueWords().length,0);
  assert.strictEqual(sb.WRG_record(newQ(),1,"toeic"),null);
  assert.strictEqual(sb.WRG_recovered(newQ()),false);
  assert.strictEqual(sb.WRG_wordResult("word",true),null);
  assert.strictEqual(sb.WRG_dailySeed().length,0);
  assert.strictEqual(typeof sb.WRG_reviewHTML(),"string");
  assert.strictEqual(sb.WRG_stats().total,0);
  sb.S={};
});
t("S 是字串 → 視為無狀態",function(){
  sb.S="not-an-object";
  assert.strictEqual(sb.WRG_record(newQ(),1,"toeic"),null);
  sb.S={};
});

group("C. 錯題記錄與防重複");
t("同一題重複答錯只累加錯次（防重複）",function(){
  sb.S={};
  const q=newQ();
  sb.WRG_record(q,1,"toeic");
  sb.WRG_record(q,2,"toeic");
  sb.WRG_record(q,3,"toeic");
  assert.strictEqual(sb.S.wrongs.length,1,"同題不應重複建立");
  const w=sb.S.wrongs[0];
  assert.strictEqual(w.wrong,3);
  assert.strictEqual(w.picked,3);
  assert.strictEqual(w.fixed,false);
  assert.strictEqual(w.streak,0);
});
t("不同來源的同題不會互相合併",function(){
  sb.S={};
  const q=newQ();
  sb.WRG_record(q,1,"toeic");
  sb.WRG_record(q,1,"mock");
  sb.WRG_record(q,1,"grammar");
  sb.WRG_record(q,1,"map");
  assert.strictEqual(sb.S.wrongs.length,4);
  assert.deepStrictEqual(sb.WRG_stats().byType,{listen:4});
});
t("傳入 idx → 用 來源:索引 當 key",function(){
  sb.S={};
  sb.WRG_record(newQ(),1,"toeic",5);
  sb.WRG_record(Object.assign(newQ(),{q:"改過的題幹"}),2,"toeic",5);
  assert.strictEqual(sb.S.wrongs.length,1);
  assert.strictEqual(sb.S.wrongs[0].wrong,2);
  assert.strictEqual(sb.S.wrongs[0].key,"toeic:5");
});
t("答對不收進錯題本",function(){
  sb.S={};
  const q=newQ();
  const r=sb.WRG_record(q,0,"toeic");   // 0 === q.a
  assert.strictEqual(sb.S.wrongs.length,0);
  assert.strictEqual(r,false);
});
t("記錄上次選的錯誤選項",function(){
  sb.S={};
  const q=newQ();
  sb.WRG_record(q,2,"toeic");
  const w=sb.S.wrongs[0];
  assert.strictEqual(w.picked,2);
  assert.strictEqual(w.opts[2],"With Mr. Smith.");
  assert.strictEqual(w.zh,"會議三點開始。");
  assert.ok(w.why.length>0);
});
t("grammar 題（{q,o,a,e}）也能記錄",function(){
  sb.S={};
  const g={q:"She ___ a teacher.",o:["am","is","are","be"],a:1,e:"is 配 she"};
  sb.WRG_record(g,0,"grammar");
  assert.strictEqual(sb.S.wrongs.length,1);
  const w=sb.S.wrongs[0];
  assert.strictEqual(w.type,"grammar");
  assert.strictEqual(w.a,1);
  assert.strictEqual(w.why,"is 配 she");
});

group("D. 修復機制（連續答對 2 次移出錯題池）");
t("連續答對 2 次 → 標記修復並移出錯題池",function(){
  sb.S={};
  const q=newQ();
  sb.WRG_record(q,1,"toeic");
  assert.strictEqual(sb.WRG_pool().length,1);
  sb.WRG_recovered(q);
  assert.strictEqual(sb.S.wrongs[0].streak,1);
  assert.strictEqual(sb.S.wrongs[0].fixed,false);
  assert.strictEqual(sb.WRG_pool().length,1,"第 1 次答對仍要留在池中");
  sb.WRG_recovered(q);
  assert.strictEqual(sb.S.wrongs[0].streak,2);
  assert.strictEqual(sb.S.wrongs[0].fixed,true);
  assert.strictEqual(sb.WRG_pool().length,0,"連續 2 次答對要移出錯題池");
});
t("中間答錯會中斷連續計數",function(){
  sb.S={};
  const q=newQ();
  sb.WRG_record(q,1,"toeic");
  sb.WRG_recovered(q);
  sb.WRG_record(q,2,"toeic");
  const w=sb.S.wrongs[0];
  assert.strictEqual(w.streak,0);
  assert.strictEqual(w.fixed,false);
  assert.strictEqual(w.wrong,2);
});
t("已修復的題再次答錯 → 退回待練習",function(){
  sb.S={};
  const q=newQ();
  sb.WRG_record(q,1,"toeic");
  sb.WRG_recovered(q);sb.WRG_recovered(q);
  assert.strictEqual(sb.WRG_stats().fixed,1);
  sb.WRG_record(q,3,"toeic");
  const w=sb.S.wrongs[0];
  assert.strictEqual(w.fixed,false);
  assert.strictEqual(w.wrong,2);
  assert.strictEqual(sb.WRG_pool().length,1);
});
t("清除已修復錯題只刪 fixed",function(){
  sb.S={};
  const a=newQ("A"),b=newQ("B");
  sb.WRG_record(a,1,"toeic");
  sb.WRG_record(b,1,"toeic");
  sb.WRG_recovered(a);sb.WRG_recovered(a);
  assert.strictEqual(sb.WRG_stats().pending,1);
  const n=sb.WRG_clearFixed();
  assert.strictEqual(n,1);
  assert.strictEqual(sb.S.wrongs.length,1);
  assert.strictEqual(sb.S.wrongs[0].q.charAt(0),"B","留下的應是還沒修復的 B 題");
  assert.strictEqual(sb.WRG_stats().pending,1);
});
t("統計：總數／已修復／待練習／題型分佈",function(){
  sb.S={};
  sb.WRG_record(newQ("A"),"read","toeic");      // 傳字串也算錯答
  const read={t:"read",q:"The team ___ a plan.",o:["draft","drafts","drafting","drafted"],a:1};
  sb.WRG_record(read,0,"toeic");
  sb.WRG_record(newQ("B"),1,"mock");
  sb.WRG_recovered(sb.S.wrongs[2]);
  sb.WRG_recovered(sb.S.wrongs[2]);
  const st=sb.WRG_stats();
  assert.strictEqual(st.total,3);
  assert.strictEqual(st.fixed,1);
  assert.strictEqual(st.pending,2);
  assert.strictEqual(st.byType.listen,2);
  assert.strictEqual(st.byType.read,1);
});

group("E. 錯題練習模式（scr-wrong）");
t("開場畫面可開啟且含統計",function(){
  sb.S={};
  assert.strictEqual(sb.WRG_open(),true);
  assert.ok(sb.logs.go.indexOf("scr-wrong")>=0,"應呼叫 go('scr-wrong')");
  const scr=sb.document.getElementById("scr-wrong");
  assert.ok(scr.classList.contains("active"));
  assert.ok(scr.innerHTML.indexOf("錯題練習")>=0);
  assert.ok(scr.innerHTML.indexOf("目前沒有錯題")>=0,"空狀態提示");
  assert.ok(scr.innerHTML.indexOf("📅 今日待複習單字")>=0,"同畫面應含待複習單字區塊");
});
t("練習：答對累積、答錯累加、結算正確",function(){
  sb.S={total:0,correct:0,coins:0};
  const qs=[newQ("Q1"),newQ("Q2"),newQ("Q3")];
  qs.forEach(function(q){ sb.WRG_record(q,1,"toeic"); });
  assert.strictEqual(sb.WRG_pool().length,3);
  assert.strictEqual(sb.WRG_start(),true);
  assert.strictEqual(sb.WRG_answer(0),true,"答對應回傳 true");
  sb.WRG_next();
  assert.strictEqual(sb.WRG_answer(1),false,"答錯應回傳 false");
  sb.WRG_next();
  assert.strictEqual(sb.WRG_answer(0),true);
  sb.WRG_next();                      // 第 3 題答完 → 進結算
  const st=sb.WRG_stats();
  assert.strictEqual(st.total,3);
  assert.strictEqual(st.pending,3,"每題只答對 1 次，尚不足以修復");
  assert.strictEqual(sb.S.total,3,"gainStats 應被呼叫");
  assert.strictEqual(sb.S.correct,2);
  assert.ok(sb.S.coins>0,"結算應發金幣");
  assert.strictEqual(sb.logs.confetti.length>0,true);
});
t("練習：連續兩輪全對 → 3 題全部移出錯題池",function(){
  sb.S={total:0,correct:0,coins:0};
  const qs=[newQ("Q1"),newQ("Q2"),newQ("Q3")];
  qs.forEach(function(q){ sb.WRG_record(q,1,"toeic"); });
  playRound(sb,3,0);     // 第 1 輪全對 → 各 streak=1
  assert.strictEqual(sb.WRG_pool().length,3,"第 1 輪結束仍在池中");
  playRound(sb,3,0);     // 第 2 輪全對 → 各 streak=2 → 修復
  assert.strictEqual(sb.WRG_pool().length,0,"連續答對 2 次應全部移出");
  assert.strictEqual(sb.WRG_stats().fixed,3);
  assert.strictEqual(sb.WRG_start(),false,"池空時不應開始練習");
  assert.ok(sb.logs.toast.some(function(x){ return x.indexOf("沒有待練習")>=0; }));
});
t("練習中答錯 → 錯次 +1、連續歸零",function(){
  sb.S={total:0,correct:0,coins:0};
  const q=newQ();
  sb.WRG_record(q,1,"toeic");
  sb.WRG_recovered(q);                 // streak=1
  assert.strictEqual(sb.WRG_start(),true);
  assert.strictEqual(sb.WRG_answer(1),false);   // a=0 → 答錯
  sb.WRG_next();
  const w=sb.S.wrongs[0];
  assert.strictEqual(w.wrong,2);
  assert.strictEqual(w.streak,0);
  assert.strictEqual(w.picked,1);
  assert.strictEqual(w.fixed,false);
  assert.strictEqual(sb.WRG_pool().length,1);
});

group("F. 單字掌握度（間隔複習）");
t("答錯 → lv 降級且 due 設為明天",function(){
  sb.S={wordM:{}};
  let e=sb.WRG_wordResult("apple",false);
  assert.strictEqual(e.lv,0);
  assert.strictEqual(e.due,sb.dayStr(1),"答錯 due 應為明天");
  sb.WRG_wordResult("apple",true);      // lv 1
  e=sb.WRG_wordResult("apple",false);
  assert.strictEqual(e.lv,0,"答錯應降一級");
  assert.strictEqual(e.due,sb.dayStr(1));
  assert.strictEqual(e.last,sb.today());
});
t("答對升級：間隔 1 / 3 / 7 天（上限 3）",function(){
  sb.S={wordM:{}};
  sb.WRG_wordResult("apple",true);
  assert.strictEqual(sb.S.wordM.apple.lv,1);
  assert.strictEqual(sb.S.wordM.apple.due,sb.dayStr(1));
  sb.WRG_wordResult("apple",true);
  assert.strictEqual(sb.S.wordM.apple.lv,2);
  assert.strictEqual(sb.S.wordM.apple.due,sb.dayStr(3));
  sb.WRG_wordResult("apple",true);
  assert.strictEqual(sb.S.wordM.apple.lv,3);
  assert.strictEqual(sb.S.wordM.apple.due,sb.dayStr(7));
  sb.WRG_wordResult("apple",true);      // 已滿級
  assert.strictEqual(sb.S.wordM.apple.lv,3);
  assert.strictEqual(sb.S.wordM.apple.due,sb.dayStr(7));
});
t("大小寫／空白的單字會正規化成同一筆",function(){
  sb.S={wordM:{}};
  sb.WRG_wordResult("  Apple ",false);
  sb.WRG_wordResult("APPLE",true);
  assert.strictEqual(Object.keys(sb.S.wordM).length,1);
  assert.ok(sb.S.wordM.apple);
});
t("昨天沒背熟的字會出現在今日待複習",function(){
  sb.S={wordM:{}};
  sb.WRG_wordResult("yesterday",false);
  sb.S.wordM.yesterday.due=sb.dayStr(-1);      // 昨天沒背熟
  sb.WRG_wordResult("todaydue",true);
  sb.S.wordM.todaydue.due=sb.today();          // 今天到期
  sb.WRG_wordResult("future",true);
  sb.S.wordM.future.due=sb.dayStr(1);          // 明天才到期
  const due=sb.WRG_dueWords();
  assert.deepStrictEqual(due,["yesterday","todaydue"]);
  assert.ok(due.indexOf("future")<0,"未到期的字不應出現");
});

group("G. WRG_dueWords 過濾與排序");
t("只回傳 due<=今天，且由最舊排到最新",function(){
  sb.S={wordM:{
    a:{lv:1,due:sb.dayStr(-5),last:""},
    b:{lv:2,due:sb.dayStr(-1),last:""},
    c:{lv:3,due:sb.today(),last:""},
    d:{lv:0,due:sb.dayStr(1),last:""},
    e:{lv:0,due:sb.dayStr(30),last:""},
    f:{lv:0,due:"",last:""},
    g:"bad-data",
    h:{lv:1}
  }};
  assert.deepStrictEqual(sb.WRG_dueWords(),["a","b","c"]);
});
t("沒有追蹤任何單字 → 空陣列",function(){
  sb.S={wordM:{}};
  assert.deepStrictEqual(sb.WRG_dueWords(),[]);
});

group("H. WRG_reviewHTML / WRG_dailySeed");
t("顯示待複習數量與前 10 個字",function(){
  sb.S={wordM:{}};
  for(let i=1;i<=15;i++){
    const w="word"+String(i).padStart(2,"0");
    sb.S.wordM[w]={lv:0,due:sb.dayStr(-1),last:""};
  }
  const html=sb.WRG_reviewHTML();
  assert.ok(html.indexOf("📅 今日待複習單字")>=0,"標題");
  assert.ok(html.indexOf("15")>=0,"應顯示數量 15");
  const chips=html.match(/<button class="wrg-chip"/g)||[];
  assert.strictEqual(chips.length,10,"只顯示前 10 個");
  assert.ok(html.indexOf("word01")>=0&&html.indexOf("word10")>=0,"前 10 應出現");
  assert.ok(html.indexOf("word11")<0,"第 11 個不應出現");
  assert.ok(html.indexOf("還有 5 個字")>=0,"應提示剩餘數量");
  assert.ok(html.indexOf("speak('word01')")>=0,"chip 應可點擊發音");
});
t("沒有待複習時回傳空狀態",function(){
  sb.S={wordM:{}};
  const html=sb.WRG_reviewHTML();
  assert.ok(html.indexOf("📅 今日待複習單字")>=0);
  assert.ok(html.indexOf("沒有到期的待複習單字")>=0);
  assert.strictEqual((html.match(/<button class="wrg-chip"/g)||[]).length,0);
});
t("WRG_dailySeed 回傳 WORD_CARDS 字卡索引",function(){
  sb.WORD_CARDS=[{w:"apple"},{w:"Banana"},{w:"cat"}];
  sb.S={wordM:{
    apple:{lv:1,due:sb.dayStr(-1),last:""},
    banana:{lv:0,due:sb.today(),last:""},
    zebra:{lv:0,due:sb.dayStr(-1),last:""},   // 不在字卡內
    future:{lv:3,due:sb.dayStr(5),last:""}    // 未到期
  }};
  assert.deepStrictEqual(sb.WRG_dailySeed(),[0,1],"大小寫要對得上且過濾未到期");
  sb.WORD_CARDS=null;
});
t("WORD_CARDS 不存在時回傳空陣列",function(){
  sb.S={wordM:{apple:{lv:1,due:sb.dayStr(-1),last:""}}};
  assert.deepStrictEqual(sb.WRG_dailySeed(),[]);
});

group("I. 整合安全");
t("不會改動 S.daily / DEX / REV 結構",function(){
  sb.S={
    daily:{date:sb.today(),queue:[3,1,2],learned:[0],exam:{done:false,score:0}},
    wordM:{}
  };
  const before=JSON.stringify(sb.S.daily);
  sb.WRG_record(newQ(),1,"toeic");
  sb.WRG_recovered(newQ());
  sb.WRG_wordResult("x",true);
  sb.WRG_dueWords();
  sb.WRG_reviewHTML();
  sb.WRG_dailySeed();
  assert.strictEqual(JSON.stringify(sb.S.daily),before,"S.daily 不可被更動");
  assert.ok(Array.isArray(sb.S.daily.queue)&&sb.S.daily.queue.length===3);
  assert.deepStrictEqual(sb.S.daily.learned,[0]);
});
t("記錄後會呼叫 save()",function(){
  sb.S={};
  const before=sb.logs.save||0;
  sb.WRG_record(newQ(),1,"toeic");
  assert.ok((sb.logs.save||0)>before,"應呼叫 save()");
});
t("重複載入畫面 / CSS 不會重複建立",function(){
  const n1=sb.document.registry.size;
  sb.WRG_boot();
  sb.WRG_boot();
  assert.strictEqual(sb.document.registry.size,n1,"不應重複建立元素");
  assert.strictEqual(sb.document.querySelectorAll("#wrg-css").length,0);
  assert.ok(sb.document.getElementById("wrg-css"));
});

/* ================= 結果 ================= */
console.log("\n----------------------------------------");
console.log("通過 "+pass+" 項，失敗 "+fail+" 項");
console.log("----------------------------------------");
process.exit(fail?1:0);
