// Sentence-level translations use the existing MyMemory service.
// Verified official lyric translations are not available via a public API:
// user-supplied licensed translations take priority.
import {translateOne} from "./translation.js";
export const LINE_CACHE_KEY="korean-lyrics-line-translation-v1";
export function alignProvidedTranslations(koreanLines,provided){
 const input=String(provided||"");
 if(!input.trim())return koreanLines.map(()=>null);
 const translations=input.replace(/\r\n?/g,"\n").split("\n");
 const srcNonEmpty=koreanLines.map((s,i)=>s.trim()?i:-1).filter(i=>i>=0);
 const nonEmptyTranslation=translations.filter(s=>s.trim());
 const out=koreanLines.map(()=>null);
 // Perfect line-for-line match preserves section breaks.
 if(translations.length===koreanLines.length){
  translations.forEach((s,i)=>{if(koreanLines[i].trim()&&s.trim())out[i]={text:s.trim(),source:"provided"};});
  return out;
 }
 // If user omitted empty stanzas, align successive nonempty lines only.
 if(nonEmptyTranslation.length===srcNonEmpty.length){
  srcNonEmpty.forEach((sourceIndex,i)=>out[sourceIndex]={text:nonEmptyTranslation[i].trim(),source:"provided"});
 }
 return out;
}
export async function translateLines(koreanLines,{provided="",cache={},fetcher=fetch,signal,onProgress=()=>{},limit=70}={}){
 const out=alignProvidedTranslations(koreanLines,provided);
 let translated=0,failed=0,attempted=0,consecutiveFailures=0,stopped=false;
 const unique=new Map();
 koreanLines.forEach((text,i)=>{
  if(!text.trim()||out[i])return;
  if(typeof cache[text]==="string"&&cache[text]){
   out[i]={text:cache[text],source:"MyMemory"};return;
  }
  if(!unique.has(text))unique.set(text,[]);
  unique.get(text).push(i);
 });
 const pending=[...unique.entries()].slice(0,limit);
 for(const [text,indices] of pending){
  if(signal?.aborted)break;
  attempted++;
  try{
   const result=await translateOne(text,{fetcher,signal});
   if(result){
    for(const i of indices)out[i]={text:result,source:"MyMemory"};
    cache[text]=result;translated++;consecutiveFailures=0;
   }else {failed++;consecutiveFailures++;}
  }catch(err){if(signal?.aborted)break;failed++;consecutiveFailures++;}
  onProgress({attempted,total:pending.length,translated,failed});
  if(consecutiveFailures>=3){stopped=true;break;}
 }
 return {rows:out,translated,failed,skipped:Math.max(0,unique.size-attempted),attempted,stopped};
}
export function outputLinesWithTranslation(koreanLines,translations){
 return koreanLines.map((k,i)=>({source:k,translation:translations?.[i]?.text||"",translationSource:translations?.[i]?.source||""}));
}
