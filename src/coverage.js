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


