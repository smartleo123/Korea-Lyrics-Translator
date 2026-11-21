# Korea Lyrics Translator｜韓語歌詞詞源標註

[開啟網站](https://smartleo123.github.io/Korea-Lyrics-Translator/)

貼上韓文歌詞或搜尋歌名／歌手，自動標註漢字詞、固有詞與外來語，並可切換顯示逐行繁體中文譯文。保留貼上的換行、空行與原有段落，支援可編輯自訂詞典及下載獨立 HTML。

## 單一歌曲搜尋介面

網站只顯示 **MusicBrainz** 一套歌曲目錄：

- **依歌名搜尋**：搜尋 MusicBrainz 的曲名，歌手欄可用來縮小結果。
- **依歌手搜尋**：先選擇 MusicBrainz 的正確歌手身分（MBID），分頁載入歌曲／錄音紀錄。相同曲名合併，支援篩選已載入曲目。
- **選擇曲目**：按「找韓文歌詞」，網站才在背景透過 **LRCLIB** 查詢符合歌名與歌手的韓文歌詞。LRCLIB 不另列一份來源清單，找到原詞才會帶入輸入框。
- **手動貼歌詞**：完整保留。

MusicBrainz 是社群維護的音樂資料庫，分頁查詢比固定 20 筆的關鍵字搜尋更適合瀏覽歌手曲目，但仍不保證包含歌手的全部官方作品。曲目資料**不是**歌詞全文；LRCLIB 可能找不到對應的韓文原詞。本站不保證取得每首歌的歌詞，也不在 GitHub 儲存受著作權保護的歌曲內容。資料來源：[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)、[LRCLIB](https://lrclib.net/)。

## 韓文標註與翻譯

- [Garu](https://github.com/ongjin/garu) WebAssembly 形態分析，在瀏覽器裡辨識詞性、部分語尾與助詞。
- [HanjaHanja Dictionary](https://github.com/ongocompany/hanjahanja-dict) 漢字詞資料，提供數萬個韓語漢字詞條。對同音不同義詞保留候選，部分詞依保守上下文規則協助選字。
- 常用固有詞／口語活用詞提供繁體中文釋義；缺漏時預設嘗試免費 MyMemory API 補譯。翻譯有快取、速率限制、請求超時及失敗中止機制，機譯仍可能不準確。
- 紅色為漢字詞、白色為固有詞、紫色為外來語。詞旁註解直接顯示；不顯示「待確認」或 `≈` 字樣，但不表示所有詞都有可靠詞義。
- 結果區右上角可切換逐行中文翻譯。若你有可合法使用的官方中文譯文，可以自行貼上優先使用；沒有提供的行再嘗試 MyMemory。**網站不會宣稱機器翻譯是官方譯文**。
- 結果可點擊校正，個人詞典可匯入、匯出。翻譯中文字會傳送至第三方服務，請勿貼入敏感內容。

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
- MusicBrainz 開放 metadata 依其公開資料授權與 API 使用規範使用；本站限制請求速率。
- 本專案不內建歌詞全文，使用者應遵守歌詞供應者條款及相關著作權。
