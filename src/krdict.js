// Optional no-key Korean->Chinese learner dictionary; on-demand shards only.
// Data: Korean Basic Dictionary / basickorean-vocab, CC BY-SA 2.0 KR.
// A dictionary meaning is never evidence of a Sino-Korean Hanja origin.
export const DICTIONARY_SOURCE="https://github.com/basickorean/basickorean-vocab";
export const DICTIONARY_REVISION="01516acf2c5c9796e3ccfe2b89b1d75a7536b5a1";
export const DICTIONARY_BASE="https://cdn.jsdelivr.net/gh/basickorean/basickorean-vocab@"+DICTIONARY_REVISION+"/shards/tr/zh/";
const SHARD_CACHE=new Map();
let openCCPromise;
const HANGUL=/^[가-힣]+$/u;
export function keyForLemma(lemma){
 if(!HANGUL.test(lemma))return null;
 return [...lemma][0].codePointAt(0).toString(16);
}
export function dictionaryGloss(translation,convert=x=>x){
 if(!Array.isArray(translation))return "";
 const meanings=new Set();
 function visit(value){
  if(!Array.isArray(value))return;
  if(value.length>=2&&typeof value[0]==="string"&&typeof value[1]==="string"){
   const first=value[0].trim().replace(/\s+/g," ");
   if(first&&first.length<=32&&/[\u3400-\u9fff]/u.test(first))meanings.add(first);
   return;
  }
  for(const item of value)visit(item);
 }
 visit(translation);
 // Polysemy is not a license to guess which sense the lyrics intend.
 if(meanings.size!==1)return "";
 try{
  const converted=convert([...meanings][0]);
  return typeof converted==="string"?converted.trim().slice(0,40):"";
 }catch{return "";}
}
export function getDictionaryConverter(){
 if(!openCCPromise)openCCPromise=import("opencc-js").then(module=>
  module.Converter({from:"cn",to:"tw"})
 ).catch(error=>{openCCPromise=null;throw error;});
 return openCCPromise;
}
export async function dictionaryShard(key,{fetcher=fetch,signal,baseUrl=DICTIONARY_BASE}={}){
 if(!/^[a-f0-9]{4,6}$/.test(key))return null;
 // Sharing a pending Promise deduplicates duplicate words and repeated song lines.
 const cacheKey=baseUrl+key;
 if(!SHARD_CACHE.has(cacheKey)){
  const pending=(async()=>{
   const response=await fetcher(baseUrl+key+".json",{signal});
   if(!response.ok)throw Error("Dictionary HTTP "+response.status);
   const data=await response.json();
   if(!data||Array.isArray(data)||typeof data!=="object")throw Error("Invalid dictionary shard");
   return data;
  })();
  SHARD_CACHE.set(cacheKey,pending);
  pending.catch(()=>{if(SHARD_CACHE.get(cacheKey)===pending)SHARD_CACHE.delete(cacheKey);});
 }
 return SHARD_CACHE.get(cacheKey);
}
export async function fillDictionaryGlosses(lines,{
 fetcher=fetch,signal,converter,onProgress=()=>{},baseUrl=DICTIONARY_BASE,maxShards=32,concurrency=4
}={}){
 const candidates=[];
 for(const parts of lines)for(const part of parts){
  if(!["native","unknown"].includes(part.type)||part.gloss||part.source==="custom"||part.source==="grammar"||!HANGUL.test(part.text))continue;
  const lookups=[part.lemma,part.text].filter(word=>typeof word==="string"&&HANGUL.test(word));
  if(lookups.length)candidates.push({part,lookups:[...new Set(lookups)]});
 }
 if(!candidates.length)return {matched:0,total:0,failed:0};
 const keys=[...new Set(candidates.flatMap(c=>c.lookups.map(keyForLemma).filter(Boolean)))].slice(0,maxShards);
 const shards=new Map();let failed=0,completed=0,next=0;
 async function worker(){
  while(next<keys.length&&!signal?.aborted){
   const key=keys[next++];
   try{shards.set(key,await dictionaryShard(key,{fetcher,signal,baseUrl}));}
   catch{failed++;}
   onProgress({completed:++completed,total:keys.length,failed});
  }
 }
 await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),keys.length)},worker));
 if(signal?.aborted)return {matched:0,total:candidates.length,failed,aborted:true};
 const convert=converter||await getDictionaryConverter().catch(()=>null);
 if(!convert)return {matched:0,total:candidates.length,failed:failed+1};
 let matched=0;
 for(const {part,lookups} of candidates){
  for(const word of lookups){
   const translations=shards.get(keyForLemma(word))?.[word];
   const gloss=dictionaryGloss(translations,convert);
   if(!gloss)continue;
   // Only vocabulary that was genuinely missing is filled by this dictionary.
   if(part.gloss)break;
   part.gloss=gloss;
   part.lemma=word;
   part.translationSource="KRDICT";
   matched++;break;
  }
 }
 return {matched,total:candidates.length,failed};
}
