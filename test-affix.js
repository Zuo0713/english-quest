/* 分析字首/字根/字尾：
   1) 字尾與字根重疊（使用者要求修正的「字尾跟字根重複」）→ 必須為 0
   2) p+r+s 拼合 ≠ 真實單字 → 區分「非法錯誤」與「合法英語音變」
   合法音變白名單（英語拼字規則，非資料錯誤）：
     y→i (happy→happi-)、去 e (believe→believ-)、b→p (scrib→scrip-)、t→ss (mit→miss-)、
     去 e + -ive (create→creativ-)、輔音變化 (describ→descript-)
*/
const fs=require("fs"),vm=require("vm");
const ctx={console,module:{exports:{}},Set,Math,JSON,Array,Object,String,Number,Boolean,RegExp,Date};
vm.createContext(ctx);
const h=fs.readFileSync(__dirname+"/index.html","utf8");
function grab(name){
  const i=h.indexOf("const "+name+"=[");
  if(i<0)return null;
  const j=h.indexOf("[",i);
  let d=0;
  for(let k=j;k<h.length;k++){
    if(h[k]==="[")d++;
    else if(h[k]==="]"){d--;if(d===0)return vm.runInContext("("+h.slice(j,k+1)+")",ctx)}
  }
  return null;
}
const WORD_CARDS=grab("WORD_CARDS")||[];
const ROOTS=grab("ROOTS")||[];
const PREFIXES=grab("PREFIXES")||[];
const SUFFIXES=grab("SUFFIXES")||[];
console.log("WORD_CARDS="+WORD_CARDS.length+" ROOTS="+ROOTS.length+" PREFIXES="+PREFIXES.length+" SUFFIXES="+SUFFIXES.length);

const clean=s=>String(s||"").replace(/^-+|-+$/g,"").toLowerCase();

/* ---- 1) 字尾與字根重疊（必須 0） ---- */
let overlap=[];
WORD_CARDS.forEach(c=>{
  const r=clean(c.r), s=clean(c.s);
  if(!s)return;
  if(r===s){overlap.push({w:c.w,r:c.r,s:c.s,why:"完全相同"});return}
  if(r.endsWith(s)){overlap.push({w:c.w,r:c.r,s:c.s,why:"字根結尾已含字尾"});return}
  if(s.endsWith(r)){overlap.push({w:c.w,r:c.r,s:c.s,why:"字尾結尾已含字根"});return}
  for(let k=1;k<Math.min(r.length,s.length);k++){
    if(r.slice(-k)===s.slice(0,k)){overlap.push({w:c.w,r:c.r,s:c.s,why:"邊界重疊 "+k+" 字元 "+r.slice(-k)});break}
  }
});
console.log("\n[1] 字尾與字根重疊 = "+overlap.length+"  (要求 0)");
overlap.forEach(o=>console.log("   !! "+o.w+"  r="+o.r+" s="+o.s+"  ["+o.why+"]"));

/* ---- 2) 拼合 ≠ 真實單字：區分音變 vs 非法 ---- */
/* 合法英語音變白名單（字根套用規則後可拼出真實單字）：
   y→i (happy→happi)、去尾e (believe→believ)、b→p (scrib→scrip)、
   去尾b (scrib→scri)、t→ss (mit→miss) 及其組合 */
function variants(p,r,s,w){
  const grow=(set,fn)=>{const n=new Set(set);set.forEach(x=>{const y=fn(x);if(y&&y!==x)n.add(y)});return n};
  let v=new Set([r]);
  v=grow(v,x=>x.replace(/y$/,"i"));
  v=grow(v,x=>x.replace(/e$/,""));
  v=grow(v,x=>x.replace(/b$/,"p"));
  v=grow(v,x=>x.replace(/b$/,""));
  v=grow(v,x=>x.replace(/t$/,"ss"));
  v=grow(v,x=>x.replace(/y$/,"i"));
  v=grow(v,x=>x.replace(/e$/,""));
  const res=new Set();
  const sAlts=[s];
  if(/tion$/.test(s))sAlts.push(s.replace(/tion$/,"ion"));
  v.forEach(rr=>sAlts.forEach(S=>{res.add(clean(p)+rr+clean(S));res.add(clean(p)+rr)}));
  return res;
}
let illegal=[],toneChanges=[];
WORD_CARDS.forEach(c=>{
  const p=clean(c.p),r=clean(c.r),s=clean(c.s),w=clean(c.w);
  if(p+r+s===w)return;                       // 完全正確
  const alts=[...variants(p,r,s,w)];
  const hit=alts.some(x=>x===w);
  const rec={w:c.w,p:c.p,r:c.r,s:c.s,built:p+r+s};
  if(hit)toneChanges.push(rec); else illegal.push(rec);
});
console.log("\n[2] 拼合檢核：合法音變 = "+toneChanges.length+"，非法錯誤 = "+illegal.length+" (要求 0)");
toneChanges.forEach(o=>console.log("   ~音變 "+o.w+"  "+o.built+" → "+o.w));
illegal.forEach(o=>console.log("   !!非法 "+o.w+"  built="+o.built+" (p="+o.p+" r="+o.r+" s="+o.s+")"));

/* ---- 3) ROOTS 內字詞的字尾重疊 ---- */
let rootOverlap=[];
ROOTS.forEach(g=>{
  const r=clean(g.r);
  (g.w||[]).forEach(x=>{
    const s=clean(x.s);
    if(!s)return;
    if(r===s||r.endsWith(s)||s.endsWith(r))rootOverlap.push(g.r+"/"+x.w+" r="+g.r+" s="+x.s);
  });
});
console.log("\n[3] ROOTS 字尾重疊 = "+rootOverlap.length+"  (要求 0)");
rootOverlap.forEach(o=>console.log("   !! "+o));

/* ---- 總結 ---- */
const pass=overlap.length===0&&illegal.length===0&&rootOverlap.length===0;
console.log("\n==== "+(pass?"PASS ✅":"FAIL ❌")+" ====");
process.exit(pass?0:1);
