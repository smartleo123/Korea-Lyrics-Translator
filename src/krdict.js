// Optional no-key Korean->Chinese learner dictionary; on-demand shards only.
// Data: Korean Basic Dictionary / basickorean-vocab, CC BY-SA 2.0 KR.
// A dictionary meaning is never evidence of a Sino-Korean Hanja origin.
import {selectSense,senseOptions} from "./sense-selection.js";
export const DICTIONARY_SOURCE="https://github.com/basickorean/basickorean-vocab";
export const DICTIONARY_REVISION="01516acf2c5c9796e3ccfe2b89b1d75a7536b5a1";
export const DICTIONARY_BASE="https://cdn.jsdelivr.net/gh/basickorean/basickorean-vocab@"+DICTIONARY_REVISION+"/shards/tr/zh/";
const SHARD_CACHE=new Map();
// Bound the number of downloaded syllable groups held in memory. Entries are
// promises, so concurrent lines share exactly one request per shard.
const CACHE_CAPACITY=48;
function remember(key,promise){
 SHARD_CACHE.delete(key);
 SHARD_CACHE.set(key,promise);
 while(SHARD_CACHE.size>CACHE_CAPACITY)
  SHARD_CACHE.delete(SHARD_CACHE.keys().next().value);
}

let openCCPromise;
const HANGUL=/^[가-힣]+$/u;
export function keyForLemma(lemma){
 if(!HANGUL.test(lemma))return null;
 return [...lemma][0].codePointAt(0).toString(16);
}
export function dictionaryGloss(translation,convert=x=>x,context=""){
 if(!Array.isArray(translation))return "";
 const options=[];
 function visit(value){
  if(!Array.isArray(value))return;
  if(value.length>=2&&typeof value[0]==="string"&&typeof value[1]==="string"){
   const label=value[0].trim();
   if(label&&label.length<=100&&/[\u3400-\u9fff]/u.test(label)){
    for(const option of senseOptions(label))if(!options.includes(option))options.push(option);
   }
   return;
  }
  for(const item of value)visit(item);
 }
 visit(translation);
 if(!options.length)return "";
 try{
  const converted=options.map(value=>convert(value))
    .filter(x=>typeof x==="string"&&x.trim()&&[...x].length<=32);
  return selectSense(converted,context).slice(0,40);
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
  remember(cacheKey,pending);
  pending.catch(()=>{if(SHARD_CACHE.get(cacheKey)===pending)SHARD_CACHE.delete(cacheKey);});
 }else{
  // Recently used shards stay resident; seldom used shards are evicted.
  remember(cacheKey,SHARD_CACHE.get(cacheKey));
 }
 return SHARD_CACHE.get(cacheKey);
}
export async function fillDictionaryGlosses(lines,{
 fetcher=fetch,signal,converter,onProgress=()=>{},contexts=[],baseUrl=DICTIONARY_BASE,maxShards=Infinity,concurrency=4
}={}){
 const candidates=[];
 for(let i=0;i<lines.length;i++)for(const part of lines[i]){
  if(!["native","unknown"].includes(part.type)||part.gloss||part.source==="custom"||part.source==="grammar"||!HANGUL.test(part.text))continue;
  const lookups=[part.lemma,part.text].filter(word=>typeof word==="string"&&HANGUL.test(word));
  if(lookups.length)candidates.push({part,line:i,lookups:[...new Set(lookups)]});
 }
 if(!candidates.length)return {matched:0,total:0,failed:0,skippedShards:0};
 const allKeys=[...new Set(candidates.flatMap(c=>c.lookups.map(keyForLemma).filter(Boolean)))];
 // Never silently drop the 33rd+ distinct initial syllable of a long song.
 const limit=Number.isFinite(maxShards)?Math.max(0,Math.trunc(maxShards)):allKeys.length;
 const keys=allKeys.slice(0,limit),skippedShards=allKeys.length-keys.length;
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
 if(signal?.aborted)return {matched:0,total:candidates.length,failed,skippedShards,aborted:true};
 const convert=converter||await getDictionaryConverter().catch(()=>null);
 if(!convert)return {matched:0,total:candidates.length,failed:failed+1,skippedShards};
 let matched=0;
 for(const {part,lookups,line} of candidates){
  for(const word of lookups){
   const translations=shards.get(keyForLemma(word))?.[word];
   const gloss=dictionaryGloss(translations,convert,contexts[line]?.text||"");
   if(!gloss)continue;
   // Only vocabulary that was genuinely missing is filled by this dictionary.
   if(part.gloss)break;
   part.gloss=gloss;
   part.lemma=word;
   part.translationSource="KRDICT";
   matched++;break;
  }
 }
 return {matched,total:candidates.length,failed,skippedShards};
}
