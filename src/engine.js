// Alignment and etymology classification for Garu morphology tokens.
// No guessed Chinese characters: ambiguous Hanjas remain explicitly ambiguous.
const GRAMMAR=/^(?:J|E)/;
const NATIVE_POS=new Set(["VV","VA","VX","VCP","VCN","NP","NR","MAG","MAJ","IC","MM","NNB","XSV","XSA","XSN","SP","SF","SS","SE","SO","SW","SN"]);
const NOUN_POS=new Set(["NNG","NNP","XR","XPN"]);
const PARTICLES=new Set(["은","는","이","가","을","를","에","에서","에게","께","의","도","만","로","으로","와","과","랑","하고","부터","까지","처럼","마다","보다","라도","이나","나","요","야","네","겠","은데","는데","에서","으로서","라고","이라","아","어","게","고","지","면"]);
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
  if(curated[word])return {...curated[word],source:"curated"};
  if(/^[a-z]/i.test(word)||pos==="SL")return {type:"loan",gloss:"",source:"pos"};
  if(pos&&(GRAMMAR.test(pos)||NATIVE_POS.has(pos)))return {type:"native",gloss:"",source:"pos"};
  const options=hanjaMap.get(word)||[];
  if(options.length===1)return {type:"hanja",gloss:options[0],source:"dictionary"};
  if(options.length>1)return {type:"ambiguous",gloss:"",choices:options,source:"dictionary"};
  // Unknown lexical nouns are normally rendered as ordinary Hangul, not
  // as alarming "unconfirmed" just because the Hanja dictionary lacks them.
  if(pos&&NOUN_POS.has(pos))return {type:"native",gloss:"",source:"pos-inferred"};
  if(pos)return {type:"native",gloss:"",source:"pos-inferred"};
  return {type:"unknown",gloss:"",source:"no-analysis"};
}
function choosePrefix(surface,dict,curated,pos){
  // Accept only attested full lexemes followed by a recognized grammatical ending.
  // Avoid arbitrary splits such as 사랑 from 사랑스러워.
  for(let len=surface.length-1;len>=1;len--){
    const root=surface.slice(0,len),tail=surface.slice(len);
    if(!PARTICLES.has(tail)&&!(/^[은는이가을를도만에의]$/.test(tail)))continue;
    const record=classifyHeadword(root,pos,dict,curated);
    if(record.type==="unknown"||record.source==="pos-inferred")continue;
    return [{text:root,...record},{text:tail,type:"native",gloss:"",source:"grammar"}];
  }
  return null;
}
export function annotateSpan(span,hanjaMap,curated={}) {
 const surface=span.surface;
 if(!/[가-힣A-Za-z]/.test(surface))return [{text:surface,type:"plain",gloss:""}];
 if(!/[가-힣]/.test(surface))return [{text:surface,type:"loan",gloss:""}];
 if(curated[surface])return [{text:surface,...curated[surface]}];
 const morphs=span.morphs||[];
 const main=morphs.find(m=>!/^(J|E)/.test(m.pos||""))||morphs[0];
 const pos=main?.pos;
 // A complete morpheme with grammatical POS must not be converted to Hanja.
 if(pos&&(GRAMMAR.test(pos)||NATIVE_POS.has(pos)))return [{text:surface,type:"native",gloss:"",source:"pos"}];
 const exact=classifyHeadword(surface,pos,hanjaMap,curated);
 if(exact.type==="hanja"||exact.type==="ambiguous"||exact.source==="curated")
   return [{text:surface,...exact}];
 // Use Garu morphs to distinguish nominal roots and particle/endings.
 const roots=morphs.filter(m=>!GRAMMAR.test(m.pos||"")&&/^[가-힣]+$/.test(String(m.text||"")))
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
 const prefix=choosePrefix(surface,hanjaMap,curated,pos);
 if(prefix)return prefix;
 // If the analyzer classifies a word as an ordinary noun/verb, default to
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
