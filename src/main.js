import {Garu} from "garu-ko/browser";
import {annotateLine} from "./engine.js";
import {COMMON_GLOSSARY,inferHanjaInContext} from "./glossary.js";
import {searchCatalog} from "./music-catalog.js";
import {splitLyrics} from "./layout.js";
import {searchTracks,searchArtistTracks,groupArtistTracks,getKoreanLyricsWithFallback} from "./song-search.js";
import {alignProvidedTranslations,translateLines,LINE_CACHE_KEY} from "./line-translation.js";
import {translateMissing,applyTranslations,translationCandidates,CACHE_KEY} from "./translation.js";
const $=id=>document.getElementById(id);
const KEY="korean-lyrics-custom-v1";
const seed=[
["용서","hanja","容恕"],["여자","hanja","女子"],["잔인","hanja","殘忍"],["인연","hanja","因緣"],["후회","hanja","後悔"],["애원","hanja","哀願"],["유혹","hanja","誘惑"],["상처","hanja","傷處"],["변하다","hanja","變"],["변해가는","hanja","變（逐漸改變）"],["최적","hanja","最適"],["분석","hanja","分析"],["중","hanja","中"],["감각","hanja","感覺"],["마비","hanja","麻痺"],["충격","hanja","衝擊"],["자체","hanja","自體"],["시선","hanja","視線"],["고정","hanja","固定"],["계속","hanja","繼續"],["위험","hanja","危險"],["지금","hanja","只今"],["순간","hanja","瞬間"],["직전","hanja","直前"],["이미","native","已經"],["매일","hanja","每日"],["세상","hanja","世上"],["부족","hanja","不足"],["이해","hanja","理解"],["농담","hanja","弄談"],["사소","hanja","些少"],["수","native","可以／可能（依存名詞）"],
["사랑","native","愛"],["마음","native","心"],["미움","native","恨"],["왜","native","為什麼"],["나","native","我"],["너","native","你"],["너는","native","你"],["나를","native","我（受詞）"],["너를","native","你（受詞）"],["내가","native","我（主格）"],["니가","native","你（口語）"],["날","native","我（受詞）"],["널","native","你（受詞）"],["네가","native","你（主格）"],["그","native","那"],["다시","native","再"],["모두","native","全部"],["모든","native","所有"],["못","native","不能"],["해","native","做"],["울리니","native","讓人哭嗎"],["아프게만","native","只讓人痛苦"],["아파","native","痛"],["만나서","native","見面後"],["주는데","native","給了卻"],["준","native","給的"],["만큼","native","程度"],["돌려줄","native","還給"],["거야","native","會的"],["나쁜","native","壞的"],["하지","native","做"],["마","native","不要"],["같아","native","像"],["길이","native","路／長度（依語境）"],["끝에","native","結束時"],["찾아오면","native","找上門時"],["비로소","native","直到此時"],["남는","native","留下的"],["뿐","native","僅"],["마음이","native","心"],["떠나","native","離開"],["차디찬","native","冰冷的"],["눈빛이","native","眼神"],["싫었어","native","討厭"],["또","native","又"],["다른","native","其他"],["있을","native","有"],["테니","native","因為會"],["뭔데","native","是什麼"],["숨죽여가며","native","屏住呼吸"],["잡고","native","抓住"],["싶었을까","native","曾想要嗎"],["멈출","native","停"],["없어","native","沒有"],["어쩌다","native","怎麼會"],["우린","native","我們"],["이미","native","已經"],["별","native","星"],["불","native","火"],["빛","native","光"],["무지개","native","彩虹"],["놀아줄게","native","陪你玩"],["가진","native","擁有的"],["포스","loan","force"],["에너지","loan","energy"],["네온","loan","neon"],["시스템","loan","system"],["라이트","loan","light"],["드럼","loan","drum"],["포커스","loan","focus"],["컴퓨터","loan","computer"],["버스","loan","bus"],["카메라","loan","camera"],["커피","loan","coffee"]
];
const curated=Object.fromEntries(seed.map(([word,type,gloss])=>[word,{type,gloss,source:"seed"}]));
let custom={};try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");if(saved&&!Array.isArray(saved)&&typeof saved==="object")custom=saved;}catch{}
const overrides=()=>({...curated,...custom});
let analyzer=null,hanja=new Map(),initialized=false,lines=[],currentSelected=null,translationController=null,renderSerial=0,showChinese=false,lineTranslations=[],songSearchController=null,lyricImportController=null;
let lineCache=loadCache(localStorage,LINE_CACHE_KEY),translations=loadCache(localStorage,CACHE_KEY);
const output=$("output"),notice=$("notice"),status=$("stats"),loading=$("loading"),loadingDetail=$("loadingDetail");
function message(s){notice.textContent=s;}
async function initialize(){
  message("正在載入韓語形態分析模型及漢字詞典…");
  try{
    const [g,dictResponse]=await Promise.all([Garu.load({modelUrl:import.meta.env.BASE_URL+"model.gmdl"}),fetch(import.meta.env.BASE_URL+"hanja-dict.json")]);
    if(!dictResponse.ok)throw new Error("漢字詞典 HTTP "+dictResponse.status);
    const raw=await dictResponse.json();
    hanja=new Map(Object.entries(raw));analyzer=g;initialized=true;
    message("已載入 Garu 形態分析與 "+hanja.size.toLocaleString()+" 筆漢字詞；可開始標註。");
    $("annotate").disabled=false;
    if($("source").value.trim())render();
  }catch(e){
    console.error(e);
    message("分析引擎載入失敗（"+e.message+"）。請檢查網路後重新整理；為避免誤判，已停止自動標註。");
    $("annotate").disabled=true;
  }
}
function enhanceLine(parts,context){
 for(const part of parts){
  if(part.type==="ambiguous"){
   const resolved=inferHanjaInContext(part.text,part.choices,context);
   if(resolved)Object.assign(part,resolved);
  }
  // A Chinese meaning is not evidence of native vs Sino-Korean origin.
  if(["native","unknown"].includes(part.type)&&!part.gloss&&COMMON_GLOSSARY[part.text]){
   part.gloss=COMMON_GLOSSARY[part.text];part.translationSource="curated";
  }
 }
 return parts;
}
function analyzeLine(input){
 if(!input)return [];
 try{
  const tokens=analyzer.analyze(input).tokens||[];
  return enhanceLine(annotateLine(input,tokens,hanja,overrides()),input);
 }catch(err){
  console.warn("Garu analysis failed",err);
  return enhanceLine(annotateLine(input,[],hanja,overrides()),input);
 }
}
function draw(){
  const input=$("source").value.replace(/\r\n?/g,"\n");
  output.replaceChildren();
  const stats={hanja:0,native:0,loan:0,unknown:0,ambiguous:0};
  for(let i=0;i<lines.length;i++){
    const entry=document.createElement("div");entry.className="lyric-entry";
    const div=document.createElement("div");div.className="lyric-line";
    for(let j=0;j<lines[i].length;j++){
      const w=lines[i][j];
      if(w.type==="plain"){div.append(document.createTextNode(w.text));continue;}
      const element=document.createElement("span");
      element.className="word "+(["ambiguous","unknown"].includes(w.type)?"native":w.type);
      element.tabIndex=0;element.title=w.translationSource?"MyMemory 機器翻譯，非經詞典驗證；點擊修改":w.choices?.length?"候選："+w.choices.join("／")+"（點擊選擇）":"點擊修改詞源與註解";
      element.append(document.createTextNode(w.text));
      if(w.gloss){
        const note=document.createElement("span");note.className="gloss";
        note.textContent="("+w.gloss.replace(/^≈/,"")+")";
        element.append(note);
      }
      element.addEventListener("click",()=>edit(i,j));
      element.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();edit(i,j);}});
      div.append(element);
      stats[w.type]=(stats[w.type]||0)+1;
    }
    entry.append(div);
    if(showChinese&&lineTranslations[i]?.text){const translation=document.createElement("div");translation.className="line-translation";translation.dataset.source=lineTranslations[i].source||"";translation.textContent=lineTranslations[i].text;translation.title=lineTranslations[i].source==="provided"?"自行提供的中文譯文":"MyMemory 機器翻譯，並非官方版本";entry.append(translation);}
    output.append(entry);
  }
  status.textContent="詞典 "+hanja.size.toLocaleString()+" 筆｜漢字詞 "+stats.hanja+"｜固有詞 "+(stats.native+stats.unknown+stats.ambiguous)+"｜外來語 "+stats.loan;
  $("outputTitle").textContent="02　"+($("title").value.trim()||"歌詞標註結果");
  $("download").disabled=!input.trim();$("copy").disabled=!input.trim();
}
function setLoading(isLoading,detail="正在分析詞彙與取得中文註解…"){
 loading.hidden=!isLoading;
 output.hidden=isLoading;
 status.hidden=isLoading;
 if(isLoading){loadingDetail.textContent=detail;output.replaceChildren();status.textContent="";}
 $("annotate").disabled=isLoading;
 $("toggleChinese").disabled=isLoading;
 $("sample").disabled=isLoading;
 $("download").disabled=isLoading;
 $("copy").disabled=isLoading;
}
async function render(){
 if(!initialized){message("分析器尚未就緒。");return;}
 if(translationController)translationController.abort();
 const controller=new AbortController();
 translationController=controller;
 const serial=++renderSerial;
 const source=$("source").value.replace(/\r\n?/g,"\n");
 if(!source.trim()){
  lines=[];setLoading(false);output.replaceChildren();status.textContent="";message("");return;
 }
 setLoading(true);
 message("");
 // Paint the loader before the potentially expensive morphological analysis.
 await new Promise(resolve=>requestAnimationFrame(resolve));
 if(controller.signal.aborted||serial!==renderSerial)return;
 let result;
 try{
  lines=splitLyrics(source).map(analyzeLine);
  lineTranslations=[];
  applyTranslations(lines,translations);
  const {total}=translationCandidates(lines,translations);
  if(total){
   loadingDetail.textContent="正在取得中文詞義…";
   result=await translateMissing(lines,{
     cache:translations,signal:controller.signal,
     onItem:()=>{saveCache(localStorage,CACHE_KEY,translations);}
   });
  }
  if(controller.signal.aborted||serial!==renderSerial)return;
  applyTranslations(lines,translations);
  saveCache(localStorage,CACHE_KEY,translations);
  if(showChinese){
    loadingDetail.textContent="正在準備逐行中文翻譯…";
    const lineResult=await translateLines(splitLyrics(source),{
      provided:$("providedChinese").value,cache:lineCache,signal:controller.signal,
      onProgress:({attempted,total})=>{loadingDetail.textContent="逐行中文翻譯中 "+attempted+" / "+total+"…";}
    });
    if(controller.signal.aborted||serial!==renderSerial)return;
    lineTranslations=lineResult.rows;
    saveCache(localStorage,LINE_CACHE_KEY,lineCache);
  }
  if(controller.signal.aborted||serial!==renderSerial)return;
  draw();setLoading(false);
  const missing=result?result.failed+Math.max(0,result.total-result.attempted):0;
  message(missing?"翻譯流程已結束；部分詞語因免費服務限制未取得中文詞義，已保留原文。":"歌詞標註完成。");
 }catch(e){
  if(controller.signal.aborted||serial!==renderSerial)return;
  console.error(e);
  draw();setLoading(false);
  message("翻譯服務暫時無法完成，已保留原文及現有詞典註解。");
 }
}
function edit(i,j){
  currentSelected={i,j};
  const w=lines[i][j];
  $("editWord").value=w.text;$("editGloss").value=w.gloss||"";
  $("editType").value=["hanja","native","loan","unknown"].includes(w.type)?w.type:"hanja";
  if(w.choices?.length) {
    $("editGloss").placeholder="漢字候選："+w.choices.join("／");
  } else $("editGloss").placeholder="例如：容恕";
  $("editor").showModal();
}
$("editForm").addEventListener("submit",e=>{
  if(e.submitter?.value!=="save")return;
  const word=$("editWord").value.trim(),type=$("editType").value,gloss=$("editGloss").value.trim();
  if(!/^[가-힣]+$/.test(word)){e.preventDefault();message("詞彙請輸入純韓文。");return;}
  custom[word]={type,gloss,source:"custom"};try{localStorage.setItem(KEY,JSON.stringify(custom));}catch{}
  // Local correction must not start dozens of MyMemory calls again.
  lines=splitLyrics($("source").value).map(analyzeLine);
  applyTranslations(lines,translations);
  draw();message("已儲存修正："+word);
});
function esc(x){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function exportMarkup(){
const title=$("title").value.trim()||"韓語歌詞詞源對照";
const body=lines.map((parts,index)=>'<div class="line">'+parts.map(p=>p.type==="plain"?esc(p.text):'<span class="'+(["ambiguous","unknown"].includes(p.type)?"native":p.type)+'">'+esc(p.text)+(p.gloss?'<small>('+esc(p.gloss.replace(/^≈/,""))+')</small>':"")+'</span>').join("")+'</div>'+(showChinese&&lineTranslations[index]?.text?'<div class="translation">'+esc(lineTranslations[index].text)+'</div>':"")).join("\n");
return '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{background:#10151e;color:white;font:19px/2 system-ui,"Noto Sans KR","Noto Sans TC",sans-serif;max-width:820px;margin:35px auto;padding:0 20px}.hanja{color:#ff667e}.native{color:white}.loan{color:#c69bff}.unknown{color:#ffc77d}small{font-size:.74em;opacity:.8}.line{white-space:pre;min-height:1.6em;width:max-content;min-width:100%}small{white-space:nowrap}.translation{white-space:pre;color:#b7cced;font-size:.85em;border-left:2px solid #42658d;padding-left:12px;margin-bottom:10px}</style><h1>'+esc(title)+'</h1>'+body+'</html>';
}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

// Search by song name; only the selected LRCLIB record is imported.
// Users can always paste or edit their own lyrics instead.
function songQuery(){return [$("title").value.trim(),$("artist").value.trim()].filter(Boolean).join(" ");}
function officialLink(){const q=songQuery();$("officialSearch").href="https://music.apple.com/tw/search?term="+encodeURIComponent(q||"Korean lyrics");}
$("title").addEventListener("input",officialLink);
$("artist").addEventListener("input",officialLink);
// Shared song selection; searching by artist shows song names, with variants
// grouped under each title. Selecting a version keeps the original lyric workflow.
async function importTrack(track,versions,button,container,status){
 lyricImportController?.abort();
 const controller=new AbortController();lyricImportController=controller;
 button.disabled=true;
 status.textContent="正在讀取 "+(track.name||"歌曲")+" 的歌詞…";
 try{
  const selected=await getKoreanLyricsWithFallback(track,versions,{signal:controller.signal});
  if(controller.signal.aborted)return;
  if(!selected.lyrics||!/[가-힣]/.test(selected.lyrics))throw new Error("未取得韓文原文，請手動貼上歌詞。");
  $("title").value=selected.track?.name||track.name;
  $("artist").value=selected.track?.artist||track.artist;
  $("source").value=selected.lyrics;
  $("providedChinese").value="";
  invalidateOutput();
  officialLink();
  status.textContent=selected.usedAlternative?"原選版本不是韓文，已自動找到同首歌的韓文歌詞；請檢查內容並開始標註。":"已帶入 LRCLIB 韓文歌詞。請確認歌手、版本及內容，再按「自動標註歌詞」。";
  container.replaceChildren();
  $("source").focus();
 }catch(e){if(!controller.signal.aborted)status.textContent="讀取失敗："+e.message;}
 finally{button.disabled=false;}
}
function describeVersion(track,i){
 const duration=track.duration?Math.round(track.duration/60)+":"+String(Math.round(track.duration%60)).padStart(2,"0"):"";
 return [track.album||"版本 "+(i+1),duration].filter(Boolean).join(" · ");
}
function showSongResults(tracks,{artistMode,status,container}){
 const groups=groupArtistTracks(tracks);
 const heading=document.createElement("p");heading.className="song-results-title";
 heading.textContent=artistMode?"這位歌手的歌曲（共 "+groups.length+" 首曲名）":"找到 "+groups.length+" 首相關歌曲";
 container.append(heading);
 for(const group of groups){
  const card=document.createElement("div");card.className="song-option";
  const desc=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small");
  title.textContent=group.name||"未命名歌曲";
  meta.textContent=group.artist+(group.versions.length>1?" · "+group.versions.length+" 個版本":" · "+(group.versions[0]?.album||""));
  desc.append(title,meta);
  const controls=document.createElement("div");controls.className="song-option-actions";
  let select;
  if(group.versions.length>1){
   select=document.createElement("select");select.setAttribute("aria-label",group.name+" 版本");
   group.versions.forEach((track,i)=>{
    const option=document.createElement("option");option.value=String(i);
    option.textContent=describeVersion(track,i)+(track.instrumental?"（純音樂）":"");
    select.append(option);
   });
   controls.append(select);
  }
  const button=document.createElement("button");button.type="button";button.textContent="帶入歌詞";
  const updateDisabled=()=>{const chosen=group.versions[Number(select?.value||0)];button.disabled=!!chosen.instrumental;};
  select?.addEventListener("change",updateDisabled);
  updateDisabled();
  button.onclick=()=>importTrack(group.versions[Number(select?.value||0)],group.versions,button,container,status);
  controls.append(button);
  card.append(desc,controls);container.append(card);
 }
 const tip=document.createElement("p");tip.className="song-results-info";
 tip.textContent=artistMode?"LRCLIB 每次最多回傳 20 筆搜尋紀錄，這不是歌手的完整作品目錄；若找不到歌曲，可改用歌名搜尋或自行貼歌詞。":"搜尋結果依第三方曲目資料，請確認歌手與版本。";
 container.append(tip);
}
function showCatalogResults(tracks,{status,container}){
 const heading=document.createElement("p");heading.className="song-results-title";
 heading.textContent="更多歌曲（iTunes 曲目目錄，共 "+tracks.length+" 首）";
 container.append(heading);
 const info=document.createElement("p");info.className="song-results-info";
 info.textContent="這些是歌曲資料，不代表有可取得的韓文歌詞。點選後會再到 LRCLIB 查找。";
 container.append(info);
 for(const track of tracks){
  const card=document.createElement("div");card.className="song-option";
  const desc=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("small");
  name.textContent=track.name;meta.textContent=[track.artist,track.album].filter(Boolean).join(" · ");
  desc.append(name,meta);
  const button=document.createElement("button");button.textContent="尋找韓文歌詞";button.type="button";
  button.onclick=async()=>{
   button.disabled=true;status.textContent="正在比對 LRCLIB 的韓文歌詞版本…";
   try{
    const suggestions=await searchTracks(track.name+" "+track.artist);
    const safe=suggestions.filter(t=>t.name.normalize("NFKC").trim().toLowerCase()===track.name.normalize("NFKC").trim().toLowerCase() &&
      t.artist.normalize("NFKC").toLowerCase().includes(track.artist.normalize("NFKC").toLowerCase()));
    if(!safe.length)throw new Error("此曲目目前沒有可確認的 LRCLIB 歌詞，請自行貼上韓文歌詞。");
    await importTrack(safe[0],safe,button,container,status);
   }catch(e){status.textContent="無法取得歌詞："+e.message;}
   finally{button.disabled=false;}
  };
  card.append(desc,button);container.append(card);
 }
}
async function runSongSearch(artistMode){
 const status=$("songSearchStatus"),container=$("songResults");
 const artist=$("artist").value.trim(),title=$("title").value.trim();
 const q=artistMode?artist:songQuery();
 if(!q){
  status.textContent=artistMode?"請先在「歌手名稱」欄位輸入歌手。":"請先輸入歌名或搜尋關鍵字。";
  return;
 }
 songSearchController?.abort();
 lyricImportController?.abort();
 const controller=new AbortController();songSearchController=controller;
 container.replaceChildren();
 status.textContent=artistMode?"正在查找歌手「"+artist+"」的相關歌曲…":"正在依歌名搜尋歌曲…";
 $("findLyrics").disabled=true;$("findArtistSongs").disabled=true;
 try{
  // Each provider fails independently; keep metadata discovery available
  // even when the lyric provider is temporarily down.
  const [lrclib,catalog]=await Promise.allSettled([
    artistMode?searchArtistTracks(artist,{signal:controller.signal}):searchTracks(q,{signal:controller.signal}),
    searchCatalog(artistMode?artist:q,{artistMode,signal:controller.signal})
  ]);
  if(controller.signal.aborted)return;
  const tracks=lrclib.status==="fulfilled"?lrclib.value:[];
  const more=catalog.status==="fulfilled"?catalog.value:[];
  const existing=new Set(tracks.map(t=>t.name.normalize("NFKC").toLowerCase().trim()+"|"+t.artist.normalize("NFKC").toLowerCase().trim()));
  const catalogOnly=more.filter(t=>!existing.has(t.name.normalize("NFKC").toLowerCase().trim()+"|"+t.artist.normalize("NFKC").toLowerCase().trim()));
  if(tracks.length)showSongResults(tracks,{artistMode,status,container});
  if(catalogOnly.length)showCatalogResults(catalogOnly,{status,container});
  status.textContent=tracks.length||catalogOnly.length
   ?"找到 "+(tracks.length+catalogOnly.length)+" 筆可瀏覽曲目；請選擇歌曲及版本。"
   :"找不到相關曲目，請嘗試其他歌名／歌手名稱或自行貼上歌詞。";
 }catch(e){
  if(!controller.signal.aborted)status.textContent="搜尋失敗："+e.message+"。可自行貼上歌詞。";
 }finally{
  if(songSearchController===controller){
   $("findLyrics").disabled=false;$("findArtistSongs").disabled=false;
  }
 }
}
$("findLyrics").onclick=()=>runSongSearch(false);
$("findArtistSongs").onclick=()=>runSongSearch(true);
$("toggleChinese").onclick=async()=>{
  showChinese=!showChinese;
  $("toggleChinese").setAttribute("aria-pressed",String(showChinese));
  $("toggleChinese").textContent=showChinese?"隱藏逐行中文翻譯":"顯示逐行中文翻譯";
  if(!lines.length)return;
  if(!showChinese){draw();return;}
  const source=splitLyrics($("source").value);
  const provided=alignProvidedTranslations(source,$("providedChinese").value);
  const needs=source.some((line,i)=>line.trim()&&!provided[i]&&!lineCache[line]);
  if(!needs){lineTranslations=provided.map((x,i)=>x||(lineCache[source[i]]?{text:lineCache[source[i]],source:"MyMemory"}:null));draw();return;}
  // Translation is completed before any annotated output is revealed again.
  if(translationController)translationController.abort();
  translationController=new AbortController();const serial=++renderSerial,controller=translationController;
  setLoading(true,"逐行中文翻譯中…");
  await new Promise(resolve=>requestAnimationFrame(resolve));
  try{
    const result=await translateLines(source,{provided:$("providedChinese").value,cache:lineCache,signal:controller.signal,
      onProgress:({attempted,total})=>{loadingDetail.textContent="逐行中文翻譯中 "+attempted+" / "+total+"…";}});
    if(controller.signal.aborted||serial!==renderSerial)return;
    lineTranslations=result.rows;
    saveCache(localStorage,LINE_CACHE_KEY,lineCache);
    draw();setLoading(false);
    message(result.failed||result.skipped?"逐行翻譯完成，部分句子無法取得譯文，保留韓文原文。":"逐行中文翻譯已顯示。");
  }catch(e){
    if(controller.signal.aborted||serial!==renderSerial)return;
    lineTranslations=provided;draw();setLoading(false);
    message("逐行翻譯服務暫時無法使用，已保留現有文字。");
  }
};

function invalidateOutput(){
 if(translationController)translationController.abort();
 renderSerial++;
 lines=[];lineTranslations=[];
 output.replaceChildren();status.textContent="";
 setLoading(false);
 $("download").disabled=true;$("copy").disabled=true;
 message($("source").value.trim()?"歌詞內容已修改，請按「自動標註歌詞」以更新結果。":"");
}
$("source").addEventListener("input",invalidateOutput);
$("providedChinese").addEventListener("input",()=>{
 if(showChinese&&lines.length)message("中文翻譯內容已修改，重新標註後會優先使用新譯文。");
});
$("annotate").onclick=render;

$("sample").onclick=()=>{$("artist").value="";$("providedChinese").value="";$("title").value="詞源對照範例";$("source").value="왜 너는 나를 만나서\n용서 못 해\n감각도 마비 충격 그 자체\n시선 고정 Li li like that\n사랑이 너무 아파";render();};
$("clear").onclick=()=>{songSearchController?.abort();lyricImportController?.abort();$("source").value="";$("title").value="";$("artist").value="";$("providedChinese").value="";$("songResults").replaceChildren();$("songSearchStatus").textContent="";officialLink();render();};
$("title").addEventListener("input",()=>{if(lines.length)$("outputTitle").textContent="02　"+($("title").value.trim()||"歌詞標註結果");});
$("download").onclick=()=>download(($("title").value.trim()||"韓語歌詞")+"-詞源對照.html",exportMarkup(),"text/html;charset=utf-8");
$("copy").onclick=async()=>{try{await navigator.clipboard.writeText(lines.map((parts,i)=>{const annotated=parts.map(p=>p.text+(p.gloss?"("+p.gloss+")":"")).join("");return showChinese&&lineTranslations[i]?.text?annotated+"\n"+lineTranslations[i].text:annotated;}).join("\n"));message("已複製標註文字。");}catch{message("複製失敗，請下載 HTML。");}};
$("exportDict").onclick=()=>download("korean-custom-dictionary.json",JSON.stringify(custom,null,2),"application/json");
$("importDict").onclick=()=>$("dictFile").click();
$("dictFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||Array.isArray(data)||typeof data!=="object")throw Error("JSON format");let n=0;for(const [word,v] of Object.entries(data)){if(!/^[가-힣]+$/.test(word)||!v||!["hanja","native","loan","unknown"].includes(v.type)||typeof v.gloss!=="string")continue;custom[word]={type:v.type,gloss:v.gloss,source:"custom"};n++;}localStorage.setItem(KEY,JSON.stringify(custom));render();message("已匯入 "+n+" 筆自訂詞彙。");}catch{message("匯入失敗：請檢查 JSON 格式。");}e.target.value="";});
$("annotate").disabled=true;
initialize();
