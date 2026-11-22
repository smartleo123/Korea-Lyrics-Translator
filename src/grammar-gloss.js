// Apply Korean grammatical evidence *before* generic noun dictionary lookup.
// Rules are about productive grammatical constructions, not song-specific translations.
const HANGUL=/^[가-힣]+$/u;
const PREDICATE=/^(?:VV|VA|VX|VCP|VCN)$/;
const SURFACES=new Map([
 ["난",{gloss:"我",lemma:"나",type:"NP"}],
 ["넌",{gloss:"你",lemma:"너",type:"NP"}],
 ["게",{gloss:"事",lemma:"것",type:"NNB"}],
 ["걸",{gloss:"事",lemma:"것",type:"NNB"}],
 ["안",{gloss:"不",lemma:"안",type:"MAG"}],
 ["수",{gloss:"可能",lemma:"수",type:"NNB"}]
]);
function nearby(tokens,start,end,dir){
 const sorted=tokens.filter(t=>Number.isInteger(t.start)&&Number.isInteger(t.end))
  .sort((a,b)=>a.start-b.start||a.end-b.end);
 return dir<0?[...sorted].reverse().find(t=>t.end<=start):sorted.find(t=>t.start>=end);
}
function partTokens(tokens,start,end){
 return tokens.filter(t=>Number.isInteger(t.start)&&Number.isInteger(t.end)
  &&t.start>=start&&t.end<=end&&t.end>t.start);
}
function grammarMatch(part,tokens,spanStart,spanEnd,source){
 const rule=SURFACES.get(part.text)||
   (/^수[가은는을를]$/u.test(part.text)?SURFACES.get("수"):null);
 if(!rule)return null;
 const local=partTokens(tokens,spanStart,spanEnd);
 const previous=nearby(tokens,spanStart,spanEnd,-1);
 const next=nearby(tokens,spanStart,spanEnd,1);
 const pos=local.map(t=>t.pos||"");
 if(rule.type==="NP"){
  // Confirmed pronouns or contractions in independent clause position.
  // Avoid reinterpreting e.g. a proper name ending in the same syllable.
  const atClauseStart=/^[\s"'“”‘’([{]*$/u.test(source.slice(0,spanStart))||
    /[,，。!?！？\n]\s*$/u.test(source.slice(0,spanStart));
  const followedByClause=!!next&&(PREDICATE.test(next.pos||"")||next.pos==="NP"||next.pos==="JX");
  if(pos.some(x=>x==="NP") || (atClauseStart&&followedByClause))return rule;
 }
 if(rule.type==="MAG"){
  // The adverbial negation 안 typically occurs directly before a predicate.
  if(pos.includes("MAG")||(next&&PREDICATE.test(next.pos||"")))return rule;
 }
 if(rule.type==="NNB"){
  if(pos.includes("NNB"))return rule;
  // Korean bound noun after an adnominal verb/adjective modifier.
  if(previous?.pos==="ETM")return rule;
  // If Garu has recognized a bound noun with inflected case markers.
  if(local.some(t=>t.pos==="NNB"||
     (["JKS","JX","JKO"].includes(t.pos)&&previous?.pos==="ETM")))return rule;
 }
 return null;
}
export function applyGrammarGlosses(parts,tokens=[],source=parts.map(p=>p.text).join("")){
 let position=0;
 return parts.map(part=>{
  const start=position,end=start+[...part.text].length;position=end;
  if(!HANGUL.test(part.text)||part.source==="custom"||part.source==="grammar")return part;
  const rule=grammarMatch(part,tokens,start,end,source);
  if(!rule)return part;
  // Strong morphosyntactic evidence beats a dictionary homograph, even Hanja.
  return {...part,type:"native",gloss:rule.gloss,lemma:rule.lemma,
   source:"grammar-evidence",translationSource:"grammar-evidence"};
 });
}
// Preserve morphosyntactic input for educational regression tests.
export function isGrammaticalReading(text,tokens,source=text){
 const offset=source.indexOf(text);
 if(offset<0)return false;
 return !!grammarMatch({text},tokens,offset,offset+[...text].length,source);
}
