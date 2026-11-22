// Verify verb/adjective inflections against attested Korean Basic Dictionary
// form lists. This is a strictly optional, no-key fallback, not a conjugation
// guesser or an AI word aligner. Morphology and dictionary evidence stay separate.
import {dictionaryShard,dictionaryGloss,keyForLemma,getDictionaryConverter,DICTIONARY_BASE} from "./krdict.js";
export const CORE_BASE=DICTIONARY_BASE.replace("/shards/tr/zh/","/shards/core/");
const HANGUL=/^[가-힣]+$/u;
const VERB_POS=new Set(["동사","형용사"]);
function candidatesForForm(core,surface){
 const out=[];
 for(const [lemma,entries] of Object.entries(core||{})){
  if(!Array.isArray(entries))continue;
  for(const entry of entries){
   if(!VERB_POS.has(entry?.p)||!Array.isArray(entry.fm)||!entry.fm.includes(surface))continue;
   if(!out.includes(lemma))out.push(lemma);
  }
 }
 return out;
}
export function hasObjectBefore(parts,index){
 const before=parts.slice(0,index).map(part=>part.text).join("");
 // An object particle or object-case pronoun is strong evidence that the next
 // ambiguous -어/-아 form is being used as a predicate, not a Hanja noun.
 return /(?:을|를|널|날)\s*$/u.test(before);
}
function hasChineseEvidence(gloss,sentence){
 const clean=x=>String(x||"").replace(/[\s，。、！？!?（）()]/gu,"");
 const word=clean(gloss),line=clean(sentence);
 return !!word&&!!line&&(line.includes(word)||(word.length>1&&[...word].some(ch=>line.includes(ch))));
}
export async function recoverAttestedInflections(lines,translations=[],{
 fetcher=fetch,signal,converter,coreBase=CORE_BASE,translationBase=DICTIONARY_BASE,maxShards=16
}={}){
 const candidates=[];
 for(let i=0;i<lines.length;i++)for(let j=0;j<lines[i].length;j++){
  const part=lines[i][j],text=part.text;
  if(!HANGUL.test(text)||part.source==="custom"||part.source==="grammar")continue;
  const ambiguousHanja=part.type==="hanja"&&/[아어여]$/u.test(text)&&hasObjectBefore(lines[i],j);
  if((part.type==="native"||part.type==="unknown")&&!part.gloss&&!part.lemma||ambiguousHanja)
   candidates.push({i,j,part,ambiguousHanja});
 }
 if(!candidates.length||signal?.aborted)return {matched:0,corrected:0,failed:0,checked:0};
 const keys=[...new Set(candidates.map(c=>keyForLemma(c.part.text)).filter(Boolean))].slice(0,maxShards);
 const cores=new Map();let failed=0;
 await Promise.all(keys.map(async key=>{
  try{cores.set(key,await dictionaryShard(key,{baseUrl:coreBase,fetcher,signal}));}catch{failed++;}
 }));
 if(signal?.aborted)return {matched:0,corrected:0,failed,checked:0,aborted:true};
 const convert=converter||await getDictionaryConverter().catch(()=>null);
 if(!convert)return {matched:0,corrected:0,failed:failed+1,checked:0};
 let matched=0,corrected=0,checked=0;
 for(const {i,j,part,ambiguousHanja} of candidates){
  if(signal?.aborted)break;
  const forms=candidatesForForm(cores.get(keyForLemma(part.text)),part.text);
  if(!forms.length)continue;
  checked++;
  const sentence=translations[i]?.text||"";
  const ranked=[];
  for(const lemma of forms){
   let translation;
   try{
    const shard=await dictionaryShard(keyForLemma(lemma),{baseUrl:translationBase,fetcher,signal});
    translation=dictionaryGloss(shard?.[lemma],convert,sentence);
   }catch{failed++;continue;}
   if(!translation)continue;
   ranked.push({lemma,gloss:translation,match:hasChineseEvidence(translation,sentence)});
  }
  if(!ranked.length)continue;
  const confirmed=ranked.filter(x=>x.match);
  // For inflections with multiple plausible dictionary lemmas, require a
  // unique matching source phrase; otherwise do not invent a meaning.
  const best=confirmed.length===1?confirmed[0]:ranked.length===1?ranked[0]:null;
  if(!best)continue;
  if(ambiguousHanja){
   // Don't demote a genuine Hanja noun unless the Chinese translation
   // corroborates the competing attested verb meaning.
   if(!best.match||hasChineseEvidence(part.gloss,sentence))continue;
   part.type="native";part.source="attested-inflection";corrected++;
  }
  if(!part.gloss||ambiguousHanja){
   part.gloss=best.gloss;part.lemma=best.lemma;part.translationSource="KRDICT-inflection";
   matched++;
  }
 }
 return {matched,corrected,failed,checked};
}
