import {displayAnnotation} from "./contextual-meaning.js";
// A real PDF download (rather than a print dialog). html2pdf renders the
// existing annotations in the browser; no lyrics are sent to a PDF server.
function pdfName(title){
 const safe=String(title||"韓語歌詞").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").trim()||"韓語歌詞";
 return safe.slice(0,90)+"-詞源對照.pdf";
}
export function buildPdfContent(document,lines,{title="韓語歌詞詞源對照",showChinese=false,translations=[]}={}){
 const root=document.createElement("article");
 root.style.cssText="box-sizing:border-box;background:#10151e;color:#f7f9ff;width:710px;max-width:710px;padding:34px 40px 46px;font-family:system-ui,'Noto Sans KR','Noto Sans TC',sans-serif;font-size:17px;line-height:1.85;";
 const heading=document.createElement("h1");heading.textContent=title||"韓語歌詞詞源對照";
 heading.style.cssText="font-size:25px;line-height:1.35;margin:0 0 28px;color:#f7f9ff;overflow-wrap:anywhere;";
 root.append(heading);
 for(let i=0;i<lines.length;i++){
  const entry=document.createElement("div");
  entry.className="pdf-lyric-entry";
  entry.style.cssText="break-inside:avoid;page-break-inside:avoid;margin:0 0 5px;";
  const line=document.createElement("div");
  line.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;min-height:1.85em;";
  for(const part of lines[i]){
   if(part.type==="plain"){line.append(document.createTextNode(part.text));continue;}
   const word=document.createElement("span");
   word.style.color=part.type==="hanja"?"#ff667e":part.type==="loan"?"#c69bff":"#f7f9ff";
   word.textContent=part.text;
   if(displayAnnotation(part)){
    const gloss=document.createElement("small");
    gloss.style.cssText="font-size:.76em;opacity:.88;";
    gloss.textContent="("+(part.unverifiedGloss?"? ":"")+displayAnnotation(part).replace(/^≈/,"")+")";
    word.append(gloss);
   }
   line.append(word);
  }
  entry.append(line);
  if(showChinese&&translations[i]?.text){
   const chinese=document.createElement("div");
   chinese.textContent=translations[i].text;
   chinese.style.cssText="font-size:14px;color:#b7cced;white-space:pre-wrap;overflow-wrap:anywhere;border-left:2px solid #42658d;padding-left:9px;margin-bottom:8px;";
   entry.append(chinese);
  }
  root.append(entry);
 }
 return root;
}
export async function saveAnnotatedPdf(lines,{title,showChinese=false,translations=[]}={}){
 if(!lines.length)throw new Error("沒有可下載的標註歌詞");
 // Lazy-load only when downloading; avoids slowing song search and analysis.
 const {default:html2pdf}=await import("html2pdf.js");
 const root=buildPdfContent(document,lines,{title,showChinese,translations});
 await document.fonts.ready;
 await html2pdf().set({
  margin:0,
  filename:pdfName(title),
  image:{type:"jpeg",quality:.96},
  html2canvas:{scale:2,backgroundColor:"#10151e",useCORS:true,scrollX:0,scrollY:0},
  jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
  pagebreak:{mode:["css","legacy"],avoid:".pdf-lyric-entry"}
 }).from(root).save();
}
