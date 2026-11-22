// Optional, best-effort machine translation for Korean vocabulary.
// It supplies Chinese meaning, NOT etymology or Hanja. Never promotes a
// machine translated entry into a confirmed native / Sino-Korean word.
import {translationScheduler} from "./request-scheduler.js";
export const PROVIDER="MyMemory";
export const DAILY_LIMIT=80;
export const CACHE_KEY="korean-lyrics-mymemory-context-v2";
export function translationKey(word,context=""){return context?word+"\u241E"+context:word;}
export function translationCandidates(lines,cache={},max=DAILY_LIMIT,{contexts=[]}={}){
 const frequency=new Map();
 for(let i=0;i<lines.length;i++)for(const p of lines[i]){
   // Ambiguous Hanjas also need a Chinese meaning; that is NOT a Hanja
   // spelling and does not resolve their etymological ambiguity.
   if(!["native","unknown","ambiguous"].includes(p.type)||p.gloss||!/^[가-힣]{2,}$/.test(p.text)||cache[translationKey(p.text,contexts[i])])continue;
   // Don't translate detached particles or grammatical endings as dictionary words.
   if(p.source==="grammar"||p.source==="grammar-evidence")continue;
   const key=translationKey(p.text,contexts[i]);
   frequency.set(key,(frequency.get(key)||0)+1);
 }
 // Prioritize frequently used vocabulary: if the free service has a quota,
 // a chorus repeated four times should be translated ahead of a one-off word.
 const words=[...frequency].sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length||a[0].localeCompare(b[0])).map(([word])=>word);
 const keys=words.slice(0,max);
 return {words:keys.map(key=>key.split("\u241E")[0]),requests:keys.map(key=>({word:key.split("\u241E")[0],key})),total:words.length};
}
// MyMemory may return HTML-escaped text; never display entity codes as lyrics.
function decodeEntities(value){
 const named={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",hellip:"…"};
 return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi,(match,name)=>{
  if(name[0]!=="#")return named[name.toLowerCase()]??match;
  const hex=name[1]?.toLowerCase()==="x";
  const cp=Number.parseInt(name.slice(hex?2:1),hex?16:10);
  return Number.isInteger(cp)&&cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):match;
 });
}
export function extractTranslation(payload,source,maxChars=100){
 if(!payload||Number(payload.responseStatus)!==200)return "";
 const raw=payload.responseData?.translatedText;
 if(typeof raw!=="string")return "";
 // HTML entities are decoded by the browser later; prevent displaying an
 // unchanged or empty translation as if it were a meaningful Chinese gloss.
 const candidate=decodeEntities(raw).trim();
 if(!candidate||candidate===source||/^(?:MYMEMORY WARNING|QUERY LENGTH LIMIT|NO MATCH)/i.test(candidate))return "";
 if(!/[\u3400-\u9fff]/.test(candidate))return "";
 if(/(?:無對應詞彙|没有对应|沒有對應|未找到翻譯|無法翻譯)/u.test(candidate))return "";
 return candidate.slice(0,maxChars);
}
// Stop waiting on a stalled public API request; propagate a user cancellation.
export async function translateOne(word,{fetcher=fetch,signal,timeoutMs=10000,maxChars=100}={}){
 const url="https://api.mymemory.translated.net/get?"+
  new URLSearchParams({q:word,langpair:"ko|zh-TW"}).toString();
 const controller=new AbortController();
 const abort=()=>controller.abort();
 if(signal?.aborted)throw new Error("請求已取消");
 signal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await translationScheduler.run(()=>fetcher(url,{method:"GET",signal:controller.signal}),{signal:controller.signal});
  if(!response.ok)throw new Error("翻譯 API HTTP "+response.status);
  return extractTranslation(await response.json(),word,maxChars);
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener("abort",abort);
 }
}
// Back off after consecutive failures rather than issuing dozens of slow
// requests to an unavailable/rate-limited free service.
export async function translateMissing(lines,{cache={},fetcher=fetch,signal,onItem=()=>{},limit=DAILY_LIMIT,maxFailures=3,contexts=[]}={}){
 const {requests,total}=translationCandidates(lines,cache,limit,{contexts});
 let done=0,failed=0,attempted=0,stopped=false;
 let consecutiveFailures=0;
 for(const {word,key} of requests){
  if(signal?.aborted)break;
  attempted++;
  try{
   const translation=await translateOne(word,{fetcher,signal});
   if(translation){cache[key]=translation;onItem(word,translation);done++;consecutiveFailures=0;}
   else {failed++;consecutiveFailures++;}
  }catch(e){if(signal?.aborted)break;failed++;consecutiveFailures++;}
  if(consecutiveFailures>=maxFailures){stopped=true;break;}

 }
 return {done,failed,total,attempted,skipped:Math.max(0,total-attempted),limited:total>requests.length,stopped};
}
export function applyTranslations(lines,cache,{contexts=[]}={}){
 for(let i=0;i<lines.length;i++)for(const part of lines[i]){
  const key=translationKey(part.text,contexts[i]);
  if(["native","unknown","ambiguous"].includes(part.type)&&!part.gloss&&cache[key]){
   part.gloss=cache[key];
   part.translationSource=PROVIDER;
  }
 }
 return lines;
}
