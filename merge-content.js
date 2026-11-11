/* 合併題庫：content-grammar-1..4.js -> content-grammar.js；content-mock-*.js -> content-mock.js */
const fs = require("fs");
const path = require("path");
const dir = __dirname;

// ---- 文法 ----
const G = {};
for (let i = 1; i <= 4; i++) {
  const src = fs.readFileSync(path.join(dir, "content-grammar-" + i + ".js"), "utf8");
  const part = eval(src + ";GRAM_Q" + i);
  for (const k in part) G[k] = part[k];
}
let total = 0;
for (const k in G) total += G[k].length;
if (Object.keys(G).length !== 12) throw "lessons=" + Object.keys(G).length;
if (total !== 600) throw "grammar total=" + total;
const out =
  "/* 文法題庫合併檔：12 課 x 50 題 = 600 題（由子代理生成後合併驗證） */\n" +
  "const GRAM_Q=" + JSON.stringify(G) + ";\n" +
  "if(typeof globalThis!==\"undefined\")globalThis.GRAM_Q=GRAM_Q;\n";
fs.writeFileSync(path.join(dir, "content-grammar.js"), out);
console.log("content-grammar.js lessons=" + Object.keys(G).length + " total=" + total + " bytes=" + out.length);

// ---- 模擬考 ----
function load(f, v) {
  return eval(fs.readFileSync(path.join(dir, f), "utf8") + ";" + v);
}
const bank = {
  listen: load("content-mock-l1.js", "MOCK_L1").concat(load("content-mock-l2.js", "MOCK_L2")),
  read: load("content-mock-r1.js", "MOCK_R1").concat(load("content-mock-r2.js", "MOCK_R2"))
};
if (bank.listen.length !== 130) throw "listen=" + bank.listen.length;
if (bank.read.length !== 130) throw "read=" + bank.read.length;
const out2 =
  "/* 多益模擬考題庫合併檔：聽力 130 + 閱讀 130 = 260 題 */\n" +
  "const MOCK_BANK=" + JSON.stringify(bank) + ";\n" +
  "if(typeof globalThis!==\"undefined\")globalThis.MOCK_BANK=MOCK_BANK;\n";
fs.writeFileSync(path.join(dir, "content-mock.js"), out2);
console.log("content-mock.js listen=" + bank.listen.length + " read=" + bank.read.length + " bytes=" + out2.length);
