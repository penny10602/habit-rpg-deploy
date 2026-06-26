# Daily RPG 部署指南

## 快速部署（推薦：Vercel）

### 步驟一：設定 Google Apps Script 後端

1. 前往 [Google Sheets](https://sheets.google.com) 建立新試算表，命名為 `Daily RPG Users`

2. 點選選單 **擴充功能 → Apps Script**

3. 刪除預設內容，把 `GAS_BACKEND.js` 的內容全部貼進去

4. 先執行 `setupSheet()` 函式一次（點選下拉選 `setupSheet` 再按 ▶ 執行），初始化欄位

5. 點選 **部署 → 新增部署**
   - 類型：**網路應用程式**
   - 執行身份：**我（你的 Google 帳號）**
   - 誰可以存取：**所有人**
   - 按下「部署」

6. 複製網路應用程式 URL（長這樣）：
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
   ```

### 步驟二：填入 GAS URL

打開 `src/HabitRPG_Pro.jsx`，找到第 ~70 行：

```js
const GAS_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

把 `YOUR_SCRIPT_ID` 換成你剛才複製的完整 URL。

### 步驟三：部署到 Vercel

1. 前往 [vercel.com](https://vercel.com) 免費註冊

2. 把整個 `habit-rpg-deploy` 資料夾推上 GitHub（或直接拖曳上傳）

3. Vercel 會自動偵測 Create React App，直接點 Deploy

4. 部署完成後取得網址，例如：`https://daily-rpg.vercel.app`

### 步驟四：加入手機主畫面（偽 App）

**iOS（Safari）：**
1. 用 Safari 開啟你的網址
2. 點底部「分享」按鈕 □↑
3. 選「加入主畫面」
4. 命名為「Daily RPG」→ 新增

**Android（Chrome）：**
1. 用 Chrome 開啟網址
2. 點右上角 ⋮ 選單
3. 選「新增至主螢幕」
4. 確認新增

---

## 功能說明

| 功能 | 說明 |
|------|------|
| 跨裝置好友搜尋 | 設定 GAS_URL 後支援不同手機互搜 |
| 好友監督 | 點「詳情 ▼」展開看好友每項習慣的本週打卡日曆 |
| 防刷獎勵 | 每天每項習慣只能獲得一次 XP 和金幣 |
| 月曆熱力圖 | 點「本月」Tab 查看當月打卡狀況 |
| 今日進度條 | 首頁顯示今天完成幾個習慣及百分比 |
| PWA 離線 | 加入主畫面後支援離線使用 |

---

## 本地開發

```bash
cd habit-rpg-deploy
npm install
npm start
# 開啟 http://localhost:3000
```

---

## 常見問題

**Q：好友搜尋找不到人？**
A：確認 GAS URL 設定正確，且對方有在你的 App 版本上登入過（會自動同步到 Sheet）。

**Q：部署後習慣沒有同步給好友看？**
A：每次打卡/新增習慣都會自動 sync 到 GAS。好友在監督頁點「🔄 同步最新習慣」即可更新。

**Q：GAS 回傳 CORS 錯誤？**
A：GAS 已設定 `Content-Type: text/plain` 避免 preflight，若仍有問題請確認部署時「誰可以存取」設為「所有人」。
