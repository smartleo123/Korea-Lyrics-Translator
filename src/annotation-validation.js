// Generic evidence checks for per-word Chinese annotations.
// A whole-sentence translation is not word alignment. Never use its contents
// to invent a lexical meaning or to prove Hanja etymology.
// Word-only machine translations must independently agree with the sentence.
const CJK=/[\u3400-\u9fff]/g;
const CJK_ONE=/[\u3400-\u9fff]/;
function chineseChars(input){return (String(input||"").match(CJK)||[]).join("");}
function supported(candidate,sentence){
 const meaning=chineseChars(candidate);
 const context=chineseChars(sentence);
 if(!meaning||!context)return false;
 // Multi-character overlap is stronger evidence than an isolated common
 // ideograph. One-character meanings require an exact literal occurrence.
 if(meaning.length===1)return context.includes(meaning);
 for(let n=Math.min(meaning.length,4);n>=2;n--){
  for(let i=0;i+n<=meaning.length;i++){
   if(context.includes(meaning.slice(i,i+n)))return true;
  }
 }
 return false;
}
function alternatives(gloss){
 return String(gloss||"").split(/\s*(?:／|\/(?!(?:\w|\d))|（依語境）|\(依語境\))\s*/u)
  .map(s=>s.trim()).filter(Boolean);
}
function sourceIsAutomated(part){
 return part.translationSource==="MyMemory"||part.translationSource==="sentence-context"||
  part.source==="surface-recovered"||part.source==="pos-inferred";
}
export function validateWordAnnotations(parts,sentence,{custom={}}={}){
 return parts.map(part=>{
  if(!/^[가-힣]+$/.test(part.text))return part;
  if(custom[part.text]||part.source==="custom")return part;
  if(part.type==="hanja"){
   // Hanja is lexical spelling, not the Chinese meaning in this sentence.
   // It stays visibly distinct from a semantic gloss in the UI.
   return part;
  }
  if(!part.gloss)return part;
  if(part.source==="grammar"){
   return {...part,gloss:"",translationSource:""};
  }
  const choices=alternatives(part.gloss);
  if(choices.length>1){
   const matching=choices.filter(choice=>supported(choice,sentence));
   if(matching.length===1)return {...part,gloss:matching[0],translationSource:"sentence-validated"};
   return {...part,gloss:"",translationSource:""};
  }
  if(sourceIsAutomated(part)&&!supported(part.gloss,sentence)){
   return {...part,gloss:"",translationSource:""};
  }
  return part;
 });
}
export function validateAnnotationLines(lines,translatedLines,options={}){
 return lines.map((parts,i)=>validateWordAnnotations(parts,translatedLines?.[i]?.text||"",options));
}
