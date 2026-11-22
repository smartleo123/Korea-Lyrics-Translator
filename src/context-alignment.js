// Sentence-first context alignment. Whole-line Chinese is only supporting
// evidence for a small set of vetted Korean readings. Translation does not
// establish etymology or justify inventing Hanja spellings.
const RULES={
 "맘":{type:"native",gloss:"心",cues:["心","內心","心裡"]},
 "맘이":{type:"native",gloss:"心（主格）",cues:["心","內心"]},
 "맘은":{type:"native",gloss:"心（主題）",cues:["心","內心"]},
 "마음":{type:"native",gloss:"心",cues:["心","內心"]},
 "마음이":{type:"native",gloss:"心（主格）",cues:["心","內心"]},
 "아파와":{type:"native",gloss:"感到心痛",cues:["痛","疼","難受"]},
 "말은":{type:"native",gloss:"話語（主題）",cues:["說","話","言語"]},
 "말을":{type:"native",gloss:"話語（受詞）",cues:["說","話","言語"]},
 "보일":{type:"native",gloss:"看見／看起來的",cues:["看","見","望"]},
 "눈":{type:"native",gloss:"眼睛",cues:["眼","目光","眼神"],opposite:["雪","下雪"]},
 "눈이":{type:"native",gloss:"眼睛（主格）",cues:["眼","目光","眼神"],opposite:["雪","下雪"]}
};
export function sentenceContextGlosses(parts,translation,{custom={}}={}){
 const sentence=String(translation||"").trim();
 if(!sentence)return parts;
 return parts.map(part=>{
  const rule=RULES[part.text];
  if(!rule||!rule.cues.some(cue=>sentence.includes(cue)))return part;
  if(rule.opposite?.some(cue=>sentence.includes(cue)))return part;
  if(custom[part.text]||part.source==="custom")return part;
  // Trust explicit Hanja lexemes and curated Hanja identity. A Chinese
  // sentence can help a native / ambiguous meaning, not prove new Hanja.
  if(part.type==="hanja"&&part.source!=="pos-inferred")return part;
  if(part.type==="loan")return part;
  if(part.translationSource==="curated-context"&&part.gloss===rule.gloss)return part;
  return {...part,type:rule.type,gloss:rule.gloss,
    translationSource:"sentence-context",source:part.source||"sentence-context"};
 });
}
export function applySentenceContext(lines,translationRows,options={}){
 return lines.map((parts,i)=>sentenceContextGlosses(parts,translationRows?.[i]?.text,options));
}
