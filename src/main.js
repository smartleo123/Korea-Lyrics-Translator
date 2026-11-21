import {Garu} from "garu-ko/browser";
import {segmentByOffsets,annotateSpan,classifyHeadword} from "./engine.js";
const $=id=>document.getElementById(id);
const KEY="korean-lyrics-custom-v1";
const seed=[
["용서","hanja","容恕"],["여자","hanja","女子"],["잔인","hanja","殘忍"],["인연","hanja","因緣"],["후회","hanja","後悔"],["애원","hanja","哀願"],["유혹","hanja","誘惑"],["상처","hanja","傷處"],["변하다","hanja","變"],["변해가는","hanja","變（逐漸改變）"],["최적","hanja","最適"],["분석","hanja","分析"],["중","hanja","中"],["감각","hanja","感覺"],["마비","hanja","麻痺"],["충격","hanja","衝擊"],["자체","hanja","自體"],["시선","hanja","視線"],["고정","hanja","固定"],["계속","hanja","繼續"],["위험","hanja","危險"],["지금","hanja","只今"],["순간","hanja","瞬間"],["직전","hanja","直前"],["이미","hanja","已"],["매일","hanja","每日"],["세상","hanja","世上"],["부족","hanja","不足"],["이해","hanja","理解"],["농담","hanja","弄談"],["사소","hanja","些少"],["수","native","可以／可能（依存名詞）"],
["사랑","native","愛"],["마음","native","心"],["미움","native","恨"],["왜","native","為什麼"],["나","native","我"],["너","native","你"],["너는","native","你"],["나를","native","我（受詞）"],["너를","native","你（受詞）"],["내가","native","我（主格）"],["니가","native","你（口語）"],["날","native","我（受詞）"],["널","native","你（受詞）"],["네가","native","你（主格）"],["그","native","那"],["다시","native","再"],["모두","native","全部"],["모든","native","所有"],["못","native","不能"],["해","native","做"],["울리니","native","讓人哭嗎"],["아프게만","native","只讓人痛苦"],["아파","native","痛"],["만나서","native","見面後"],["주는데","native","給了卻"],["준","native","給的"],["만큼","native","程度"],["돌려줄","native","還給"],["거야","native","會的"],["나쁜","native","壞的"],["하지","native","做"],["마","native","不要"],["같아","native","像"],["길이","native","路"],["끝에","native","結束時"],["찾아오면","native","找上門時"],["비로소","native","直到此時"],["남는","native","留下的"],["뿐","native","僅"],["마음이","native","心"],["떠나","native","離開"],["차디찬","native","冰冷的"],["눈빛이","native","眼神"],["싫었어","native","討厭"],["또","native","又"],["다른","native","其他"],["있을","native","有"],["테니","native","因為會"],["뭔데","native","是什麼"],["숨죽여가며","native","屏住呼吸"],["잡고","native","抓住"],["싶었을까","native","曾想要嗎"],["멈출","native","停"],["없어","native","沒有"],["어쩌다","native","怎麼會"],["우린","native","我們"],["이미","hanja","已"],["별","native","星"],["불","native","火"],["빛","native","光"],["무지개","native","彩虹"],["놀아줄게","native","陪你玩"],["가진","native","擁有的"],["포스","loan","force"],["에너지","loan","energy"],["네온","loan","neon"],["시스템","loan","system"],["라이트","loan","light"],["드럼","loan","drum"],["포커스","loan","focus"],["컴퓨터","loan","computer"],["버스","loan","bus"],["카메라","loan","camera"],["커피","loan","coffee"]
];
const curated=Object.fromEntries(seed.map(([word,type,gloss])=>[word,{type,gloss,source:"seed"}]));
let custom={};try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");if(saved&&!Array.isArray(saved)&&typeof saved==="object")custom=saved;}catch{}
const overrides=()=>({...curated,...custom});
let analyzer=null,hanja=new Map(),initialized=false,lines=[],currentSelected=null;
const output=$("output"),notice=$("notice"),status=$("stats");
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
function analyzeLine(input){
  if(!input)return [];
  let tokens=[];
  try{tokens=analyzer.analyze(input).tokens||[];}catch(err){console.warn("Garu analysis failed",err);}
  const spans=segmentByOffsets(input,tokens);
  // Segments without morphological offsets still need split on word boundaries.
  return spans.flatMap(span=>{
    if(span.morphs.length)return annotateSpan(span,hanja,overrides());
    const runs=span.surface.match(/([가-힣]+|[a-zA-Z][a-zA-Z0-9'_’\-]*|[^가-힣a-zA-Z]+)/g)||[];
    return runs.flatMap(s=>annotateSpan({surface:s,morphs:[]},hanja,overrides()));
  });
}
function render(){
  if(!initialized){message("分析器尚未就緒。");return;}
  const input=$("source").value.replace(/\r\n?/g,"\n");lines=input.split("\n").map(analyzeLine);
  output.replaceChildren();
  const stats={hanja:0,native:0,loan:0,unknown:0,ambiguous:0};
  for(let i=0;i<lines.length;i++){
    const div=document.createElement("div");div.className="lyric-line";
    for(let j=0;j<lines[i].length;j++){
      const w=lines[i][j];
      if(w.type==="plain"){div.append(document.createTextNode(w.text));continue;}
      const element=document.createElement("span");
      element.className="word "+(w.type==="ambiguous"?"unknown":w.type);
      element.tabIndex=0;element.title=w.choices?.length?"候選："+w.choices.join("／")+"（點擊選擇）":"點擊修改詞源與註解";
      element.append(document.createTextNode(w.text));
      if(w.gloss||w.type==="ambiguous"||w.type==="unknown"){
        const note=document.createElement("span");note.className="gloss";
        note.textContent=w.gloss?"("+w.gloss+")":w.type==="ambiguous"?"(漢字歧義・待選)":"(待確認)";
        element.append(note);
      }
      element.addEventListener("click",()=>edit(i,j));
      element.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();edit(i,j);}});
      div.append(element);
      stats[w.type]=(stats[w.type]||0)+1;
    }
    output.append(div);
  }
  status.textContent="詞典 "+hanja.size.toLocaleString()+" 筆｜漢字詞 "+stats.hanja+"｜固有詞 "+stats.native+"｜外來語 "+stats.loan+"｜歧義 "+stats.ambiguous+"｜待確認 "+stats.unknown;
  $("outputTitle").textContent="02　"+($("title").value.trim()||"歌詞標註結果");
  $("download").disabled=!input.trim();$("copy").disabled=!input.trim();
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
  render();message("已儲存修正："+word);
});
function esc(x){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function exportMarkup(){
const title=$("title").value.trim()||"韓語歌詞詞源對照";
const body=lines.map(parts=>'<div class="line">'+parts.map(p=>p.type==="plain"?esc(p.text):'<span class="'+(p.type==="ambiguous"?"unknown":p.type)+'">'+esc(p.text)+(p.gloss?'<small>('+esc(p.gloss)+')</small>':p.type==="ambiguous"?"<small>(漢字歧義・待選)</small>":p.type==="unknown"?"<small>(待確認)</small>":"")+'</span>').join("")+'</div>').join("\n");
return '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{background:#10151e;color:white;font:19px/2 system-ui,"Noto Sans KR","Noto Sans TC",sans-serif;max-width:820px;margin:35px auto;padding:0 20px}.hanja{color:#ff667e}.native{color:white}.loan{color:#c69bff}.unknown{color:#ffc77d}small{font-size:.74em;opacity:.8}.line{min-height:1.6em}</style><h1>'+esc(title)+'</h1>'+body+'</html>';
}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$("annotate").onclick=render;
$("sample").onclick=()=>{$("title").value="詞源對照範例";$("source").value="왜 너는 나를 만나서\n용서 못 해\n감각도 마비 충격 그 자체\n시선 고정 Li li like that\n사랑이 너무 아파";render();};
$("clear").onclick=()=>{$("source").value="";$("title").value="";render();};
$("title").addEventListener("input",()=>{if(lines.length)$("outputTitle").textContent="02　"+($("title").value.trim()||"歌詞標註結果");});
$("download").onclick=()=>download(($("title").value.trim()||"韓語歌詞")+"-詞源對照.html",exportMarkup(),"text/html;charset=utf-8");
$("copy").onclick=async()=>{try{await navigator.clipboard.writeText(lines.map(parts=>parts.map(p=>p.text+(p.gloss?"("+p.gloss+")":"")).join("")).join("\n"));message("已複製標註文字。");}catch{message("複製失敗，請下載 HTML。");}};
$("exportDict").onclick=()=>download("korean-custom-dictionary.json",JSON.stringify(custom,null,2),"application/json");
$("importDict").onclick=()=>$("dictFile").click();
$("dictFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||Array.isArray(data)||typeof data!=="object")throw Error("JSON format");let n=0;for(const [word,v] of Object.entries(data)){if(!/^[가-힣]+$/.test(word)||!v||!["hanja","native","loan","unknown"].includes(v.type)||typeof v.gloss!=="string")continue;custom[word]={type:v.type,gloss:v.gloss,source:"custom"};n++;}localStorage.setItem(KEY,JSON.stringify(custom));render();message("已匯入 "+n+" 筆自訂詞彙。");}catch{message("匯入失敗：請檢查 JSON 格式。");}e.target.value="";});
$("annotate").disabled=true;
initialize();
