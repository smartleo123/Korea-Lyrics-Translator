import test from "node:test";
import assert from "node:assert/strict";
import {hasObjectBefore,recoverAttestedInflections} from "../src/inflection-recovery.js";
const dictionaryCore={"밀다":[{"p":"동사","fm":["밀어","미니"]}],"밀어":[{"p":"명사","s":[]}],"놀다":[{"p":"동사","fm":["놀아"]}]};
const dictionaryTranslation={"밀다":[[["推","朝另一個方向施力"]]],"놀다":[[["玩","參加娛樂活動"]]]};
const fetcher=async url=>({ok:true,json:async()=>url.includes("/core/")?dictionaryCore:dictionaryTranslation});
test("object particles provide syntax evidence for competing Hanja noun and verb forms",()=>{
 assert.equal(hasObjectBefore([{text:"널 "},{text:"밀어"}],1),true);
 assert.equal(hasObjectBefore([{text:"얼굴은 "},{text:"밀어"}],1),false);
});
test("attested inflection can replace a false Hanja homograph only when semantic evidence exists",async()=>{
 const lines=[[{text:"널 ",type:"native",gloss:"你"},{text:"밀어",type:"hanja",gloss:"蜜語",source:"dictionary"}]];
 const r=await recoverAttestedInflections(lines,[{text:"把你推進房間"}],{fetcher,converter:x=>x,coreBase:"https://sample.test/core/",translationBase:"https://sample.test/zh/"});
 assert.equal(r.corrected,1);
 assert.equal(lines[0][1].type,"native");
 assert.equal(lines[0][1].gloss,"推");
 assert.equal(lines[0][1].lemma,"밀다");
});
test("correct Hanja stays unchanged without matching verb evidence",async()=>{
 const lines=[[{text:"널 "},{text:"밀어",type:"hanja",gloss:"蜜語",source:"dictionary"}]];
 await recoverAttestedInflections(lines,[{text:"溫柔的蜜語"}],{fetcher,converter:x=>x,coreBase:"https://sample2.test/core/",translationBase:"https://sample2.test/zh/"});
 assert.equal(lines[0][1].gloss,"蜜語");
 assert.equal(lines[0][1].type,"hanja");
});
test("unlisted morphological forms remain untouched; no hardcoded suffix guesses",async()=>{
 const lines=[[{text:"부드러웠는데",type:"native",gloss:""}]];
 const r=await recoverAttestedInflections(lines,[{text:"雖然很柔軟"}],{fetcher,converter:x=>x,coreBase:"https://sample3.test/core/",translationBase:"https://sample3.test/zh/"});
 assert.equal(r.matched,0);
 assert.equal(lines[0][0].gloss,"");
});
