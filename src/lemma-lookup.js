// Dictionary lookup based on attested Garu morphemes, never suffix guessing.
// Preserve original Korean surfaces; lemmas are only lookup keys for glosses.
const LEXICAL=/^(?:VV|VA|VX|NNG|NNP|XR)$/;
const PREDICATE=/^(?:VV|VA|VX)$/;
const NOMINAL=/^(?:NNG|NNP|XR)$/;
const GRAMMATICAL=/^(?:J|E|S|XSN|VCP|VCN|EP)/;

export function lemmaFromMorphs(surface,morphs,glossary){
 if(!/^[가-힣]+$/u.test(surface)||!Array.isArray(morphs)||!morphs.length)return null;
 const lexical=morphs.filter(m=>LEXICAL.test(m.pos||"")&&/^[가-힣]+$/u.test(m.text||""));
 const other=morphs.filter(m=>!LEXICAL.test(m.pos||""));
 if(lexical.length===1&&other.every(m=>GRAMMATICAL.test(m.pos||"")||m.pos==="")){
  const root=lexical[0],lemma=PREDICATE.test(root.pos)?(root.text.endsWith("다")?root.text:root.text+"다"):root.text;
  if(NOMINAL.test(root.pos)&&!surface.startsWith(root.text))return null;
  if(Object.hasOwn(glossary,lemma)&&typeof glossary[lemma]==="string")
   return {lemma,gloss:glossary[lemma],source:"garu-lemma"};
 }
 // Nominal stem + derivational 하 + verbal/adjectival ending (e.g. 행복하다).
 // Only accept a lemma present in the dictionary; never synthesize a gloss.
 if(lexical.length===1&&NOMINAL.test(lexical[0].pos)){
  const deriv=other.filter(m=>m.pos==="XSV"||m.pos==="XSA");
  if(deriv.length===1&&deriv[0].text==="하"&&other.every(m=>m===deriv[0]||GRAMMATICAL.test(m.pos||""))){
   const lemma=lexical[0].text+"하다";
   if(Object.hasOwn(glossary,lemma))return {lemma,gloss:glossary[lemma],source:"garu-lemma"};
  }
 }
 return null;
}
export function applyGaruLemmaGlosses(parts,tokens,glossary){
 const out=[];let offset=0;
 for(const part of parts){
  const start=offset,end=start+[...part.text].length;
  offset=end;
  if(part.gloss||part.source==="custom"||part.source==="grammar"||!["native","unknown"].includes(part.type)){
   out.push(part);continue;
  }
  // Garu offsets count Unicode code points; use the unmodified surface positions.
  const morphs=(tokens||[]).filter(t=>Number.isInteger(t.start)&&Number.isInteger(t.end)
   &&t.start<end&&t.end>start);
  const found=lemmaFromMorphs(part.text,morphs,glossary);
  out.push(found?{...part,gloss:found.gloss,lemma:found.lemma,translationSource:found.source}:part);
 }
 return out;
}
