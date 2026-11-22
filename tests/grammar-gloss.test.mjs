import test from "node:test";
import assert from "node:assert/strict";
import {applyGrammarGlosses,isGrammaticalReading} from "../src/grammar-gloss.js";
function tokens(source,items){
 let search=0;
 return items.map(([text,pos])=>{
  const start=source.indexOf(text,search);
  if(start<0)throw Error("Test token not found");
  search=start+text.length;return {text,pos,start,end:search};
 });
}
test("adverbial negative is not translated as an inside-location noun",()=>{
 const source="이해 안 돼";
 const ts=tokens(source,[["이해","NNG"],["안","MAG"],["돼","VV"]]);
 const parts=[{text:"이해 ",type:"native",gloss:"理解"},{text:"안",type:"native",gloss:"裡面"},{text:" ",type:"plain"},{text:"돼",type:"native",gloss:"成為"}];
 const after=applyGrammarGlosses(parts,ts,source);
 assert.equal(after[1].gloss,"不");
 assert.equal(after.map(x=>x.text).join(""),source);
});
test("bound nouns do not receive animal or numerical homograph translations",()=>{
 const source="할 게 있어";
 const ts=tokens(source,[["할","VV"],["게","NNB"],["있어","VV"]]);
 const parts=[{text:"할 ",type:"native"},{text:"게",type:"native",gloss:"螃蟹"},{text:" ",type:"plain"},{text:"있어",type:"native"}];
 assert.equal(applyGrammarGlosses(parts,ts,source)[1].gloss,"事");
});
test("a contracted pronoun in clause position is not a Hanja noun",()=>{
 const source="난 웃고";
 const ts=tokens(source,[["난","NP"],["웃고","VV"]]);
 const parts=[{text:"난",type:"hanja",gloss:"欄"},{text:" ",type:"plain"},{text:"웃고",type:"native"}];
 assert.equal(applyGrammarGlosses(parts,ts,source)[0].gloss,"我");
});
test("unambiguous custom word, ordinary crab noun, and true spatial 안 stay intact",()=>{
 let text="게";let ts=tokens(text,[["게","NNG"]]);
 assert.equal(applyGrammarGlosses([{text,type:"native",gloss:"螃蟹"}],ts,text)[0].gloss,"螃蟹");
 text="집 안";ts=tokens(text,[["집","NNG"],["안","NNG"]]);
 assert.equal(applyGrammarGlosses([{text:"집 ",type:"native"},{text:"안",type:"native",gloss:"裡面"}],ts,text)[1].gloss,"裡面");
 text="안 돼";ts=tokens(text,[["안","MAG"],["돼","VV"]]);
 assert.equal(applyGrammarGlosses([{text:"안",type:"native",gloss:"人工設定",source:"custom"}],ts,text)[0].gloss,"人工設定");
});
test("no suffix guessing without morphological evidence",()=>{
 assert.equal(isGrammaticalReading("게",[],"게"),false);
 assert.equal(isGrammaticalReading("안",[],"안"),false);
});

test("contracted pronouns override false proper-noun Hanja even when Garu tags NNG",()=>{
 const source="난 내가 중요해";
 const ts=tokens(source,[["난","NNG"],["내가","NP"],["중요해","VA"]]);
 const parts=[{text:"난",type:"hanja",gloss:"欄"},{text:" ",type:"plain"},
   {text:"내가",type:"native"},{text:" ",type:"plain"},{text:"중요해",type:"native"}];
 assert.equal(applyGrammarGlosses(parts,ts,source)[0].gloss,"我");
});
test("bound noun followed by subject particle rejects the unrelated price gloss",()=>{
 const source="다를 수가 있어";
 const ts=tokens(source,[["다를","VA"],["수","NNB"],["가","JKS"],["있어","VV"]]);
 const parts=[{text:"다를 ",type:"native"},{text:"수가",type:"native",gloss:"價格"},
   {text:" ",type:"plain"},{text:"있어",type:"native"}];
 assert.equal(applyGrammarGlosses(parts,ts,source)[1].gloss,"可能");
});

test("possessive Korean determiner must be followed by a noun",()=>{
 const source="내 걱정은 낭비야";
 const ts=tokens(source,[["내","NP"],["걱정","NNG"],["은","JX"],["낭비","NNG"]]);
 const parts=[{text:"내",type:"native",gloss:"我"},{text:" ",type:"plain"},{text:"걱정은",type:"hanja",gloss:"懸念"}];
 assert.equal(applyGrammarGlosses(parts,ts,source)[0].gloss,"我的");
 const other=applyGrammarGlosses([{text:"내",type:"native",gloss:"河流"}],
  [{text:"내",pos:"NNG",start:0,end:1}],"내");
 assert.equal(other[0].gloss,"河流");
});
