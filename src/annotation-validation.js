// Sentence translation precedes lexical annotation. MyMemory translates
// sentences fluently and DOES NOT return word-to-word alignment. A Chinese
// word's absence from the sentence therefore cannot justify deleting it.
// Instead, attach a non-destructive evidence hint for UI/tooltips.
const CJK=/[\u3400-\u9fff]/g;
function chineseText(text){return (String(text||"").match(CJK)||[]).join("");}
export function lexicalContextEvidence(gloss,sentence){
 const word=chineseText(gloss),line=chineseText(sentence);
 if(!word||!line)return "unavailable";
 if(line.includes(word))return "literal";
 // An overlap is only a loose signal, never a translation decision.
 if(word.length>1){
  for(let i=0;i<word.length-1;i++){
   if(line.includes(word.slice(i,i+2)))return "partial";
  }
 }
 return "not-literal";
}
export function validateWordAnnotations(parts,sentence,{custom={}}={}){
 return parts.map(part=>{
  if(!part.gloss||custom[part.text]||part.source==="custom")return part;
  if(part.type==="loan")return part;
  const evidence=lexicalContextEvidence(part.gloss,sentence);
  if(part.type==="hanja")return part;
  if(part.translationSource!=="MyMemory")return part;
  // The Chinese meaning of a standalone word is not aligned to this sentence.
  // Preserve raw value for editing, but render only a verified gloss.
  return {...part,contextEvidence:evidence,unverifiedGloss:evidence!=="literal"};
 });
}
export function validateAnnotationLines(lines,translations,options={}){
 return lines.map((parts,i)=>validateWordAnnotations(parts,translations?.[i]?.text||"",options));
}
