/* 掃描所有題庫，驗證每題答案是否正確 */
const fs=require("fs"),vm=require("vm");
const ctx={console,module:{exports:{}},Set,Math,JSON,Array,Object,String,Number,Boolean,RegExp,Date};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+"/verify.js","utf8"),ctx);
function load(f){vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),ctx)}
load("content-grammar.js");load("content-mock.js");load("content-mock-extra.js");

const h=fs.readFileSync(__dirname+"/index.html","utf8");
function grab(name){
  const i=h.indexOf("const "+name+"=[");
  if(i<0)return null;
  const j=h.indexOf("[",i);
  let d=0;
  for(let k=j;k<h.length;k++){
    if(h[k]==="[")d++;
    else if(h[k]==="]"){d--;if(d===0){
      try{return vm.runInContext("("+h.slice(j,k+1)+")",ctx)}catch(e){console.log("ERR",name,e.message);return null}
    }}
  }
  return null;
}
const TOEIC_Q=grab("TOEIC_Q")||[];
const GRAMMAR=grab("GRAMMAR")||[];
const gInline=[];GRAMMAR.forEach(g=>(g.q||[]).forEach(q=>gInline.push(q)));

const banks=[
  {name:"TOEIC_Q",qs:TOEIC_Q},
  {name:"GRAMMAR_inline",qs:gInline},
  {name:"GRAM_Q",qs:Object.keys(ctx.GRAM_Q).reduce((a,k)=>a.concat(ctx.GRAM_Q[k]),[])},
  {name:"MOCK_BANK.listen",qs:ctx.MOCK_BANK.listen},
  {name:"MOCK_BANK.read",qs:ctx.MOCK_BANK.read},
  {name:"MOCK_EXTRA.listen",qs:ctx.MOCK_EXTRA.listen},
  {name:"MOCK_EXTRA.read",qs:ctx.MOCK_EXTRA.read}
];
const counts=banks.map(b=>b.name+"="+b.qs.length).join(" ");
console.log("BANKS: "+counts);

const probs=ctx.verifyBanks(banks);
console.log("TOTAL PROBLEMS = "+probs.length);
const byKind={};probs.forEach(p=>byKind[p.kind]=(byKind[p.kind]||0)+1);
console.log("BY KIND: "+JSON.stringify(byKind));
probs.slice(0,50).forEach(p=>console.log("  - "+p.id+" | "+p.kind+" | "+p.msg));
