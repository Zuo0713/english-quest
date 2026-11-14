/* 拼字音變分析：判斷 p+r+s 組合與真實單字的差異，是否屬於合法英語音變 */
const fs=require("fs"),vm=require("vm");
const ctx={console};vm.createContext(ctx);
const h=fs.readFileSync(__dirname+"/index.html","utf8");
function grab(name){
  const i=h.indexOf("const "+name+"=[");
  if(i<0)return null;
  const j=h.indexOf("[",i);let d=0;
  for(let k=j;k<h.length;k++){if(h[k]==="[")d++;else if(h[k]==="]"){d--;if(d===0)return vm.runInContext("("+h.slice(j,k+1)+")",ctx)}}
  return null;
}
const WORD_CARDS=grab("WORD_CARDS")||[];
const clean=s=>String(s||"").replace(/^-+|-+$/g,"").toLowerCase();

/* 對字根套用所有合法音變，產生候選字形 */
function variants(r){
  const base=new Set([r]);
  const grow=(set,fn)=>{const n=new Set(set);set.forEach(x=>{const y=fn(x);if(y&&y!==x)n.add(y)});return n};
  let v=base;
  v=grow(v,x=>x.replace(/y$/,"i"));      // happy → happi
  v=grow(v,x=>x.replace(/e$/,""));       // believe → believ, create → creat
  v=grow(v,x=>x.replace(/b$/,"p"));      // scrib → scrip
  v=grow(v,x=>x.replace(/b$/,""));       // scrib → scri  (scrip+tive 之前)
  v=grow(v,x=>x.replace(/t$/,"ss"));     // mit → miss
  v=grow(v,x=>x.replace(/c$/,""));       // 不太可能，保險
  // 再跑一次 y→i / 去 e 的組合
  v=grow(v,x=>x.replace(/y$/,"i"));
  v=grow(v,x=>x.replace(/e$/,""));
  return [...v];
}
function combos(p,r,s){
  const out=new Set();
  variants(r).forEach(R=>{
    [s,""].forEach(S=>{
      if(!S&&s)return;                   // 不允許憑空丟掉字尾（除非 s 本來就空）
      out.add(clean(p)+R+clean(S));
      out.add(clean(p)+R+clean(S).replace(/^-/,""));
    });
  });
  // 允許字尾本身的音變（-tion ↔ -ion 等）
  const sAlts=[s];
  if(/tion$/.test(s))sAlts.push(s.replace(/tion$/,"ion"));
  variants(r).forEach(R=>sAlts.forEach(S=>out.add(clean(p)+R+clean(S))));
  return out;
}
const RULES=["原樣","y→i","去尾e","b→p","去尾b","t→ss"];
let ok=0,fail=[];
WORD_CARDS.forEach(c=>{
  const w=clean(c.w);
  const set=combos(c.p,c.r,c.s);
  if(set.has(w)){ok++;return}
  // 嘗試用「只差一點」找最接近的規則
  fail.push(c);
});
console.log("拼合完全吻合（含音變規則）= "+ok+" / "+WORD_CARDS.length);
if(fail.length){
  console.log("\n仍不吻合 = "+fail.length);
  fail.forEach(c=>{
    const w=clean(c.w);
    const best=[...combos(c.p,c.r,c.s)].sort((a,b)=>{
      const d=x=>{let i=0;while(i<x.length&&i<w.length&&x[i]===w[i])i++;return Math.abs(x.length-w.length)+ (x.length-i)};
      return d(a)-d(b);
    })[0];
    console.log("  "+c.w+"  built="+clean(c.p)+clean(c.r)+clean(c.s)+"  最接近候選="+best+"  (p="+c.p+" r="+c.r+" s="+c.s+")");
  });
}
