import test from "node:test";
import assert from "node:assert/strict";
import {lemmaFromMorphs,applyGaruLemmaGlosses} from "../src/lemma-lookup.js";
const words={가다:"去",밤:"夜晚",행복하다:"幸福",사랑하다:"愛",지새다:"熬夜"};
test("Garu verbal stem looks up a dictionary form without changing source text",()=>{
 const source=[{text:"가고",type:"native",gloss:""}];
 const result=applyGaruLemmaGlosses(source,[{text:"가",pos:"VV",start:0,end:1},{text:"고",pos:"EC",start:1,end:2}],words);
 assert.equal(result[0].text,"가고");
 assert.equal(result[0].lemma,"가다");
 assert.equal(result[0].gloss,"去");
 assert.equal(result[0].translationSource,"garu-lemma");
});
test("attested irregular surface uses analyzed stem instead of naive surface truncation",()=>{
 const result=applyGaruLemmaGlosses([{text:"지샌",type:"native",gloss:""}],
  [{text:"지새",pos:"VV",start:0,end:2},{text:"ㄴ",pos:"ETM",start:2,end:3}],words);
 assert.equal(result[0].gloss,"熬夜");
 assert.equal(result[0].text,"지샌");
});
test("nominal stems with particles reuse dictionary entry",()=>{
 const result=applyGaruLemmaGlosses([{text:"밤을",type:"native",gloss:""}],
  [{text:"밤",pos:"NNG",start:0,end:1},{text:"을",pos:"JKO",start:1,end:2}],words);
 assert.equal(result[0].gloss,"夜晚");
});
test("unknown and ambiguous analyses do not fabricate lemmas",()=>{
 assert.equal(lemmaFromMorphs("아무말",[{text:"아무",pos:"NNG"},{text:"말",pos:"NNG"}],words),null);
 assert.equal(lemmaFromMorphs("간다",[{text:"가",pos:"VV"},{text:"다",pos:"NNG"}],words),null);
 assert.equal(lemmaFromMorphs("기다려",[],words),null);
});
test("dictionary and manually curated annotations are never overwritten",()=>{
 const out=applyGaruLemmaGlosses([{text:"가고",type:"native",gloss:"手動翻譯",source:"custom"}],
  [{text:"가",pos:"VV",start:0,end:1}],words);
 assert.equal(out[0].gloss,"手動翻譯");
});
test("multiple eojeols and Unicode offsets map to the right segment",()=>{
 const result=applyGaruLemmaGlosses([
  {text:"밤을",type:"native",gloss:""},
  {text:" ",type:"plain",gloss:""},
  {text:"가고",type:"native",gloss:""}
 ],[
  {text:"밤",pos:"NNG",start:0,end:1},{text:"을",pos:"JKO",start:1,end:2},
  {text:"가",pos:"VV",start:3,end:4},{text:"고",pos:"EC",start:4,end:5}
 ],words);
 assert.deepEqual(result.filter(p=>p.lemma).map(p=>p.lemma),["밤","가다"]);
});
