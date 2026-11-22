// Contrastive source-target alignment using the SAME sentence translator.
// For a token X in sentence S, compare translate(S) with translate(S - X).
// Accept a Chinese phrase only when both translations have stable overlap.
// This is deliberately conservative; this is not an MT word-alignment model.
import {translateOne} from "./translation.js";

const CJK=/[\u3400-\u9fff]/;
const HANGUL=/^[가-힣]+$/;
export const CONTEXT_CACHE_KEY="korean-lyrics-contrastive-v1";
function commonPrefix(a,b){
 let i=0;const x=[...a],y=[...b];
 while(i<x.length&&i<y.length&&x[i]===y[i])i++;
 return i;
}
function commonSuffix(a,b,prefix){
 let i=0;const x=[...a],y=[...b],limit=Math.min(x.length,y.length)-prefix;
 while(i<limit&&x[x.length-i-1]===y[y.length-i-1])i++;
 return i;
}
export function deriveContextGloss(fullTranslation,omittedTranslation){
 const full=String(fullTranslation||"").trim(),less=String(omittedTranslation||"").trim();
 if(!full||!less||full===less)return null;
 const a=[...full],b=[...less],prefix=commonPrefix(full,less),suffix=commonSuffix(full,less,prefix);
 const delta=a.slice(prefix,a.length-suffix).join("").trim().replace(/^[，。！？；：、\s]+|[，。！？；：、\s]+$/g,"");
 const fromLess=b.slice(prefix,b.length-suffix).join("").trim();
 const retained=prefix+suffix;
 // Translation of the remaining sentence must be mostly stable.
 if(retained<Math.max(2,Math.ceil(b.length*.58)))return null;
 if(!CJK.test(delta)||[...delta].length>22)return null;
 if([...fromLess].length>Math.max(4,[...delta].length+2))return null;
 if(/^(?:的|了|是|和|在|有|我|你|他|她|它|啊|呢|吧|嗎|哦)$/.test(delta))return null;
 return {gloss:delta,confidence:retained/Math.max(a.length,b.length)};
}
export function withoutPart(parts,index){
 if(!parts?.[index]||!HANGUL.test(parts[index].text))return "";
 const other=parts.filter((_,i)=>i!==index).map(p=>p.text).join("");
 return other.replace(/\s+/g," ").trim();
}
export function selectContextCandidates(lines,rows,{max=12}={}){
 const candidates=[],seen=new Set();
 for(let i=0;i<lines.length;i++){
  const parts=lines[i],whole=rows?.[i]?.text;
  if(!whole||!parts?.length)continue;
  const source=parts.map(p=>p.text).join("");
  for(let j=0;j<parts.length;j++){
   const p=parts[j];
   if(!HANGUL.test(p.text)||p.source==="custom"||p.source==="grammar"||p.type==="loan")continue;
   // Single-syllable particles are excluded by their morphology source;
   // independent pronouns may be a single Hangul syllable.
   if(p.text.length<1)continue;
   // Only try a representative instance of each Korean surface in context.
   const reduced=withoutPart(parts,j);
   if(!reduced||reduced===source||!/[가-힣]/.test(reduced))continue;
   // Phrases with no lexical gloss or machine-only gloss are highest priority,
   // but even an attested Hanja spelling can have a different contextual sense.
   const priority=(p.translationSource==="MyMemory"||/[／/]/.test(p.gloss||""))?0:!p.gloss?1:p.type==="hanja"?2:3;
   const key=source+"|"+j;
   if(seen.has(key))continue;seen.add(key);
   candidates.push({i,j,source,reduced,full:whole,priority});
  }
 }
 return candidates.sort((a,b)=>a.priority-b.priority||a.i-b.i||a.j-b.j).slice(0,max);
}
export async function enrichContextGlosses(lines,rows,{
 fetcher=fetch,signal,cache={},max=12,onProgress=()=>{}
}={}){
 const candidates=selectContextCandidates(lines,rows,{max});
 let attempted=0,matched=0;
 for(const c of candidates){
  if(signal?.aborted)break;
  const p=lines[c.i]?.[c.j];
  if(!p)continue;
  const key=c.source+"|"+c.j+"|"+c.full;
  let result;
  try{result=cache[key]?JSON.parse(cache[key]):null;}catch{result=null;}
  if(!result){
   attempted++;
   try{
    const translated=await translateOne(c.reduced,{fetcher,signal,maxChars:500});
    result=deriveContextGloss(c.full,translated)||{gloss:"",confidence:0};
    cache[key]=JSON.stringify(result);
   }catch(e){
    if(signal?.aborted)break;
    onProgress({attempted,total:candidates.length,matched});
    continue;
   }
  }
  if(result.gloss){
   // Keep Hanja etymology; a semantic meaning is a separate field.
   if(p.type==="hanja"){
    p.contextGloss=result.gloss;
    p.contextSource="sentence-contrast";
   }else{
    p.gloss=result.gloss;
    p.translationSource="sentence-contrast";
   }
   matched++;
  }
  onProgress({attempted,total:candidates.length,matched});
 }
 return {attempted,total:candidates.length,matched};
}
