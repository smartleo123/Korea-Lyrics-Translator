// Pure, testable Korean etymology alignment helpers.
// Garu can return multiple morphs sharing a whole-eojeol offset.
// Preserve the exact user-supplied surface; never reconstruct lyrics from lemmas.
export function segmentByOffsets(text,tokens=[]) {
  const spans=new Map();
  for(const t of tokens) {
    const start=Number(t.start),end=Number(t.end);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>text.length||start>=end) continue;
    const key=start+":"+end;
    if(!spans.has(key))spans.set(key,{start,end,morphs:[]});
    spans.get(key).morphs.push(t);
  }
  const sorted=[...spans.values()].sort((a,b)=>a.start-b.start||b.end-a.end);
  const result=[];let cursor=0;
  for(const group of sorted){
    // Discard overlapping subdivisions: never duplicate characters.
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
  if(pos&&(/^(J|E)/.test(pos)||["XSV","XSA","XSN","VCP","VCN","SP","SF","SS","SE","SO","SW"].includes(pos)))return {type:"native",gloss:"",source:"grammar"};
  const hanja=hanjaMap.get(word)||[];
  if(hanja.length===1)return {type:"hanja",gloss:hanja[0],source:"dictionary"};
  if(hanja.length>1)return {type:"ambiguous",gloss:"",choices:hanja,source:"dictionary"};
  if(pos&&["VV","VA","VX","NP","MAG","MAJ","IC","MM","NR"].includes(pos))return {type:"native",gloss:"",source:"pos"};
  return {type:"unknown",gloss:"",source:"unknown"};
}
export function annotateSpan(span,hanjaMap,curated={}) {
 const surface=span.surface;
 if(!/[가-힣A-Za-z]/.test(surface))return [{text:surface,type:"plain",gloss:""}];
 if(!/[가-힣]/.test(surface))return [{text:surface,type:"loan",gloss:""}];
 if(curated[surface])return [{text:surface,...curated[surface]}];
 const morphs=span.morphs||[];
 const exact=classifyHeadword(surface,morphs[0]?.pos,hanjaMap,curated);
 if(exact.type!=="unknown"&&exact.type!=="native"||exact.source==="curated")return [{text:surface,...exact}];
 // A lemma can differ from the surface in conjugated verbs. Check morpheme roots.
 // Prefer the longest prefix actually present in the original surface.
 const roots=morphs.filter(m=>!/^J|^E/.test(m.pos||"")).map(m=>String(m.text||""))
    .filter(w=>w.length>=2&&surface.startsWith(w))
    .sort((a,b)=>b.length-a.length);
 for(const root of roots) {
   const d=classifyHeadword(root,morphs.find(m=>m.text===root)?.pos,hanjaMap,curated);
   if(d.type==="hanja"||d.type==="ambiguous"||d.source==="curated") {
     const tail=surface.slice(root.length);
     return [{text:root,...d},...(tail?[{text:tail,type:"native",gloss:"",source:"grammar"}]:[])];
   }
 }
 // Korean particles can follow dictionary nouns without whitespace.
 for(let len=surface.length-1;len>=2;len--){
   const root=surface.slice(0,len),rest=surface.slice(len);
   if(!/^[가-힣]+$/.test(rest))continue;
   const d=classifyHeadword(root,morphs[0]?.pos,hanjaMap,curated);
   if(d.type==="hanja"||d.type==="ambiguous"||d.source==="curated")
     return [{text:root,...d},{text:rest,type:"native",gloss:"",source:"grammar"}];
 }
 return [{text:surface,...exact}];
}
