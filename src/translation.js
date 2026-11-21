// Optional, best-effort machine translation for Korean vocabulary.
// It supplies Chinese meaning, NOT etymology or Hanja. Never promotes a
// machine translated entry into a confirmed native / Sino-Korean word.
export const PROVIDER="MyMemory";
export const DAILY_LIMIT=40;
export const CACHE_KEY="korean-lyrics-mymemory-cache-v1";
const sleep=(n)=>new Promise(resolve=>setTimeout(resolve,n));
export function translationCandidates(lines,cache={},max=DAILY_LIMIT){
 const unique=new Set();
 for(const items of lines)for(const p of items){
   if(!["native","unknown"].includes(p.type)||p.gloss||!/^[가-힣]{2,}$/.test(p.text)||cache[p.text])continue;
   // Grammatical endings are not standalone lexical words.
   if(p.source==="grammar"||p.source==="pos"&&p.text.length<2)continue;
   unique.add(p.text);
 }
 return {words:[...unique].slice(0,max),total:unique.size};
}
export function extractTranslation(payload,source){
 if(!payload||Number(payload.responseStatus)!==200)return "";
 const raw=payload.responseData?.translatedText;
 if(typeof raw!=="string")return "";
 // HTML entities are decoded by the browser later; prevent displaying an
 // unchanged or empty translation as if it were a meaningful Chinese gloss.
 const candidate=raw.trim();
 if(!candidate||candidate===source||/^(?:MYMEMORY WARNING|QUERY LENGTH LIMIT|NO MATCH)/i.test(candidate))return "";
 if(!/[\u3400-\u9fff]/.test(candidate))return "";
 return candidate.slice(0,100);
}
// Stop waiting on a stalled public API request; propagate a user cancellation.
export async function translateOne(word,{fetcher=fetch,signal,timeoutMs=10000}={}){
 const url="https://api.mymemory.translated.net/get?"+
  new URLSearchParams({q:word,langpair:"ko|zh-TW"}).toString();
 const controller=new AbortController();
 const abort=()=>controller.abort();
 if(signal?.aborted)throw new Error("請求已取消");
 signal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(url,{method:"GET",signal:controller.signal});
  if(!response.ok)throw new Error("翻譯 API HTTP "+response.status);
  return extractTranslation(await response.json(),word);
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener("abort",abort);
 }
}
// Back off after consecutive failures rather than issuing dozens of slow
// requests to an unavailable/rate-limited free service.
export async function translateMissing(lines,{cache={},fetcher=fetch,signal,onItem=()=>{},limit=DAILY_LIMIT,maxFailures=3}={}){
 const {words,total}=translationCandidates(lines,cache,limit);
 let done=0,failed=0,attempted=0,stopped=false;
 let consecutiveFailures=0;
 for(const word of words){
  if(signal?.aborted)break;
  attempted++;
  try{
   const translation=await translateOne(word,{fetcher,signal});
   if(translation){cache[word]=translation;onItem(word,translation);done++;consecutiveFailures=0;}
   else {failed++;consecutiveFailures++;}
  }catch(e){if(signal?.aborted)break;failed++;consecutiveFailures++;}
  if(consecutiveFailures>=maxFailures){stopped=true;break;}
  if(!signal?.aborted)await sleep(200);
 }
 return {done,failed,total,attempted,skipped:Math.max(0,total-attempted),limited:total>words.length,stopped};
}
export function applyTranslations(lines,cache){
 for(const parts of lines)for(const part of parts){
  if(["native","unknown"].includes(part.type)&&!part.gloss&&cache[part.text]){
   part.gloss=cache[part.text];
   part.translationSource=PROVIDER;
  }
 }
 return lines;
}
