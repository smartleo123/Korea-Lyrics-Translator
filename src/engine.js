// Alignment and etymology classification for Garu morphology tokens.
// No guessed Chinese characters: ambiguous Hanjas remain explicitly ambiguous.
const GRAMMAR=/^(?:J|E)/;
const NATIVE_POS=new Set(["VV","VA","VX","VCP","VCN","NP","NR","MAG","MAJ","IC","MM","NNB","XSV","XSA","XSN","SP","SF","SS","SE","SO","SW","SN"]);
const NOUN_POS=new Set(["NNG","NNP","XR","XPN"]);
export function segmentByOffsets(text,tokens=[]) {
  // Garu offsets are Unicode code points, not JavaScript UTF-16 offsets.
  const cp=[...text]; const boundaries=[0];let offset=0;
  for(const char of cp){offset+=char.length;boundaries.push(offset);}
  const spans=new Map();
  for(const t of tokens){
    const start=Number(t.start),end=Number(t.end);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>cp.length||start>=end)continue;
    const a=boundaries[start],b=boundaries[end],key=a+":"+b;
    if(!spans.has(key))spans.set(key,{start:a,end:b,morphs:[]});
    spans.get(key).morphs.push(t);
  }
  const sorted=[...spans.values()].sort((a,b)=>a.start-b.start||b.end-a.end);
  const result=[];let cursor=0;
  for(const group of sorted){
    if(group.start<cursor)continue;
    if(group.start>cursor)result.push({surface:text.slice(cursor,group.start),morphs:[]});
    result.push({surface:text.slice(group.start,group.end),morphs:group.morphs});
    cursor=group.end;
  }
  if(cursor<text.length)result.push({surface:text.slice(cursor),morphs:[]});
  return result;
}
export function classifyHeadword(word,pos,hanjaMap,curated={}) {
  if(curated[word]&&(curated[word].source==="custom"||curated[word].type!=="hanja"||NOUN_POS.has(pos)))
  return {...curated[word],source:curated[word].source==="custom"?"custom":"curated"};
  if(/^[a-z]/i.test(word)||pos==="SL")return {type:"loan",gloss:"",source:"pos"};
  if(pos&&(GRAMMAR.test(pos)||NATIVE_POS.has(pos)))return {type:"native",gloss:"",source:"pos"};
  // A homographic Hanja dictionary entry is not proof for verbs, adjectives,
  // conjugated endings or unanalysed lyric text. Prefer missing a Hanja
  // annotation over inventing a false etymology.
  if(!NOUN_POS.has(pos))return {type:pos?"native":"unknown",gloss:"",source:pos?"pos-inferred":"no-analysis"};
  const options=hanjaMap.get(word)||[];
  if(options.length===1)return {type:"hanja",gloss:options[0],source:"dictionary"};
  if(options.length>1)return {type:"ambiguous",gloss:"",choices:options,source:"dictionary"};
  // Unknown lexical nouns are normally rendered as ordinary Hangul, not
  // as alarming "unconfirmed" just because the Hanja dictionary lacks them.
  if(pos&&NOUN_POS.has(pos))return {type:"native",gloss:"",source:"pos-inferred"};
  if(pos)return {type:"native",gloss:"",source:"pos-inferred"};
  return {type:"unknown",gloss:"",source:"no-analysis"};
}
export function annotateSpan(span,hanjaMap,curated={}) {
 const surface=span.surface;
 if(!/[가-힣A-Za-z]/.test(surface))return [{text:surface,type:"plain",gloss:""}];
 if(!/[가-힣]/.test(surface))return [{text:surface,type:"loan",gloss:""}];
 if(curated[surface]?.source==="custom")return [{text:surface,...curated[surface]}];
 const morphs=span.morphs||[];
 const main=morphs.find(m=>!/^(J|E)/.test(m.pos||""))||morphs[0];
 const pos=main?.pos;
 // A complete morpheme with grammatical POS must not be converted to Hanja.
 if(pos&&(GRAMMAR.test(pos)||NATIVE_POS.has(pos))){
  const hint=curated[surface];
  // Grammatical evidence must outrank a coincidental curated Hanja homograph.
  return [{text:surface,...(hint?.type==="native"?{...hint,type:"native"}:{type:"native",gloss:"",source:"pos"})}];
 }
 const conjugated=morphs.some(m=>/^(VV|VA|VX|VCP|VCN|E)/.test(m.pos||""));
 // A lexicon hit for the written surface does not overrule verbal morphology.
 const exact=classifyHeadword(surface,conjugated?"VV":pos,hanjaMap,curated);
 if(exact.type==="hanja"||exact.type==="ambiguous"||exact.source==="curated")
   return [{text:surface,...exact}];
 // Use Garu morphs to distinguish nominal roots and particle/endings.
 const roots=morphs.filter(m=>NOUN_POS.has(m.pos)&&/^[가-힣]+$/.test(String(m.text||"")))
  .map(m=>({text:m.text,pos:m.pos})).filter(m=>surface.startsWith(m.text))
  .sort((a,b)=>b.text.length-a.text.length);
 for(const root of roots){
   if(root.text.length===surface.length)continue;
   const classification=classifyHeadword(root.text,root.pos,hanjaMap,curated);
   if(classification.type!=="unknown"&&classification.source!=="pos-inferred"){
     const rest=surface.slice(root.text.length);
     return [{text:root.text,...classification},{text:rest,type:"native",gloss:"",source:"grammar"}];
   }
 }
 // No suffix splitting based on dictionary coincidence. Only Garu-attested\n // nominal stems above may be separated from particles.\n // If the analyzer classifies a word as an ordinary noun/verb, default to
 // white Hangul without an invented Chinese gloss.
 return [{text:surface,...exact}];
}
export function annotateLine(text,tokens,hanjaMap,curated={}){
  const spans=segmentByOffsets(text,tokens);
  return spans.flatMap(span=>{
    if(span.morphs.length)return annotateSpan(span,hanjaMap,curated);
    const runs=span.surface.match(/([가-힣]+|[a-zA-Z][a-zA-Z0-9'_’\-]*|[^가-힣a-zA-Z]+)/g)||[];
    return runs.flatMap(s=>annotateSpan({surface:s,morphs:[]},hanjaMap,curated));
  });
}
