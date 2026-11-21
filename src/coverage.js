// Reconstruct original Korean eojeols when the morphological analyzer splits
// them into several *unannotated* fragments. Otherwise each fragment can be
// sent to translation alone ("한" instead of "꾸준한"), yielding empty glosses.
// Do not combine words that already contain confirmed Hanjas or meanings.
export function completeUnannotatedKorean(parts, surfaceGlossary={}){
 const result=[];
 let pending=[];
 const flush=()=>{
  if(!pending.length)return;
  const text=pending.map(p=>p.text).join("");
  if(pending.length===1){
   const token=pending[0];
   if(!token.gloss&&surfaceGlossary[text]){
    result.push({...token,gloss:surfaceGlossary[text],translationSource:"curated"});
   }else result.push(token);
  }else{
   result.push({
    text,type:"native",gloss:surfaceGlossary[text]||"",
    source:"surface-recovered",
    ...(surfaceGlossary[text]?{translationSource:"curated"}:{})
   });
  }
  pending=[];
 };
 for(const part of parts){
  if(/^[가-힣]+$/.test(part.text)&&["native","unknown"].includes(part.type)&&!part.gloss){
   pending.push(part);
  }else{
   flush();result.push(part);
  }
 }
 flush();
 return result;
}
export function countKoreanCoverage(lines){
 let words=0,glossed=0;
 for(const parts of lines)for(const part of parts){
  if(!/[가-힣]/.test(part.text)||!(/^[가-힣]+$/.test(part.text)))continue;
  // Only count meaningful words. Particles may be intentionally unglossed.
  if(part.source==="grammar"&&part.text.length===1)continue;
  words++;
  if(part.gloss)glossed++;
 }
 return {words,glossed,missing:words-glossed};
}


// Certain compound nouns have a verified headword and a meaningful suffix.
// Annotate the suffix without replacing the verified Hanja stem. Keep this
// deliberately narrow; unverified suffix derivations are not guessed.
const COMPOUND_SUFFIXES={
 "보석함":{suffix:"함",gloss:"盒"}
};
export function completeKnownCompoundSuffixes(parts){
 const result=parts.map(part=>({...part}));
 for(let i=0;i<result.length;i++){
  let joined="";
  for(let j=i;j<result.length&&j<i+4;j++){
   const part=result[j];
   if(!/^[가-힣]+$/.test(part.text))break;
   joined+=part.text;
   const entry=COMPOUND_SUFFIXES[joined];
   if(!entry||j<=i)continue;
   const suffix=result[j];
   if(suffix.text!==entry.suffix||suffix.gloss)continue;
   if(!result.slice(i,j).some(p=>p.gloss&&/^[가-힣]+$/.test(p.text)))continue;
   suffix.gloss=entry.gloss;
   suffix.translationSource="curated-compound";
  }
 }
 return result;
}
