/* 題庫答案驗證器：掃描所有題庫，回傳問題清單 */
function verifyBanks(banks){
  const problems=[];
  banks.forEach(function(bank){
    const name=bank.name, qs=bank.qs||[];
    const seen={};
    qs.forEach(function(q,i){
      const id=name+"#"+i;
      if(!q||typeof q!=="object"){problems.push({id:id,kind:"格式",msg:"不是物件"});return}
      if(!Array.isArray(q.o)){problems.push({id:id,kind:"選項",msg:"o 不是陣列"});return}
      if(q.o.length<2){problems.push({id:id,kind:"選項",msg:"選項少於 2 個"});return}
      if(typeof q.a!=="number"||q.a!==Math.floor(q.a)){problems.push({id:id,kind:"答案",msg:"a 不是整數："+JSON.stringify(q.a)});return}
      if(q.a<0||q.a>=q.o.length){problems.push({id:id,kind:"答案",msg:"a="+q.a+" 超出範圍 0.."+(q.o.length-1)});return}
      if(typeof q.o[q.a]!=="string"||!q.o[q.a].trim()){problems.push({id:id,kind:"答案",msg:"正確選項為空"});return}
      // 正確答案必須唯一（不能有重複選項讓答案變成多解）
      const ans=q.o[q.a];
      const dup=q.o.filter(function(x){return x===ans}).length;
      if(dup>1)problems.push({id:id,kind:"重複",msg:"正確答案「"+ans+"」出現 "+dup+" 次，答案不唯一"});
      // 其他選項互相重複（不算致命，但列出）
      const others=q.o.filter(function(_,j){return j!==q.a});
      if(new Set(others).size!==others.length)problems.push({id:id,kind:"重複",msg:"非正確選項之間有重複"});
      q.o.forEach(function(o,j){
        if(typeof o!=="string"||!o.trim())problems.push({id:id,kind:"選項",msg:"第 "+j+" 個選項為空"});
      });
      // 題幹
      if(typeof q.q!=="string"||!q.q.trim())problems.push({id:id,kind:"題幹",msg:"題幹為空"});
      // 聽力題必須有 audio
      if(q.t==="listen"&&!q.audio)problems.push({id:id,kind:"聽力",msg:"t=listen 但沒有 audio"});
      // 完全重複題目（題幹+選項+答案）
      const key=(q.q||"")+"|"+(q.o||[]).join("~")+"|"+q.a;
      if(seen[key])problems.push({id:id,kind:"重複",msg:"與 "+seen[key]+" 完全重複"});
      else seen[key]=id;
      // 選項裡有 undefined / null
      (q.o||[]).forEach(function(o,j){
        if(o===undefined||o===null)problems.push({id:id,kind:"選項",msg:"第 "+j+" 個選項為 "+o});
      });
    });
  });
  return problems;
}
if(typeof module!=="undefined"&&module.exports)module.exports={verifyBanks:verifyBanks};
