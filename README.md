# Korea Lyrics Translator · 韓語歌詞詞源標註器

[開啟網站](https://smartleo123.github.io/Korea-Lyrics-Translator/)

以繁體中文閱讀韓語歌詞：貼上原始歌詞，自動辨識漢字詞（紅色、附漢字）、固有詞／文法（白色）、外來語（紫色），所有註解一開始就顯示。點選詞彙修正，結果可下載成獨立 HTML。

## 技術實作

- **韓語形態分析**：[Garu](https://github.com/ongjin/garu) (WebAssembly，Apache-2.0)，在瀏覽器上執行，支援語尾與助詞的語法分割。
- **漢字詞典**：[HanjaHanja Dictionary](https://github.com/ongocompany/hanjahanja-dict)，基於國立國語院 우리말샘／標準國語大辭典衍生資料。CI 在部署時生成數萬筆可查詢的詞條；同音同形詞的多個漢字寫法保留為候選，而不擅自選擇。
- **人工校正**：內建小詞庫優先指定部分固有詞等常見誤判；亦可點擊任何詞修正，並將結果保存在瀏覽器 localStorage。可匯入／匯出 JSON 詞庫。
- **純靜態網站**：使用 Vite 建置至 `dist/`，GitHub Actions 自動部署 GitHub Pages，不需伺服器或 AI API Key。

## 辨識限制

**詞源分類並不等於正確翻譯。** 形態分析模型會出現切詞與詞性錯誤，歌詞中省略、口語、縮寫、押韻轉寫等尤其容易混淆。缺詞和多義詞會標示「待確認」或「漢字歧義」，不會把第一筆同音漢字冒充為正解。固有詞的中文釋義目前以精選詞庫為主；沒有詞義的詞不杜撰翻譯。人稱、助詞與語尾沒有必要填漢字。

詞典來自原始辭典整理，不保證每首歌都達到「完整」或「高準確率」；尤其漢字詞的上下文選字需要人工確認。

## 專案建置

```bash
npm install
python3 .github/scripts/build_dict.py
node scripts/copy-model.mjs
npm test
npm run build
```

本機 `npm run dev` 前也請先生成詞典與模型檔案。

## 開源出處與授權

- Garu 原始碼與形態分析模型相關資訊：[Apache-2.0 / NOTICE](https://github.com/ongjin/garu/blob/main/NOTICE)，其詞典衍生資料含 CC BY-SA 2.0 KR 條款，請參閱原始 NOTICE。
- HanjaHanja Dictionary：資料源為 **국립국어원 우리말샘／표준국어대사전**，經 HanjaHanja 加工的漢字詞表採 **CC BY-SA 2.0 KR**（署名・相同方式分享）。網站生成的 `hanja-dict.json` 屬該資料衍生作品，須遵守相同條款。來源：[專案及資料授權](https://github.com/ongocompany/hanjahanja-dict)。
- 本站不內建或重發布受著作權保護的歌曲歌詞；使用者自行貼上的內容僅在瀏覽器處理。

## 免費韓中機器翻譯補充

站內提供預設勾選的「自動補上未收錄固有詞的中文意思」功能。使用者點擊「自動標註歌詞」後，先執行 Garu 分析與詞源查詢，再把沒有中文釋義的**單個韓語詞彙**（而非整首歌）透過 [MyMemory 公開翻譯 API](https://mymemory.translated.net/doc/spec.php) 嘗試翻成繁體中文。

- 不需要 Google API 金鑰；採免費第三方服務，受可用性、每日配額、跨網域限制等因素影響。
- 每次最多查詢 40 個不同詞彙，每次請求間隔約 350 毫秒。相同詞的譯文快取在本地瀏覽器；不會重複翻譯已知註解。
- 繁體中文機器翻譯前方加上 **≈**，代表**機譯且可能失準**，不能證明漢字詞的詞源。
- **取消勾選**就不會向外部傳送詞彙；已取得的本機譯文仍可顯示。
- 外部服務回覆失敗、沒有翻譯或配額不足時保留原詞，不編造中文字。
- 若要穩定、準確的上下文翻譯，可後續用官方 Google Cloud Translation API（需 Google Cloud 計費設定和安全的伺服器端代理）。**不建議把 Google Cloud API 金鑰直接寫在公開 GitHub Pages 前端**。

