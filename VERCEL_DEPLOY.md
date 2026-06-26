# 🚀 HabitRPG - Vercel 部署指南

## 📋 項目結構

這個完整的項目包含：
```
habit-rpg/
├── public/
│   └── index.html          ✅ 主 HTML 文件
├── src/
│   ├── HabitRPG_Pro.jsx    ✅ 應用程式
│   └── index.js            ✅ React 入口
├── package.json            ✅ 依賴配置
├── vercel.json             ✅ Vercel 配置
└── .gitignore              ✅ Git 忽略文件
```

## ⚠️ 為什麼之前出現 404？

之前只上傳了 `HabitRPG_Pro.jsx`，缺少：
- ❌ package.json（沒有依賴資訊）
- ❌ public/index.html（沒有 HTML 入口）
- ❌ src/index.js（沒有 React 渲染點）
- ❌ vercel.json（沒有構建配置）

現在有了完整的項目結構！

---

## 🎯 部署到 Vercel 的 3 步驟

### 方法 A：使用 GitHub（推薦 ⭐）

#### 第 1 步：上傳到 GitHub

```bash
# 1. 在本地創建 Git 倉庫
git init

# 2. 添加所有文件
git add .

# 3. 提交
git commit -m "Initial commit - HabitRPG"

# 4. 添加 GitHub 遠程倉庫
git branch -M main
git remote add origin https://github.com/你的用戶名/habit-rpg.git

# 5. 推送到 GitHub
git push -u origin main
```

#### 第 2 步：連接 Vercel

1. 訪問 [vercel.com](https://vercel.com)
2. 用 GitHub 帳戶登入（或創建帳戶）
3. 點擊「New Project」
4. 選擇你的 `habit-rpg` 倉庫
5. Vercel 會自動檢測設置
6. 點擊「Deploy」

#### 第 3 步：完成！

等待 1-2 分鐘，你會得到一個網址：
```
https://habit-rpg-xxx.vercel.app
```

---

### 方法 B：直接使用 Vercel CLI

如果已安裝 Node.js：

```bash
# 1. 全局安裝 Vercel CLI
npm install -g vercel

# 2. 在項目目錄運行
vercel

# 3. 按照提示選擇設置
# - Set up and deploy? → yes
# - Which scope? → 選擇你的賬戶
# - Link to existing project? → no
# - Project name? → habit-rpg

# 4. 自動部署完成！
```

---

## ✅ 部署後的檢查清單

- [ ] 網站能打開（不是 404）
- [ ] 可以創建帳戶
- [ ] 可以添加習慣
- [ ] 可以標記完成
- [ ] 數據存儲在本地
- [ ] 深色模式可切換
- [ ] 在手機上也能用

---

## 🔄 更新部署

如果修改了代碼：

```bash
# 1. 提交更改
git add .
git commit -m "更新描述"

# 2. 推送到 GitHub
git push

# Vercel 會自動重新部署！
```

---

## 🆘 如果仍然出現 404

### 檢查清單：

1. **確認 vercel.json 存在**
   ```bash
   cat vercel.json
   ```

2. **確認文件結構正確**
   ```bash
   ls -la src/
   ls -la public/
   ```

3. **檢查 package.json 有效性**
   ```bash
   cat package.json
   ```

4. **查看 Vercel 構建日誌**
   - 登入 Vercel 控制面板
   - 點擊你的項目
   - 查看「Deployments」選項卡
   - 點擊最新部署查看日誌

5. **清除並重新部署**
   - 在 Vercel 中刪除項目
   - 重新連接 GitHub 倉庫

---

## 📱 在手機上使用

部署成功後：

**iOS（Safari）：**
1. 打開你的 Vercel 網址
2. 點擊分享 → 添加到主屏幕
3. 就像原生應用一樣使用！

**Android（Chrome）：**
1. 打開你的 Vercel 網址
2. 點擊菜單 → 安裝應用
3. 完成！

---

## 💡 常見問題

**Q: 部署需要多久？**
A: 首次 2-3 分鐘，後續更新 1 分鐘

**Q: 費用多少？**
A: 免費！Vercel 的免費額度足夠個人使用

**Q: 如果網站掉線怎麼辦？**
A: Vercel 的正常運行時間 > 99.9%，非常可靠

**Q: 可以用自定義域名嗎？**
A: 可以！但需要付費升級（或使用免費的 `.vercel.app` 域名）

**Q: 數據會被上傳嗎？**
A: 不會。所有數據都存儲在用戶的瀏覽器中

---

## 🎉 成功部署後

你現在有一個：
- ✅ 線上 React 應用
- ✅ 可以分享的網址
- ✅ 自動更新部署
- ✅ 完全免費的託管

在朋友圈分享你的習慣追蹤應用吧！🌱

---

## 📞 需要幫助？

- Vercel 文檔：https://vercel.com/docs
- React 文檔：https://react.dev
- 本地測試：`npm start` 在 localhost:3000 運行

祝部署成功！🚀
