# 🎮 English Quest 多益冒險島

遊戲化的多益英文學習應用，附 **Node.js 雲端後端**：任何人在任何裝置用同一個網址註冊登入，進度即時同步。

## ✨ 功能

| 模式 | 說明 |
|------|------|
| 📝 多益挑戰 | 聽力 + 閱讀模擬測驗（Part 1–7），限時計分 |
| 📋 200 題全真模擬考 | **聽力 100 ＋ 閱讀 100、總時 2 小時**，每次隨機抽題（題庫 300+ 題），交卷後看總分 990、聽力／閱讀分項與完整解析 |
| 🎧 聽力解析 | **先念一次、作答後才揭曉**：顯示原文（關鍵字圈起來）＋ 句意 ＋ 為什麼選它 |
| 🔤 單字工廠 | ① 每日單字 ② **字根分組**（同字根的字一起背）③ **12000 字表＋拼字檢查**（每字意思＋1-2 例句）④ 拼字遊戲 ⑤ 閃卡 ⑥ 字根樹 ⑦ 字綴總表 |
| 📅 每日單字 | 設定一天背 5/10/15/20/30 個；先看**字首＋字根＋字尾組合意思**，背滿配額才解鎖 10 題考試（60 分及格） |
| 📅 行事曆登入 | 每日登入改**行事曆樣式**，有登入就打勾，可翻月查看 |
| 📐 文法迷宮 | 12 個關卡由淺入深，**每課 50 題**（簡單→困難），規則解說 + 圖解例句，75 分解鎖下一關 |
| ⚔️ 好友對決 | 一次 **20 題隨機生成**，答錯扣自己 5 HP，最後 HP 高者獲勝；AI 三難度＝TOEIC 300／550／750 強度 |
| 👥 UID 好友 | 每個帳號有 6 碼 UID，加好友後可看對方**等級與連續登入天數** |
| 📅 每日獎勵 | 7 天連續登入遞增獎勵，中斷歸零 |
| 🏆 等級 1–100 | XP 曲線 `80+lv×40`（滿級約 20 萬 XP），每 10 級換稱號，Lv100 = **多益之神** |
| 👥 雲端帳號 | 註冊／登入／登出，**重新啟動不忘記登入**（token 持久），跨裝置同步，密碼以 **scrypt 雜湊**保存 |

### 📚 題庫來源

- **文法**：12 課 × 50 題 ＝ 600 題（原創，由簡單到困難）
- **全真模擬考**：原創題庫 300+ 題（聽力 Part 1–4、閱讀 Part 5–7），風格參考 [Google Drive 多益題庫](https://drive.google.com/drive/folders/1JxKe0NmTtHyewLUCEEu6l1FXAqxk_zcW) 的 ETS 官方題型，**衍生更多商業與生活情境題**（原創內容，不複製版權試卷）
- **12000 字表**：ECDICT 詞頻排序選字 ＋ Tatoeba 例句（含中文翻譯），每字至少 1 句

## ▶️ 本機執行（含帳號功能）

需要 Node.js ≥ 18：

```powershell
cd 學習多益的專案
npm start          # 或 node server.js
```

開啟 `http://localhost:3000`，註冊帳號即可遊玩；換電腦／手機連同一網址登入，進度自動還原。

> 雙擊 `index.html`（`file://`）也能玩，但會自動**退回本機帳號模式**（資料只存這台裝置的瀏覽器）。

### 帳號 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/register` | `{user, pass}` → `{token, user, state}` |
| POST | `/api/login` | `{user, pass}` → `{token, user, state}` |
| POST | `/api/logout` | `{token}` |
| GET | `/api/me` | 需 header `x-token` → `{user}` |
| GET | `/api/state` | 需 `x-token` → 讀取遊戲存檔 |
| POST | `/api/state` | 需 `x-token`，body `{state}` → 儲存存檔 |

### 🔒 密碼安全（為什麼不怕外流）

- 密碼以 **scrypt（N=16384, r=8, p=1）＋ 每帳號獨立 16 bytes salt** 雜湊後才存入 `data/db.json`
- 資料庫**不保存明碼密碼**，伺服器程式也從不輸出密碼
- 比對用 `crypto.timingSafeEqual`，防時序側信道攻擊
- 註冊／登入有每 IP 頻率限制（10 分鐘 15 次），防暴力試密碼
- 明碼密碼只在 HTTPS 傳輸時送到自家後端做一次驗證，不寫進任何檔案

### 📁 資料存放

帳號與存檔寫在 `data/db.json`（原子寫入，程式結束前自動 flush）。想重置所有帳號：關掉伺服器後刪除 `data/db.json` 再啟動。

## ☁️ 部署到免費雲平台（給遠方朋友用網址）

### Render（推薦，有免費方案）

1. 把專案推到 GitHub
2. 到 [render.com](https://render.com) → **New → Web Service** → 選該 repo
3. 設定：
   - **Build Command**：（留空）
   - **Start Command**：`node server.js`
   - **Environment**：`Node`
4. Deploy 完成後會給你 `https://xxx.onrender.com` 網址，直接分享給朋友註冊登入

### Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Railway 偵測到 `package.json` 會自動跑 `npm start`
3. **Settings → Networking → Generate Domain** 產生公開網址

### ⚠️ 免費雲端磁碟注意事項

Render／Railway 的免費方案磁碟是**暫時性的（ephemeral）**，服務重啟或重新部署後 `data/db.json` 可能被清空，帳號會需要重註冊。若要永久保存：

- 付費方案綁定 Persistent Disk，把 `DATA_DIR` 指到該磁碟（本專案支援環境變數 `DATA_DIR`）
- 或改接 PostgreSQL／SQLite 等外部資料庫

本機跑 `node server.js` 則完全不受影響，資料一直留在你的電腦。

## 📲 安裝成 App（PWA）

> ⚠️ PWA 安裝需要透過 **HTTPS 或本機伺服器** 開啟（`file://` 無法註冊 Service Worker）。

用 `npm start` 起的伺服器即可，開啟 `http://localhost:3000` 後：

### Android（Chrome）

1. 用 Chrome 開啟網址
2. 點選右上角 **⋮ → 安裝應用程式 / 加入主畫面**
3. 確認後即出現在桌面，可全螢幕獨立執行

### iOS（Safari）

1. 用 Safari 開啟網址
2. 點選底部 **分享按鈕 → 加入主畫面**
3. 命名後確認，桌面即出現 English Quest 圖示

> 正式給朋友使用時，把專案放到任意 HTTPS 空間（GitHub Pages、Netlify、Vercel 等）即可分享連結安裝。

## 📦 打包成原生 App（上架 App Store / Google Play）

使用 [Capacitor](https://capacitorjs.com) 把網頁包成原生 App：

```powershell
# 1. 安裝 Node.js 後，在專案資料夾執行
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. 初始化（一開始的問題都按 Enter 使用預設值）
npx cap init "English Quest" com.yourname.englishquest --web-dir .

# 3. 加入平台
npx cap add android
npx cap add ios

# 4. 同步網頁檔案到原生專案
npx cap sync

# 5. 開啟原生專案
npx cap open android   # 用 Android Studio 開啟
npx cap open ios       # 用 Xcode 開啟（需 macOS）
```

### Android 上架（Google Play）

1. Android Studio → **Build → Generate Signed Bundle / APK**
2. 建立金鑰（keystore）並產出 `.aab`
3. 到 [Google Play Console](https://play.google.com/console) 建立開發者帳號（一次性 US$25）
4. 上傳 `.aab`、填寫商店頁面資料、送出審核（通常 1–7 天）

### iOS 上架（App Store）

1. 需要 **Mac + Xcode** 與 Apple 開發者帳號（US$99/年）
2. Xcode 中設定你的 Team、Bundle ID，**Build → Archive**
3. 上傳到 [App Store Connect](https://appstoreconnect.apple.com)
4. 填寫商店頁面資料、送出審核（通常 1–3 天）

> 💡 Android 上架也可以不經 Google Play，改用 [PWA Builder](https://www.pwabuilder.com) 產生 TWA 安裝包，或直接把 APK 網址給朋友安裝。

## 💾 帳號與資料

- **雲端模式（http/https）**：帳號與存檔保存在伺服器 `data/db.json`，跨裝置登入同步
- **離線模式（file:// 或斷網）**：自動退回瀏覽器 localStorage，功能不中斷
- 每個帳號獨立：金幣、等級、XP、文法進度、對戰紀錄、連續登入天數、每日單字進度
- 首次註冊的帳號會自動繼承訪客模式累積的進度
- 密碼只以 scrypt 雜湊保存，明碼不存、不外流

## 📁 檔案結構

```
學習多益的專案/
├── index.html             # 遊戲主體（單檔前端）
├── server.js              # Node.js 後端（靜態檔 + 帳號 + 存檔 + UID 好友 API，零相依）
├── package.json           # npm start → node server.js
├── data/db.json           # 帳號資料庫（執行後自動建立，已 gitignore）
├── content-grammar.js     # 文法題庫（12 課 × 50 題 ＝ 600 題）
├── content-mock.js        # 模擬考題庫（聽力 130 ＋ 閱讀 130）
├── content-mock-extra.js  # 商業／生活衍生題（聽力 29 ＋ 閱讀 50）
├── words12k.js            # 12000 字表（意思＋音標＋例句，3.5MB 動態載入）
├── manifest.json          # PWA 設定
├── sw.js                  # Service Worker（離線快取 v3，API 不快取）
├── icon.svg               # 向量圖示
├── icon-180.png           # iOS 主畫面圖示
├── icon-192.png           # PWA 圖示
├── icon-512.png           # PWA 圖示 / 安裝畫面
└── README.md
```
