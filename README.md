# Korea Lyrics Translator｜韓語歌詞詞源標註

[開啟網站](https://smartleo123.github.io/Korea-Lyrics-Translator/)

貼上韓文歌詞或搜尋歌名／歌手，自動標註漢字詞、固有詞與外來語，並可切換顯示逐行繁體中文譯文。保留貼上的換行、空行與原有段落，支援點擊修正詞義、下載獨立 HTML 與直接下載 PDF。

## 歌曲搜尋（LRCLIB）

為了簡化操作並避免 先前資料來源的 503 和多份曲目清單，網站已恢復最初的 **LRCLIB 單一搜尋方案**：

- 輸入歌名後查找相關版本；可加上歌手名稱縮小結果。
- 輸入歌手名稱後查找相關歌曲，同名錄音版本會合併顯示，必要時選擇版本。
- 選擇「帶入歌詞」後會檢查內容是否含有韓文原詞；英文或羅馬拼音歌詞不會覆蓋原本貼上的歌詞。
- 原本自行貼上韓文歌詞的功能完全保留。

**限制：** LRCLIB 公開搜尋單次最多回傳約 20 筆結果，沒有完整歌手作品清單的分頁介面。此版本以搜尋簡單、直接取得歌詞為優先，不會宣稱可列出所有歌曲。LRCLIB 來源：[lrclib.net](https://lrclib.net/)。

## 韓文標註與翻譯

- [Garu](https://github.com/ongjin/garu) WebAssembly 形態分析，在瀏覽器裡辨識詞性、部分語尾與助詞。
- [HanjaHanja Dictionary](https://github.com/ongocompany/hanjahanja-dict) 漢字詞資料，提供數萬個韓語漢字詞條。對同音不同義詞保留候選，部分詞依保守上下文規則協助選字。
- 常用固有詞／口語活用詞提供繁體中文釋義；缺漏時預設嘗試免費 MyMemory API 補譯。翻譯有快取、速率限制、請求超時及失敗中止機制，機譯仍可能不準確。
- 紅色為漢字詞、白色為固有詞、紫色為外來語。詞旁註解直接顯示；不顯示「待確認」或 `≈` 字樣，但不表示所有詞都有可靠詞義。
- 結果區右上角可切換逐行中文翻譯。若你有可合法使用的官方中文譯文，可以自行貼上優先使用；沒有提供的行再嘗試 MyMemory。**網站不會宣稱機器翻譯是官方譯文**。
- 結果可點擊校正，修改後的詞義儲存在此瀏覽器的本機資料中；已移除詞庫檔案匯入／匯出按鈕。翻譯中文字會傳送至第三方服務，請勿貼入敏感內容。

## PDF 匯出

結果區新增「下載 PDF」，在瀏覽器本機以 html2pdf.js 產生檔案，保留韓文詞源註解、顏色、段落與可選的逐行中文翻譯；無需另外上傳至 PDF 服務。PDF 以高解析度畫面渲染，因此內容主要以圖片方式保留，不等同可搜尋或選取文字的 PDF。若需要可複製的純文字，可使用 HTML 下載或「複製標註文字」。

## 開發與部署

```bash
npm install
python3 .github/scripts/build_dict.py
node scripts/copy-model.mjs
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions 每次推送 `main` 會產生辭典、建置網站、執行 Node 單元測試與 Chromium Playwright 測試，通過後才部署 GitHub Pages。

## 開源與授權注意

- Garu 原始碼使用 Apache-2.0；其辭典模型依原專案 NOTICE／附屬授權處理，請詳閱 [Garu NOTICE](https://github.com/ongjin/garu/blob/main/NOTICE)。
- HanjaHanja 衍生自韓國國立國語院辭典資料，詞表與產出的 `hanja-dict.json` 依 **CC BY-SA 2.0 KR** 署名／相同方式分享要求使用。來源：[HanjaHanja 專案](https://github.com/ongocompany/hanjahanja-dict)。
- 本專案不內建歌詞全文，使用者應遵守歌詞供應者條款及相關著作權。
