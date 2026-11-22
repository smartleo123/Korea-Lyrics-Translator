// Rank *attested* Traditional Chinese dictionary senses using the existing
// sentence translation. No AI alignment or song-specific answer tables.
// Ranking is deterministic: literal phrase > 2-char overlap > dictionary order.
const SEPARATOR=/[／/，,、；;]/u;
export function senseOptions(value){
 const out=[];
 for(const item of String(value||"").split(SEPARATOR)){
  const word=item.trim();
  if(word&&!out.includes(word))out.push(word);
 }
 return out;
}
const clean=value=>String(value||"").replace(/[\s\u200b\u3000，,。！？!?、；;（）()「」『』]/gu,"");
export function phraseEvidence(gloss,context=""){
 const sentence=clean(context),normalized=clean(gloss);
 if(!sentence||!normalized)return 0;
 if(sentence.includes(normalized))return 100+normalized.length;
 if(normalized.length>=2){
  const chars=[...normalized];
  const bigrams=chars.slice(0,-1).map((_,i)=>chars.slice(i,i+2).join(""));
  const hits=bigrams.filter(b=>sentence.includes(b)).length;
  if(hits)return 10+hits/bigrams.length;
 }
 return 0;
}
export function selectSense(options,context=""){
 const senses=[...new Set(options.flatMap(x=>senseOptions(x)))].filter(x=>x&&!/^[?？]/u.test(x));
 if(!senses.length)return "";
 const sentence=clean(context);
 let winner=senses[0],best=0;
 for(const gloss of senses){
  if(!sentence)continue;
  const score=phraseEvidence(gloss,sentence);
  if(score>best){best=score;winner=gloss;}
 }
 return winner;
}
// Run on every produced annotation (including built-in entries), but leave
// custom edits and verified Hanja spellings intact.
export function selectLineGlosses(lines,translations=[]){
 return lines.map((parts,i)=>parts.map(part=>{
  if(part.source==="custom"||part.type==="hanja"||!part.gloss)return part;
  const original=part.rawGloss||part.gloss;
  const selected=selectSense([original],translations[i]?.text||"");
  return selected&&selected!==part.gloss
   ?{...part,gloss:selected,rawGloss:original,translationSource:part.translationSource}:part;
 }));
}
