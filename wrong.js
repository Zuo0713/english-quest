/* =========================================================
   wrong.js — 錯題練習 ＋ 間隔複習排程模組（English Quest 擴充）
   ---------------------------------------------------------
   載入方式（放在 index.html 主程式 </script> 之後）：
       <script src="wrong.js"></script>

   對外 API（一律掛在 window.WRG_*）：
       WRG_open()            開啟錯題練習畫面 scr-wrong
       WRG_record(q,i,src)   記錄答錯的題目（第 4 參可選：題目索引 idx）
       WRG_recovered(q)      再次答對時標記修復（連續 2 次自動移出錯題池）
       WRG_wordResult(w,ok)  單字掌握度升級 / 降級（間隔 1/3/7 天）
       WRG_dueWords()        回傳今天到期（含昨天沒背熟）的單字清單
       WRG_reviewHTML()      回傳「📅 今日待複習單字」HTML 區塊
       WRG_dailySeed()       回傳應優先插入每日單字隊列的字卡索引陣列

   新增存檔欄位（對舊存檔防禦性初始化）：
       S.wrongs  = [ {key,source,idx,type,q,opts,a,part,audio,passage,
                      emoji,zh,why,wrong,streak,last,picked,fixed}, ... ]
       S.wordM   = { "word": {lv:0..3, due:"YYYY-MM-DD", last:"YYYY-MM-DD"} }

   注意：不改動既有 S.daily / DEX / REV 的任何結構。
   ========================================================= */

const WRG_CSS=`
/* ===== 錯題練習模組（全部 .wrg-* 前綴，不動既有樣式） ===== */
.wrg-menu::after{background:var(--amber)}
.wrg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.wrg-type-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.wrg-tchip{background:var(--card);border:1px solid rgba(255,255,255,.12);border-radius:20px;
  padding:6px 13px;font-size:12.5px;color:var(--text2);display:flex;align-items:center;gap:6px}
.wrg-tchip b{color:var(--text);font-size:13px}
.wrg-list-title{font-size:13px;font-weight:700;color:var(--text2);margin:2px 0 8px}
.wrg-list{display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
.wrg-item{background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:12px;
  padding:11px 13px;display:flex;gap:10px;align-items:flex-start;font-size:13.5px;animation:slideUp .3s backwards}
.wrg-flag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:8px;white-space:nowrap;
  flex-shrink:0;margin-top:1px}
.wrg-flag.new{background:rgba(239,68,68,.2);color:var(--red2)}
.wrg-flag.done{background:rgba(16,185,129,.2);color:var(--green2)}
.wrg-item-main{flex:1;min-width:0}
.wrg-item-q{line-height:1.5;color:var(--text)}
.wrg-item-sub{font-size:11.5px;color:var(--text2);margin-top:4px}
.wrg-streak{font-size:11.5px;color:var(--amber2);white-space:nowrap;flex-shrink:0;margin-top:2px}
.wrg-review{margin-top:14px}
.wrg-review-head{font-size:12px;color:var(--text2);margin-top:13px;text-align:center}
.wrg-chips{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:9px}
.wrg-chip{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.32);color:var(--text);
  border-radius:999px;padding:7px 12px;font-size:13.5px;cursor:pointer;display:inline-flex;
  align-items:center;gap:6px;font-family:inherit;transition:.2s}
.wrg-chip:hover{background:var(--green);color:#052e1e;transform:translateY(-2px)}
.wrg-chip .wrg-lv{font-size:10.5px;font-weight:700;color:var(--amber2);font-style:normal}
.wrg-chip:hover .wrg-lv{color:#052e1e}
.wrg-practice-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.wrg-badge{background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.4);color:var(--red2);
  font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:10px}
.wrg-exit{background:none;border:1px solid rgba(255,255,255,.2);color:var(--text2);
  border-radius:10px;padding:6px 12px;font-size:12.5px;cursor:pointer;transition:.2s;font-family:inherit}
.wrg-exit:hover{background:rgba(255,255,255,.1);color:var(--text)}
.wrg-picked{font-size:12.5px;color:var(--red2);margin-top:6px}
.wrg-ok-note{font-size:12.5px;color:var(--green2);margin-top:10px;text-align:center}
`;

/* =========================================================
   1. 狀態防禦性初始化（舊存檔沒有 S.wrongs / S.wordM）
   ========================================================= */
function WRG_arr(x){
  if(Array.isArray(x))return x;
  if(x&&typeof x==="object"){           // 舊版若存成物件 → 轉成陣列
    const out=[];
    for(const k in x){
      if(!Object.prototype.hasOwnProperty.call(x,k))continue;
      const v=x[k];
      if(v&&typeof v==="object")out.push(v);
    }
    return out;
  }
  return [];                              // 字串 / 數字 / null / undefined
}
/* 正規化單筆錯題（原地修改，保持參照不變） */
function WRG_norm(w){
  if(!w||typeof w!=="object")return null;
  if(typeof w.key!=="string"||!w.key)w.key=WRG_key(w,w.source);
  if(!w.key)return null;
  if(typeof w.source!=="string"||!w.source)w.source="toeic";
  if(typeof w.idx!=="number"||!isFinite(w.idx))w.idx=-1;
  if(typeof w.type!=="string"||!w.type)w.type=w.source;
  if(typeof w.q!=="string")w.q=String(w.q==null?"":w.q);
  if(!Array.isArray(w.opts))w.opts=[];
  if(typeof w.a!=="number"||!isFinite(w.a))w.a=-1;
  if(typeof w.part!=="string")w.part="";
  if(typeof w.audio!=="string")w.audio="";
  if(typeof w.passage!=="string")w.passage="";
  if(typeof w.emoji!=="string")w.emoji="";
  if(typeof w.zh!=="string")w.zh="";
  if(typeof w.why!=="string")w.why="";
  if(typeof w.wrong!=="number"||w.wrong<1)w.wrong=1;
  if(typeof w.streak!=="number"||w.streak<0)w.streak=0;
  if(typeof w.last!=="string")w.last="";
  if(typeof w.picked!=="number"||!isFinite(w.picked))w.picked=-1;
  w.fixed=!!w.fixed;
  return w;
}
/* 取得（並初始化）目前玩家狀態；S 不存在時回傳 null 讓所有 API 安全空轉 */
function WRG_state(){
  let s=null;
  try{ if(typeof S!=="undefined"&&S&&typeof S==="object")s=S; }catch(e){ s=null; }
  if(!s)return null;
  if(!Array.isArray(s.wrongs))s.wrongs=WRG_arr(s.wrongs);
  const arr=s.wrongs;
  let cleaned=null;
  for(let i=0;i<arr.length;i++){
    const n=WRG_norm(arr[i]);
    if(n===null){ if(!cleaned)cleaned=arr.slice(0,i); }
    else if(cleaned)cleaned.push(n);
  }
  if(cleaned)s.wrongs=cleaned;
  if(!s.wordM||typeof s.wordM!=="object"||Array.isArray(s.wordM))s.wordM={};
  return s;
}
function WRG_save(){ try{ save(); }catch(e){} }
function WRG_find(key){
  const s=WRG_state();
  if(!s||!key)return null;
  const a=s.wrongs;
  for(let i=0;i<a.length;i++){ if(a[i]&&a[i].key===key)return a[i]; }
  return null;
}
/* 產生題目唯一鍵：來源＋索引，沒有索引就用題幹雜湊 */
function WRG_key(q,source){
  source=String(source||"toeic").trim()||"toeic";
  if(!q||typeof q!=="object")return null;
  let idx=-1;
  if(typeof q.idx==="number"&&isFinite(q.idx)&&q.idx>=0)idx=q.idx;
  else if(typeof q.__idx==="number"&&isFinite(q.__idx)&&q.__idx>=0)idx=q.__idx;
  if(idx>=0)return source+":"+idx;
  const txt=String(q.q||q.audio||q.zh||q.text||"").trim();
  if(!txt)return null;
  let h=5381;
  for(let i=0;i<txt.length;i++)h=((h*33)^txt.charCodeAt(i))>>>0;
  return source+":t"+h.toString(36)+"-"+txt.length;
}
/* 把「題目物件 / 錯題條目 / 字串 key」統一成 key */
function WRG_keyOf(q,source){
  if(typeof q==="string"&&q)return q;
  if(q&&typeof q==="object"){
    if(typeof q.key==="string"&&q.key&&(q.source||typeof q.wrong==="number"))return q.key;
    return WRG_key(q,source||q.source);
  }
  return null;
}
/* 找錯題條目：先比 key，找不到再用「來源＋題幹」兜底（索引與快照混用時） */
function WRG_findFor(q,source){
  const s=WRG_state();
  if(!s)return null;
  const key=WRG_keyOf(q,source);
  if(key){
    const hit=WRG_find(key);
    if(hit)return hit;
  }
  if(q&&typeof q==="object"){
    const txt=String(q.q||q.audio||q.zh||q.text||"").trim();
    const src=String(source||q.source||"");
    if(txt){
      const a=s.wrongs;
      for(let i=0;i<a.length;i++){
        const x=a[i];
        if(x&&x.q===txt&&(!src||x.source===src))return x;
      }
    }
  }
  return null;
}
/* 從題目物件做一份錯題快照（練習模式要能獨立重出題） */
function WRG_snap(q,source,key,idx){
  const w={
    key:key,
    source:String(source||"toeic"),
    idx:(typeof idx==="number"&&isFinite(idx)&&idx>=0)?idx:
        (typeof q.idx==="number"&&q.idx>=0?q.idx:-1),
    type:String(q.t||source||"other"),
    q:String(q.q||q.audio||q.zh||q.text||""),
    opts:Array.isArray(q.o)?q.o.slice():(Array.isArray(q.opts)?q.opts.slice():[]),
    a:(typeof q.a==="number"&&isFinite(q.a))?q.a:-1,
    part:String(q.part||""),
    audio:String(q.audio||""),
    passage:String(q.passage||""),
    emoji:String(q.emoji||""),
    zh:String(q.zh||""),
    why:String(q.why||q.e||""),
    wrong:1,streak:0,last:WRG_today(),picked:-1,fixed:false
  };
  return WRG_norm(w);
}
function WRG_today(){ return today(); }
function WRG_dayStr(n){ return dayStr(n); }

/* =========================================================
   2. 錯題本 API
   ========================================================= */
/* 記錄答錯：同題只會累加錯次，不會重複建立 */
function WRG_record(q,chosenIdx,source,idx){
  const s=WRG_state();
  if(!s)return null;
  if(!q||typeof q!=="object")return null;
  source=String(source||(q.source)||"toeic");
  const chosen=(typeof chosenIdx==="number"&&isFinite(chosenIdx))?chosenIdx:-1;
  /* 答對 → 不收進錯題本，改走「修復」流程 */
  if(typeof q.a==="number"&&q.a>=0&&chosen===q.a)return WRG_recovered(q,source);
  let src=q;
  if(typeof idx==="number"&&idx>=0)src=Object.assign({},q,{idx:idx});
  const key=WRG_key(src,source);
  if(!key)return null;
  const t=WRG_today();
  let w=WRG_findFor(src,source);
  if(!w){
    w=WRG_snap(src,source,key,idx);
    if(!w)return null;
    s.wrongs.push(w);
  }else{
    w.wrong++;
    w.fixed=false;      // 又答錯 → 退回待練習
    w.streak=0;         // 連續答對中斷
    /* 順手補上可能缺的快照欄位（題庫載入後才有的解析） */
    if(!w.opts.length&&Array.isArray(src.o))w.opts=src.o.slice();
    if(w.a<0&&typeof src.a==="number")w.a=src.a;
    if(!w.zh&&src.zh)w.zh=String(src.zh);
    if(!w.why&&src.why)w.why=String(src.why);
    if(!w.audio&&src.audio)w.audio=String(src.audio);
    if(!w.passage&&src.passage)w.passage=String(src.passage);
  }
  w.last=t;
  w.picked=chosen;
  WRG_save();
  return w;
}
/* 再次答對：連續答對 2 次 → 標記修復（移出錯題池） */
function WRG_recovered(q,source){
  const s=WRG_state();
  if(!s)return false;
  const w=WRG_findFor(q,source);
  if(!w)return false;
  if(w.fixed)return true;
  w.streak=(w.streak||0)+1;
  w.last=WRG_today();
  if(w.streak>=2){
    w.fixed=true;
    try{ toast("錯題已修復："+(w.q||"題目"),"🎉"); }catch(e){}
    try{ confetti(20); }catch(e){}
  }
  WRG_save();
  return true;
}
/* 還沒修復的錯題池 */
function WRG_pool(){
  const s=WRG_state();
  if(!s)return [];
  const out=[];
  for(let i=0;i<s.wrongs.length;i++){
    const w=s.wrongs[i];
    if(w&&!w.fixed)out.push(w);
  }
  return out;
}
/* 統計：總數 / 已修復 / 待練習 / 各題型分佈 */
function WRG_stats(){
  const st={total:0,fixed:0,pending:0,byType:{}};
  const s=WRG_state();
  if(!s)return st;
  for(let i=0;i<s.wrongs.length;i++){
    const w=s.wrongs[i];
    if(!w)continue;
    st.total++;
    if(w.fixed)st.fixed++;else st.pending++;
    const t=String(w.type||w.source||"other");
    st.byType[t]=(st.byType[t]||0)+1;
  }
  return st;
}
/* 清除已修復的錯題 */
function WRG_clearFixed(){
  const s=WRG_state();
  if(!s)return 0;
  const before=s.wrongs.length;
  const keep=[];
  for(let i=0;i<s.wrongs.length;i++){
    const w=s.wrongs[i];
    if(w&&!w.fixed)keep.push(w);
  }
  const n=before-keep.length;
  s.wrongs=keep;
  if(n>0){ WRG_save(); try{ toast("已清除 "+n+" 題已修復的錯題","🧹"); }catch(e){} }
  else{ try{ toast("目前沒有已修復的錯題","🧹"); }catch(e){} }
  WRG_renderHome();
  return n;
}

/* =========================================================
   3. 錯題練習畫面 scr-wrong
   ========================================================= */
const WRG_BACK='<button class="back-btn" onclick="go(\'scr-home\')">‹ 返回大廳</button>';
function WRG_render(html){
  const scr=$("scr-wrong");
  if(!scr)return false;
  scr.innerHTML=WRG_BACK+html;
  return true;
}
function WRG_srcName(src){
  src=String(src||"");
  if(src==="toeic")return "多益挑戰";
  if(src==="mock")return "全真模擬考";
  if(src==="grammar")return "文法迷宮";
  if(src==="map")return "地圖任務";
  if(src==="battle")return "好友對決";
  return src||"其他";
}
function WRG_typeLabel(t){
  t=String(t||"other");
  if(t==="listen")return "🎧 聽力";
  if(t==="read")return "📖 閱讀";
  if(t==="grammar")return "📐 文法";
  if(t==="map")return "🗺️ 地圖";
  if(t==="toeic")return "📝 多益";
  if(t==="mock")return "📋 模擬考";
  if(t==="battle")return "⚔️ 對決";
  return "📝 "+t;
}
/* ---- 錯題本首頁（統計＋清單＋待複習單字） ---- */
function WRG_renderHome(){
  const s=WRG_state();
  if(!s)return false;
  const st=WRG_stats();
  let h='<div class="sec-title">📕 錯題練習</div>';
  h+='<div class="sec-sub">答錯的題會收進錯題本，連續答對 2 次自動移出；這裡也能複習到期單字</div>';
  h+='<div class="wrg-stats">'+
       '<div class="stat-card">📕 總錯題<b>'+st.total+'</b></div>'+
       '<div class="stat-card">✅ 已修復<b>'+st.fixed+'</b></div>'+
       '<div class="stat-card">🔥 待練習<b>'+st.pending+'</b></div>'+
     '</div>';
  const keys=Object.keys(st.byType);
  if(keys.length){
    h+='<div class="wrg-type-row">';
    for(let i=0;i<keys.length;i++){
      h+='<span class="wrg-tchip">'+WRG_typeLabel(keys[i])+' <b>'+st.byType[keys[i]]+'</b></span>';
    }
    h+='</div>';
  }
  h+='<div class="btn-row">'+
       '<button class="btn-main" id="wrg-start"'+(st.pending?"":" disabled")+'>🚀 開始錯題練習'+
         (st.pending?"（"+Math.min(st.pending,10)+" 題）":"")+'</button>'+
       '<button class="btn-sec" id="wrg-clear">🧹 清除已修復</button>'+
     '</div>';
  if(!st.total){
    h+='<div class="empty-note"><span class="en-emoji">🎉</span>目前沒有錯題！<br>到多益挑戰、文法迷宮答題，答錯的題目會自動收進這裡。</div>';
  }else{
    /* 待練習排前面，錯最多的排最上面 */
    const list=s.wrongs.slice().sort(function(a,b){
      if(!!a.fixed!==!!b.fixed)return a.fixed?1:-1;
      if(b.wrong!==a.wrong)return b.wrong-a.wrong;
      return String(a.last)<String(b.last)?1:-1;
    });
    h+='<div class="wrg-list-title">📋 錯題清單（'+st.pending+' 待練習 / '+st.fixed+' 已修復）</div>';
    h+='<div class="wrg-list">';
    for(let i=0;i<list.length&&i<30;i++){
      const w=list[i];
      const txt=w.q||(w.audio?"🎙️ "+w.audio:"（無題幹）");
      h+='<div class="wrg-item" style="animation-delay:'+(i*25)+'ms">'+
           '<span class="wrg-flag '+(w.fixed?"done":"new")+'">'+(w.fixed?"✅ 已修復":"❌ "+w.wrong+" 次")+'</span>'+
           '<span class="wrg-item-main">'+
             '<span class="wrg-item-q">'+esc(txt)+'</span>'+
             '<span class="wrg-item-sub">'+WRG_typeLabel(w.type)+' · '+esc(WRG_srcName(w.source))+
               (w.last?" · 最後作答 "+esc(w.last):"")+'</span>'+
             (!w.fixed&&w.picked>=0&&w.opts[w.picked]?
               '<span class="wrg-picked">上次錯選 '+String.fromCharCode(65+w.picked)+". "+esc(w.opts[w.picked])+'</span>':"")+
           '</span>'+
           '<span class="wrg-streak">🔥'+w.streak+"/2</span>'+
         '</div>';
    }
    h+='</div>';
    if(list.length>30)h+='<div class="mini-note">還有 '+(list.length-30)+' 題沒列出，先練習再清除吧。</div>';
  }
  h+=WRG_reviewHTML();
  h+='<div class="mini-note">💡 錯題會記錄你上次選的錯誤選項，練習時優先補強弱點。</div>';
  WRG_render(h);
  const sb=$("wrg-start"); if(sb)sb.onclick=WRG_start;
  const cb=$("wrg-clear"); if(cb)cb.onclick=WRG_clearFixed;
  return true;
}
function WRG_open(){
  WRG_boot();
  if(!$("scr-wrong"))return false;
  WRG_renderHome();
  go("scr-wrong");
  return true;
}
/* ---- 開始練習：從錯題池抽最多 10 題 ---- */
function WRG_start(){
  const pool=WRG_pool();
  const valid=[];
  for(let i=0;i<pool.length;i++){
    const w=pool[i];
    if(w.opts&&w.opts.length>=2&&w.a>=0)valid.push(w);
  }
  if(!pool.length){
    try{ toast("目前沒有待練習的錯題 🎉","✅"); }catch(e){}
    WRG_renderHome();
    return false;
  }
  if(!valid.length){
    try{ toast("錯題資料不完整（缺少選項），請先清除或重新作答","⚠️"); }catch(e){}
    WRG_renderHome();
    return false;
  }
  const qs=shuffle(valid).slice(0,10).map(function(w){return w.key});
  WRG_P={qs:qs,i:0,right:0,answered:false};
  WRG_renderQ();
  return true;
}
let WRG_P=null;
function WRG_renderQ(){
  if(!WRG_P)return false;
  const scr=$("scr-wrong");
  if(!scr)return false;
  if(WRG_P.i>=WRG_P.qs.length){ return WRG_end(); }
  const w=WRG_find(WRG_P.qs[WRG_P.i]);
  if(!w){ return WRG_end(); }
  WRG_P.answered=false;
  const total=WRG_P.qs.length,i=WRG_P.i;
  let h='<div class="wrg-practice-head">'+
          '<span class="wrg-badge">📕 錯題練習 · 連續答對 2 次移出</span>'+
          '<button class="wrg-exit" id="wrg-exit">✕ 離開</button>'+
        '</div>';
  h+='<div class="quiz-head"><div class="q-progress">'+
       '<div class="q-progress-fill" style="width:'+(i/total*100)+'%"></div></div>'+
       '<span class="q-counter">'+(i+1)+"/"+total+'</span></div>';
  h+='<div class="q-card">';
  h+='<span class="q-type'+(w.type==="read"?" reading":"")+'">'+esc(WRG_typeLabel(w.type))+" · "+esc(WRG_srcName(w.source))+"</span>";
  if(w.emoji)h+='<div class="q-emoji-scene">'+esc(w.emoji)+"</div>";
  if(w.passage)h+='<div class="q-passage">'+esc(w.passage).replace(/\n/g,"<br>")+"</div>";
  if(w.audio){
    h+='<div class="q-audio"><button class="audio-btn" id="wrg-audio">🔊</button>'+
       '<div><div class="audio-label">🎧 點一下重播音檔</div>'+
       '<div class="audio-locked">✍️ 作答後才顯示原文與解析</div></div></div>';
  }
  h+='<div class="q-text" style="margin-top:10px">'+esc(w.q)+"</div>";
  if(w.wrong>1||w.streak>0){
    h+='<div class="wrg-item-sub" style="margin-top:8px">❌ 累計錯 '+w.wrong+" 次　🔥 連續答對 "+w.streak+"/2"+
       (w.last?"　📅 "+esc(w.last):"")+"</div>";
  }
  h+="</div>";
  if(!w.opts||w.opts.length<2||w.a<0){
    h+='<div class="empty-note">此題的選項資料不完整，無法練習。<br>可按下方按鈕跳過，或清除已修復錯題。</div>';
    h+='<button class="next-btn show" id="wrg-next">跳過 ›</button>';
    WRG_P.answered=true;
  }else{
    h+='<div class="q-options" id="wrg-opts">';
    for(let k=0;k<w.opts.length;k++){
      h+='<button class="opt-btn" data-i="'+k+'"><span class="opt-key">'+String.fromCharCode(65+k)+
         "</span><span>"+esc(w.opts[k])+"</span></button>";
    }
    h+="</div>";
    h+='<div class="feedback" id="wrg-fb"></div>';
    h+='<button class="next-btn" id="wrg-next">'+(i+1>=total?"查看結果":"下一題 ›")+"</button>";
  }
  scr.innerHTML=WRG_BACK+h;
  const ex=$("wrg-exit"); if(ex)ex.onclick=WRG_quit;
  const au=$("wrg-audio"); if(au)au.onclick=function(){ try{ speak(w.audio); }catch(e){} };
  const nb=$("wrg-next"); if(nb)nb.onclick=WRG_next;
  const opts=document.querySelectorAll("#wrg-opts .opt-btn");
  opts.forEach(function(b){
    b.onclick=function(){ WRG_answer(parseInt(b.dataset.i,10)); };
  });
  return true;
}
/* ---- 作答：答對 → 修復累積；答錯 → 錯次 +1、連續歸零 ---- */
function WRG_answer(i){
  if(!WRG_P||WRG_P.answered)return false;
  const w=WRG_find(WRG_P.qs[WRG_P.i]);
  if(!w)return false;
  WRG_P.answered=true;
  const ok=(w.a>=0&&i===w.a);
  if(ok){ WRG_recovered(w,w.source); WRG_P.right++; }
  else{ WRG_record(w,i,w.source); }
  try{ gainStats(ok); }catch(e){}
  const fb=$("wrg-fb");
  if(fb){
    fb.className="feedback show "+(ok?"ok":"no");
    let title;
    if(ok)title='<div class="fb-title">✅ 答對了！'+(w.streak>=2?"　🎉 已修復，移出錯題池":"　🔥 連續答對 "+w.streak+"/2")+"</div>";
    else if(i<0)title='<div class="fb-title">⏰ 沒作答，正確答案是 '+String.fromCharCode(65+w.a)+"</div>";
    else title='<div class="fb-title">❌ 又答錯了，正確答案 '+String.fromCharCode(65+w.a)+"</div>";
    let body="";
    if(!ok&&w.opts&&w.opts[w.a])body+='<div><b>'+String.fromCharCode(65+w.a)+". "+esc(w.opts[w.a])+"</b></div>";
    if(w.zh)body+="<div>"+esc(w.zh)+"</div>";
    if(w.why)body+='<div style="margin-top:6px">💡 '+esc(w.why)+"</div>";
    fb.innerHTML=title+body;
  }
  const nb=$("wrg-next");
  if(nb){
    nb.classList.add("show");
    nb.textContent=(WRG_P.i+1>=WRG_P.qs.length?"查看結果":"下一題 ›");
  }
  if(ok)try{ confetti(8); }catch(e){}
  return ok;
}
function WRG_next(){
  if(!WRG_P)return false;
  WRG_P.i++;
  if(WRG_P.i>=WRG_P.qs.length)return WRG_end();
  return WRG_renderQ();
}
function WRG_quit(){
  WRG_P=null;
  WRG_renderHome();
  return true;
}
function WRG_end(){
  const p=WRG_P;
  WRG_P=null;
  const total=p?p.qs.length:0;
  const r=p?p.right:0;
  const pct=total?Math.round(r/total*100):0;
  const coins=r*3;
  if(coins>0){ try{ addCoins(coins); }catch(e){} }
  const st=WRG_stats();
  let emoji="🎉",word="錯題都修好了！";
  if(!total){emoji="😊";word="沒有可練習的錯題";}
  else if(pct<50){emoji="💪";word="繼續加油！";}
  else if(pct<100){emoji="🌟";word="表現不錯！";}
  let h='<div class="result-card"><div class="result-emoji">'+emoji+"</div>"+
        '<div class="result-title">'+word+"</div>"+
        '<div class="result-score">'+pct+" 分</div>"+
        '<div class="result-stats">'+
          '<div class="rs-item"><div class="rs-val">'+r+"/"+total+'</div><div class="rs-label">本輪答對</div></div>'+
          '<div class="rs-item"><div class="rs-val">'+st.pending+'</div><div class="rs-label">待練習錯題</div></div>'+
          '<div class="rs-item"><div class="rs-val">'+st.fixed+'</div><div class="rs-label">已修復</div></div>'+
        "</div>"+
        '<div class="reward-row"><span class="reward-pill">🪙 +'+coins+"</span></div>"+
        '<div class="btn-row"><button class="btn-sec" id="wrg-home2">回錯題本</button>'+
        '<button class="btn-main" id="wrg-again">🔁 再練一次</button></div></div>';
  WRG_render(h);
  const b1=$("wrg-home2"); if(b1)b1.onclick=WRG_renderHome;
  const b2=$("wrg-again"); if(b2)b2.onclick=WRG_start;
  if(pct>=80&&total)try{ confetti(30); }catch(e){}
  return true;
}

/* =========================================================
   4. 單字掌握度（間隔複習）：lv 0-3 → 間隔 1 / 3 / 7 天
   ========================================================= */
const WRG_IV=[1,3,7];
function WRG_wordKey(w){
  return String(w==null?"":w).trim().toLowerCase();
}
/* 單字練習結果：答對升級＋延後到期，答錯降級＋明天再見 */
function WRG_wordResult(word,ok){
  const s=WRG_state();
  if(!s)return null;
  const k=WRG_wordKey(word);
  if(!k)return null;
  let e=s.wordM[k];
  if(!e||typeof e!=="object"||Array.isArray(e)){
    e={lv:0,due:WRG_today(),last:""};
    s.wordM[k]=e;
  }
  if(typeof e.lv!=="number"||e.lv<0||e.lv>3)e.lv=0;
  if(typeof e.due!=="string"||!e.due)e.due=WRG_today();
  if(typeof e.last!=="string")e.last="";
  if(ok){
    if(e.lv<3)e.lv++;
    e.due=WRG_dayStr(WRG_IV[Math.max(0,e.lv-1)]);
  }else{
    if(e.lv>0)e.lv--;
    e.due=WRG_dayStr(1);      // 答錯 → 明天再複習
  }
  e.last=WRG_today();
  WRG_save();
  return e;
}
/* 今天到期（含昨天沒背熟 → due <= 今天），由最舊排到最新 */
function WRG_dueWords(){
  const s=WRG_state();
  if(!s)return [];
  const t=WRG_today();
  const tmp=[];
  for(const k in s.wordM){
    if(!Object.prototype.hasOwnProperty.call(s.wordM,k))continue;
    const e=s.wordM[k];
    if(!e||typeof e!=="object")continue;
    const due=(typeof e.due==="string")?e.due:"";
    if(!due||due>t)continue;
    tmp.push({w:k,due:due,lv:(typeof e.lv==="number"?e.lv:0)});
  }
  tmp.sort(function(a,b){
    if(a.due!==b.due)return a.due<b.due?-1:1;
    if(a.lv!==b.lv)return a.lv-b.lv;
    return a.w<b.w?-1:(a.w>b.w?1:0);
  });
  return tmp.map(function(x){return x.w});
}
/* 內嵌 onclick 用的字串安全化 */
function WRG_jsq(s){
  return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'")
                  .replace(/</g,"\\u003c").replace(/>/g,"\\u003e")
                  .replace(/"/g,"\\u0022");
}
/* 「📅 今日待複習單字」HTML 區塊（放首頁或單字頁皆可） */
function WRG_reviewHTML(){
  const due=WRG_dueWords();
  const n=due.length;
  const s=WRG_state();
  let h='<div class="q-card wrg-review"><span class="q-type reading">📅 今日待複習單字</span>';
  h+='<div class="q-text">'+(n?
      "今天有 <b>"+n+"</b> 個之前沒背熟的單字到期，先複習它們再學新字！":
      "✅ 目前沒有到期的待複習單字，繼續保持！")+"</div>";
  if(n){
    h+='<div class="wrg-review-head">⏳ 依到期日排序，顯示前 '+Math.min(n,10)+" 個</div>";
    h+='<div class="wrg-chips">';
    for(let i=0;i<n&&i<10;i++){
      const w=due[i];
      const e=(s&&s.wordM)?s.wordM[w]:null;
      const lv=(e&&typeof e.lv==="number")?e.lv:0;
      h+='<button class="wrg-chip" onclick="speak(\''+WRG_jsq(w)+"\')\">"+esc(w)+
         '<i class="wrg-lv">Lv'+lv+"</i></button>";
    }
    h+="</div>";
    if(n>10)h+='<div class="mini-note">還有 '+(n-10)+' 個字排在後面，背完今天的再回來。</div>';
  }
  h+="</div>";
  return h;
}
/* 每日單字啟動時呼叫：回傳要優先插到隊列最前面的字卡索引 */
function WRG_dailySeed(){
  const s=WRG_state();
  if(!s)return [];
  let cards=null;
  try{ if(typeof WORD_CARDS!=="undefined"&&Array.isArray(WORD_CARDS))cards=WORD_CARDS; }catch(e){}
  if(!cards||!cards.length)return [];
  const idx={};
  for(let i=0;i<cards.length;i++){
    const c=cards[i];
    if(c&&c.w)idx[WRG_wordKey(c.w)]=i;
  }
  const due=WRG_dueWords();
  const out=[];
  for(let i=0;i<due.length;i++){
    const n=idx[due[i]];
    if(typeof n==="number"&&out.indexOf(n)<0)out.push(n);
  }
  return out;
}

/* =========================================================
   5. 動態畫面與 CSS 注入
   ========================================================= */
function WRG_ensureScreen(){
  try{
    if(document.getElementById("scr-wrong"))return true;
    const d=document.createElement("div");
    d.className="screen";
    d.id="scr-wrong";
    d.innerHTML="";
    const host=document.getElementById("app")||document.body;
    if(!host)return false;
    host.appendChild(d);
    return true;
  }catch(e){ return false; }
}
function WRG_boot(){
  try{ WRG_injectCSS(); }catch(e){}
  WRG_ensureScreen();
  WRG_state();
}

/* ===== 對外 API ===== */
window.WRG_open=WRG_open;
window.WRG_record=WRG_record;
window.WRG_recovered=WRG_recovered;
window.WRG_wordResult=WRG_wordResult;
window.WRG_dueWords=WRG_dueWords;
window.WRG_reviewHTML=WRG_reviewHTML;
window.WRG_dailySeed=WRG_dailySeed;
/* 額外：整合時會用到的小工具 */
window.WRG_init=WRG_boot;
window.WRG_pool=WRG_pool;
window.WRG_stats=WRG_stats;
window.WRG_clearFixed=WRG_clearFixed;
window.WRG_render=WRG_renderHome;
window.WRG_answer=WRG_answer;
window.WRG_start=WRG_start;

/* ===== CSS 注入（防呆：重複載入只加一次） ===== */
function WRG_injectCSS(){
  try{
    if(document.getElementById("wrg-css"))return false;
    const st=document.createElement("style");
    st.id="wrg-css";
    st.textContent=WRG_CSS;
    const head=document.head||document.documentElement||document.body;
    if(!head)return false;
    head.appendChild(st);
    return true;
  }catch(e){ return false; }
}
WRG_injectCSS();
if(typeof document!=="undefined"){
  if(document.body)WRG_boot();
  else if(document.addEventListener)document.addEventListener("DOMContentLoaded",WRG_boot);
}
