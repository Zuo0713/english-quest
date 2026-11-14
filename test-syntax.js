/* 抽出 index.html 內嵌 <script>（非 src）並做語法檢查 */
const fs=require("fs"),vm=require("vm"),path=require("path");
const h=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const re=/<script([^>]*)>([\s\S]*?)<\/script>/g;
let m,ok=0,bad=0,n=0;
while((m=re.exec(h))){
  const attrs=m[1]||"";
  if(/\bsrc\s*=/.test(attrs))continue;
  n++;
  const code=m[2];
  try{new vm.Script(code,{filename:"inline-script-"+n+".js"});ok++;}
  catch(e){
    bad++;
    console.log("SYNTAX ERROR in <script #"+n+">:");
    console.log(e.message);
    // 印出錯誤行附近
    const ln=(e.stack.match(/inline-script-\d+\.js:(\d+)/)||[])[1];
    if(ln){
      const lines=code.split("\n");
      for(let i=Math.max(0,ln-3);i<Math.min(lines.length,ln+2);i++)
        console.log("  "+(i+1)+": "+lines[i]);
    }
  }
}
console.log("內嵌 script 數 = "+n+"，通過 "+ok+"，失敗 "+bad);
process.exit(bad?1:0);
